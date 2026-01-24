import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones, Phone, PhoneOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import API_URL from '@/config';

const AgentPanel = () => {
    const [status, setStatus] = useState('offline');
    const [statusMessage, setStatusMessage] = useState('Offline');
    const [isOnline, setIsOnline] = useState(false);
    const [error, setError] = useState(null);
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

            const res = await fetch(`${API_URL}/api/v1/call/token/agent`);
            const data = await res.json();
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

            deviceRef.current.on('registered', () => {
                setStatus('online');
                setStatusMessage('Agent ONLINE (waiting for calls)');
                setIsOnline(true);
            });

            deviceRef.current.on('incoming', (call) => {
                setStatus('incoming');
                setStatusMessage('Incoming call…');
                callRef.current = call;
                call.accept();

                call.on('accept', () => {
                    setStatus('in-call');
                    setStatusMessage('Call in progress…');
                });

                call.on('disconnect', () => {
                    setStatus('online');
                    setStatusMessage('Call ended. Waiting…');
                    callRef.current = null;
                });

                call.on('error', (err) => {
                    console.error('Agent call error:', err);
                    setError(`Call error: ${err?.message ?? String(err)}`);
                });
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
            setError('Microphone permission denied');
            setStatus('offline');
            setIsOnline(false);
        }
    };

    const stopAgent = async () => {
        if (deviceRef.current) {
            deviceRef.current.unregister();
            deviceRef.current.destroy();
            deviceRef.current = null;
        }
        setStatus('offline');
        setStatusMessage('Offline');
        setIsOnline(false);
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
            incoming: 'default',
            'in-call': 'default'
        };

        return (
            <Badge variant={variants[status] || 'secondary'}>
                {statusMessage}
            </Badge>
        );
    };

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Headphones className="h-6 w-6" />
                        Agent Panel
                    </CardTitle>
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

                    <div className="flex gap-2">
                        {!isOnline ? (
                            <Button
                                onClick={startAgent}
                                disabled={status === 'initializing' || status === 'registering'}
                                className="w-full"
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
                                        className="w-full"
                                    >
                                        <PhoneOff className="mr-2 h-4 w-4" />
                                        End Call
                                    </Button>
                                )}
                                <Button
                                    onClick={stopAgent}
                                    variant="destructive"
                                    className="w-full"
                                    disabled={status === 'in-call'}
                                >
                                    <PhoneOff className="mr-2 h-4 w-4" />
                                    Go Offline
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default AgentPanel;