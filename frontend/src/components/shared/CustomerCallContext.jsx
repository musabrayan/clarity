import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from 'react';
import { Device } from '@twilio/voice-sdk';
import api from '@/services/api';

const CustomerCallContext = createContext(null);

export function useCustomerCall() {
    const ctx = useContext(CustomerCallContext);
    if (!ctx) throw new Error('useCustomerCall must be used within CustomerCallProvider');
    return ctx;
}

export function CustomerCallProvider({ children }) {
    const [status, setStatus] = useState('Waiting for user action…');
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isFindingAgent, setIsFindingAgent] = useState(false);
    const deviceRef = useRef(null);
    const callRef = useRef(null);

    // Cleanup only when the provider unmounts (i.e. logout / leave authenticated layout)
    useEffect(() => {
        return () => {
            if (callRef.current) {
                try { callRef.current.disconnect(); } catch (e) { /* ignore */ }
                callRef.current = null;
            }
            if (deviceRef.current) {
                try { deviceRef.current.destroy(); } catch (e) { /* ignore */ }
                deviceRef.current = null;
            }
        };
    }, []);

    const unlockAudio = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
    };

    const initUser = async () => {
        try {
            setIsInitializing(true);
            setStatus('Requesting microphone access…');

            await unlockAudio();
            setStatus('Initializing audio…');

            const { data } = await api.get('/api/v1/call/token/customer');

            if (!data.success) {
                setStatus(data.message || 'Failed to get token');
                return;
            }

            const { token } = data;

            const device = new Device(token, {
                codecPreferences: ['opus', 'pcmu'],
                logLevel: import.meta.env.DEV ? 'debug' : 'warn',
                enableImprovedSignalingErrorPrecision: true
            });

            device.on('error', err => {
                setStatus(`Error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setIsAudioReady(false);
            });

            deviceRef.current = device;
            setIsAudioReady(true);
            setStatus('Audio ready. You can call.');

        } catch (err) {
            setStatus(err.message || 'Initialization failed');
        } finally {
            setIsInitializing(false);
        }
    };

    const callAgent = async () => {
        if (!isAudioReady || !deviceRef.current) {
            setStatus('Audio not ready yet');
            return;
        }

        try {
            setIsFindingAgent(true);
            setStatus('Finding available agent...');

            const { data: agentData } = await api.get('/api/v1/call/available-agent');

            if (!agentData.success) {
                setStatus(agentData.message || 'No agent available');
                return;
            }

            const agentIdentity = agentData.identity;

            setStatus('Calling agent...');
            setIsCallActive(true);

            const call = await deviceRef.current.connect({
                params: { To: agentIdentity }
            });

            callRef.current = call;

            call.on('accept', () => {
                setStatus('Call connected');
            });

            call.on('disconnect', () => {
                setStatus('Call ended');
                setIsCallActive(false);
                callRef.current = null;
            });

            call.on('error', err => {
                setStatus(`Call error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setIsCallActive(false);
            });

        } catch (err) {
            setStatus('Failed to connect: ' + err.message);
            setIsCallActive(false);
        } finally {
            setIsFindingAgent(false);
        }
    };

    const endCall = () => {
        if (callRef.current) {
            callRef.current.disconnect();
            setStatus('Ending call...');
        }
    };

    const value = useMemo(() => ({
        status,
        isAudioReady,
        isCallActive,
        isInitializing,
        isFindingAgent,
        initUser,
        callAgent,
        endCall,
    }), [status, isAudioReady, isCallActive, isInitializing, isFindingAgent]);

    return (
        <CustomerCallContext.Provider value={value}>
            {children}
        </CustomerCallContext.Provider>
    );
}
