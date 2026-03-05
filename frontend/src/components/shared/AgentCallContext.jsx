import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Device } from '@twilio/voice-sdk';
import api from '@/services/api';

const AgentCallContext = createContext(null);

/**
 * Extract user ID from a Twilio identity string.
 * e.g. 'client:customer_64abc123' -> '64abc123'
 *      'customer_64abc123'        -> '64abc123'
 */
function extractCustomerId(identity) {
    if (!identity) return null;
    // Strip 'client:' prefix if present
    const cleaned = identity.includes(':') ? identity.split(':').pop() : identity;
    // Strip role prefix (customer_ or user_)
    const match = cleaned.match(/^(?:customer|user)_(.+)$/);
    return match ? match[1] : null;
}

export function useAgentCall() {
    const ctx = useContext(AgentCallContext);
    if (!ctx) throw new Error('useAgentCall must be used within AgentCallProvider');
    return ctx;
}

export function AgentCallProvider({ children }) {
    const [status, setStatus] = useState('offline');
    const [statusMessage, setStatusMessage] = useState('Offline');
    const [isOnline, setIsOnline] = useState(false);
    const [error, setError] = useState(null);
    const [callQueue, setCallQueue] = useState([]);
    const [activeCall, setActiveCall] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [customerPhone, setCustomerPhone] = useState(null);
    const deviceRef = useRef(null);
    const callRef = useRef(null);

    const unlockAudio = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
    };

    const startAgent = async () => {
        try {
            setStatus('initializing');
            setStatusMessage('Requesting microphone access…');
            setError(null);

            await unlockAudio();

            setStatusMessage('Initializing agent…');

            const { data } = await api.get('/api/v1/call/token/agent');

            if (!data.success) {
                setError(data.message || 'Failed to get token');
                setStatus('offline');
                return;
            }

            const { token, identity } = data;

            deviceRef.current = new Device(token, {
                codecPreferences: ['opus', 'pcmu'],
                logLevel: import.meta.env.DEV ? 'debug' : 'warn',
                enableImprovedSignalingErrorPrecision: true
            });

            deviceRef.current.on('registering', () => {
                setStatus('registering');
                setStatusMessage('Registering agent…');
            });

            deviceRef.current.on('registered', async () => {
                // Register agent in backend
                try {
                    await api.post('/api/v1/call/register-agent');
                } catch (_) {
                    // Registration failure is non-fatal
                }
                setStatus('online');
                setStatusMessage('Agent ONLINE (waiting for calls)');
                setIsOnline(true);
            });

            // Handle incoming calls - queue instead of auto-accept
            deviceRef.current.on('incoming', (call) => {
                const callerPhone = call.parameters?.From || '';
                const customerId = extractCustomerId(callerPhone);

                // Add to queue with a placeholder name, then resolve asynchronously
                const newCall = {
                    id: call.sid,
                    phone: callerPhone,
                    callerName: null,       // resolved below
                    customerId: customerId,
                    timestamp: new Date(),
                    callObject: call
                };

                setCallQueue(prev => [...prev, newCall]);

                setStatus('call-waiting');
                setStatusMessage(`Call waiting…`);

                // Resolve customer name asynchronously
                if (customerId) {
                    api.get(`/api/v1/user/${customerId}/info`)
                        .then(({ data }) => {
                            if (data.success && data.user?.fullName) {
                                setCallQueue(prev =>
                                    prev.map(c =>
                                        c.id === call.sid
                                            ? { ...c, callerName: data.user.fullName }
                                            : c
                                    )
                                );
                            }
                        })
                        .catch(() => { /* caller name resolution is non-critical */ });
                }
            });

            deviceRef.current.on('error', (err) => {
                setError(`Error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setStatus('offline');
                setIsOnline(false);
            });

            await deviceRef.current.register();
        } catch (err) {
            setError(err.message || 'Microphone permission denied');
            setStatus('offline');
            setIsOnline(false);
        }
    };

    // Cleanup only when the provider unmounts (i.e. logout / leave authenticated layout)
    useEffect(() => {
        return () => {
            if (deviceRef.current) {
                try {
                    // Unregister from backend (fire-and-forget)
                    api.post('/api/v1/call/unregister-agent').catch(() => {});

                    deviceRef.current.unregister();
                    deviceRef.current.destroy();
                } catch (e) { /* ignore */ }
                deviceRef.current = null;
            }
        };
    }, []);

    const stopAgent = async () => {
        // Unregister from backend
        try {
            await api.post('/api/v1/call/unregister-agent');
        } catch (_) {
            // Unregister failure is non-fatal
        }

        if (deviceRef.current) {
            deviceRef.current.unregister();
            deviceRef.current.destroy();
            deviceRef.current = null;
        }
        setStatus('offline');
        setStatusMessage('Offline');
        setIsOnline(false);
        setCallQueue([]);
    };

    // Accept first call in queue
    const attendNextCall = async () => {
        if (callQueue.length === 0) {
            setError('No calls in queue');
            return;
        }

        const nextCall = callQueue[0];
        const callObject = nextCall.callObject;

        try {
            // Set active call BEFORE accepting (prevents state issues)
            setActiveCall(nextCall);
            setCustomerPhone(nextCall.phone);
            setShowHistory(true);

            // Update call ref
            callRef.current = callObject;

            // Setup disconnect handler BEFORE accepting
            callObject.on('disconnect', () => {
                setStatus('online');
                setStatusMessage('Call ended. Waiting…');
                callRef.current = null;
                setActiveCall(null);

                // Update queue status after call ends
                setCallQueue(prev => {
                    const remaining = prev.length - 1;
                    if (remaining > 0) {
                        setStatusMessage(`${remaining} call${remaining !== 1 ? 's' : ''} waiting…`);
                        setStatus('call-waiting');
                    } else {
                        setStatusMessage('Agent ONLINE (waiting for calls)');
                        setStatus('online');
                    }
                    return prev;
                });
            });

            callObject.on('error', (err) => {
                setError(`Call error: ${err?.message ?? String(err)}`);
            });

            // NOW accept the call
            callObject.accept();

            // Remove from queue AFTER accepting
            setCallQueue(prev => prev.slice(1));
            setStatus('in-call');
            setStatusMessage('Call in progress…');
        } catch (err) {
            setError('Failed to accept call');
            setActiveCall(null);
            setCustomerPhone(null);
        }
    };

    // Reject call from queue
    const rejectCall = (callId) => {
        const callToReject = callQueue.find(c => c.id === callId);

        if (callToReject) {
            try {
                callToReject.callObject.reject();
                setCallQueue(prev => prev.filter(c => c.id !== callId));

                if (callQueue.length <= 1) {
                    setStatus('online');
                    setStatusMessage('Agent ONLINE (waiting for calls)');
                } else {
                    const remaining = callQueue.length - 1;
                    setStatusMessage(`${remaining} call${remaining !== 1 ? 's' : ''} waiting…`);
                    setStatus('call-waiting');
                }
            } catch (_) {
                setError('Failed to reject call');
            }
        }
    };

    // Make outbound call to customer
    const callBackCustomer = async (phone) => {
        if (!deviceRef.current || !isOnline) {
            setError('Agent must be online to make calls');
            return;
        }

        if (activeCall) {
            setError('Cannot make outbound call while in active call');
            return;
        }

        try {
            setStatus('calling');
            setStatusMessage(`Calling ${phone}…`);

            const callParams = {
                To: phone
            };

            const outgoingCall = deviceRef.current.connect(callParams);

            outgoingCall.on('accept', () => {
                setStatus('in-call');
                setStatusMessage('Call in progress…');
                setActiveCall({ phone, isOutbound: true });
                setCustomerPhone(phone);
                callRef.current = outgoingCall;
            });

            outgoingCall.on('disconnect', () => {
                setStatus('online');
                setStatusMessage('Call ended. Waiting…');
                callRef.current = null;
                setActiveCall(null);

                if (callQueue.length > 0) {
                    setStatusMessage(`${callQueue.length} calls waiting…`);
                    setStatus('call-waiting');
                }
            });

            outgoingCall.on('error', (err) => {
                setError(`Call error: ${err?.message ?? String(err)}`);
                setStatus('online');
            });
        } catch (err) {
            setError('Failed to make outbound call');
            setStatus('online');
        }
    };

    const endCall = () => {
        if (callRef.current) {
            callRef.current.disconnect();
            setStatusMessage('Ending call...');
        }
    };

    const toggleHistory = () => setShowHistory(prev => !prev);

    const value = useMemo(() => ({
        status,
        statusMessage,
        isOnline,
        error,
        setError,
        callQueue,
        activeCall,
        showHistory,
        customerPhone,
        startAgent,
        stopAgent,
        attendNextCall,
        rejectCall,
        callBackCustomer,
        endCall,
        toggleHistory,
    }), [
        status, statusMessage, isOnline, error, callQueue,
        activeCall, showHistory, customerPhone,
    ]);

    return (
        <AgentCallContext.Provider value={value}>
            {children}
        </AgentCallContext.Provider>
    );
}
