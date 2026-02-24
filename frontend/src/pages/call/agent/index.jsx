import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones, Phone, PhoneOff, AlertCircle, History, Clock, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import API_URL from '@/config';
import CustomerHistoryPopup from '../../../components/CustomerHistoryPopup';
import CallQueue from '../../../components/CallQueue';
import { useNavigate } from 'react-router-dom';

const AgentPanel = () => {
    const [status, setStatus] = useState('offline');
    const [statusMessage, setStatusMessage] = useState('Offline');
    const [isOnline, setIsOnline] = useState(false);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(null);
    const [device, setDevice] = useState(null);
    const [callQueue, setCallQueue] = useState([]);
    const [activeCall, setActiveCall] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [customerPhone, setCustomerPhone] = useState(null);
    const [missedCallCount, setMissedCallCount] = useState(0);
    const navigate = useNavigate();
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

            const res = await fetch(`${API_URL}/api/v1/call/token/agent`, {
                credentials: 'include'
            });
            const data = await res.json();
            
            if (!data.success) {
                setError(data.message || 'Failed to get token');
                setStatus('offline');
                return;
            }
            
            const { token, identity } = data;

            console.log('Agent identity:', identity);

            const { Device } = window.Twilio;
            deviceRef.current = new Device(token, {
                codecPreferences: ['opus', 'pcmu'],
                logLevel: 'debug',
                enableImprovedSignalingErrorPrecision: true
            });

            deviceRef.current.on('registering', () => {
                setStatus('registering');
                setStatusMessage('Registering agent…');
            });

            deviceRef.current.on('registered', async () => {
                // Register agent in backend
                try {
                    await fetch(`${API_URL}/api/v1/call/register-agent`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    console.log('Agent registered in backend');
                } catch (error) {
                    console.error('Failed to register agent in backend:', error);
                }
                
                setStatus('online');
                setStatusMessage('Agent ONLINE (waiting for calls)');
                setIsOnline(true);
            });

            // Handle incoming calls - queue instead of auto-accept
            deviceRef.current.on('incoming', (call) => {
                const callerPhone = call.parameters?.From || '';
                
                // Add to queue
                const newCall = {
                    id: call.sid,
                    phone: callerPhone,
                    timestamp: new Date(),
                    callObject: call
                };
                
                setCallQueue(prev => [...prev, newCall]);
                setMissedCallCount(prev => prev + 1);
                
                setStatus('call-waiting');
                setStatusMessage(`Call waiting (${callQueue.length + 1} in queue)…`);
                
                console.log('Call queued:', callerPhone);
            });

            deviceRef.current.on('error', (err) => {
                console.error('Agent device error:', err);
                setError(`Error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setStatus('offline');
                setIsOnline(false);
            });

            await deviceRef.current.register();
        } catch (err) {
            console.error(err);
            setError(err.message || 'Microphone permission denied');
            setStatus('offline');
            setIsOnline(false);
        }
    };

    // Cleanup: unregister + destroy device when component unmounts
    // This fixes agent appearing online after navigating away
    useEffect(() => {
        return () => {
            if (deviceRef.current) {
                try {
                    // Unregister from backend
                    fetch(`${API_URL}/api/v1/call/unregister-agent`, {
                        method: 'POST',
                        credentials: 'include'
                    }).catch(console.error);
                    
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
            await fetch(`${API_URL}/api/v1/call/unregister-agent`, {
                method: 'POST',
                credentials: 'include'
            });
            console.log('Agent unregistered from backend');
        } catch (error) {
            console.error('Failed to unregister agent from backend:', error);
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
        setMissedCallCount(0);
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
            console.log('Accepting call from:', nextCall.phone);
            
            // Set active call BEFORE accepting (prevents state issues)
            setActiveCall(nextCall);
            setCustomerPhone(nextCall.phone);
            setShowHistory(true);
            
            // Update call ref
            callRef.current = callObject;
            
            // Setup disconnect handler BEFORE accepting
            callObject.on('disconnect', () => {
                console.log('Call disconnected');
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
                console.error('Call error:', err);
                setError(`Call error: ${err?.message ?? String(err)}`);
            });

            // NOW accept the call
            callObject.accept();
            
            // Remove from queue AFTER accepting
            setCallQueue(prev => prev.slice(1));
            setStatus('in-call');
            setStatusMessage('Call in progress…');
            
            console.log('Call accepted successfully');
        } catch (err) {
            console.error('Failed to accept call:', err);
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
            } catch (err) {
                console.error('Failed to reject call:', err);
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
                console.error('Outbound call error:', err);
                setError(`Call error: ${err?.message ?? String(err)}`);
                setStatus('online');
            });
        } catch (err) {
            console.error('Failed to make outbound call:', err);
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

    const getStatusBadge = () => {
        const variants = {
            offline: 'secondary',
            initializing: 'outline',
            registering: 'outline',
            online: 'default',
            'call-waiting': 'destructive',
            calling: 'default',
            'in-call': 'default'
        };

        return (
            <Badge variant={variants[status] || 'secondary'}>
                {statusMessage}
            </Badge>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-full md:max-w-4xl space-y-6">
            {/* Main Agent Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Agent Controls */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Headphones className="h-6 w-6" />
                                Agent Panel
                            `   </CardTitle>
                            <CardDescription>
                                Manage your agent status and handle incoming calls
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    {getStatusBadge()}
                                </div>
                                {status === 'in-call' && (
                                    <Phone className="h-5 w-5 text-green-600 animate-pulse" />
                                )}
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-2 flex-wrap">
                                {!isOnline ? (
                                    <Button
                                        onClick={startAgent}
                                        disabled={status === 'initializing' || status === 'registering'}
                                        className="flex-1 min-w-[120px]"
                                    >
                                        <Headphones className="mr-2 h-4 w-4" />
                                        Go Online
                                    </Button>
                                ) : (
                                    <>
                                        {status === 'in-call' && (
                                            <Button
                                                onClick={endCall}
                                                variant="destructive"
                                                className="flex-1 min-w-[120px]"
                                            >
                                                <PhoneOff className="mr-2 h-4 w-4" />
                                                End Call
                                            </Button>
                                        )}
                                        
                                        {callQueue.length > 0 && status !== 'in-call' && (
                                            <Button
                                                onClick={attendNextCall}
                                                variant="default"
                                                className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700"
                                            >
                                                <Phone className="mr-2 h-4 w-4" />
                                                Next Call ({callQueue.length})
                                            </Button>
                                        )}
                                        
                                        <Button
                                            onClick={stopAgent}
                                            variant="destructive"
                                            className="flex-1 min-w-[120px]"
                                            disabled={status === 'in-call'}
                                        >
                                            <PhoneOff className="mr-2 h-4 w-4" />
                                            Go Offline
                                        </Button>
                                    </>
                                )}
                            </div>

                            {isOnline && customerPhone && status === 'in-call' && (
                                <Button
                                    onClick={() => setShowHistory(!showHistory)}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <History className="mr-2 h-4 w-4" />
                                    {showHistory ? 'Hide' : 'Show'} Customer History
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Stats */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Queue Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-xs text-muted-foreground">Waiting Calls</p>
                                <p className="text-2xl font-bold">{callQueue.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Active Call</p>
                                <p className="text-2xl font-bold">{activeCall ? '1' : '0'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Agent Status</p>
                                <Badge variant={isOnline ? 'default' : 'secondary'} className="mt-1">
                                    {isOnline ? 'Online' : 'Offline'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Call Queue Section - Full Width */}
            {isOnline && callQueue.length > 0 && (
                <CallQueue 
                    calls={callQueue}
                    onAttendCall={attendNextCall}
                    onRejectCall={rejectCall}
                    activeCallCount={activeCall ? 1 : 0}
                />
            )}

            {/* Customer History Popup - Draggable */}
            <CustomerHistoryPopup 
                phoneNumber={customerPhone}
                isOpen={showHistory}
                onToggle={() => setShowHistory(!showHistory)}
                onCallBack={callBackCustomer}
            />
        </div>
    );
};

export default AgentPanel;