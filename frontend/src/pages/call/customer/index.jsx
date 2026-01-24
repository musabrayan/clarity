import React, { useState, useRef } from 'react';
import { Phone, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CustomerCallPage = () => {
    const [status, setStatus] = useState('Waiting for user action…');
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const deviceRef = useRef(null);
    const callRef = useRef(null);

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

            const res = await fetch('http://localhost:3000/api/v1/call/token/user');
            const data = await res.json();
            const { token, identity } = data;

            console.log('User identity:', identity);

            const device = new window.Twilio.Device(token, {
                codecPreferences: ['opus', 'pcmu'],
                logLevel: 'debug',
                enableImprovedSignalingErrorPrecision: true
            });

            device.on('error', err => {
                console.error('User device error:', err);
                setStatus(`Error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setIsAudioReady(false);
            });

            deviceRef.current = device;
            setIsAudioReady(true);
            setStatus('Audio ready. You can call.');
            console.log('User device initialized');

        } catch (err) {
            console.error(err);
            setStatus('Microphone permission denied');
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
            setStatus('Calling agent…');
            setIsCallActive(true);

            const call = await deviceRef.current.connect({
                params: { To: 'agent' }
            });

            callRef.current = call;
            console.log('Call initiated');

            call.on('accept', () => {
                setStatus('Call connected');
                console.log('Call accepted');
            });

            call.on('disconnect', () => {
                setStatus('Call ended');
                setIsCallActive(false);
                callRef.current = null;
                console.log('Call disconnected');
            });

            call.on('error', err => {
                console.error('Call error:', err);
                setStatus(`Call error (${err?.code ?? '?'}): ${err?.message ?? String(err)}`);
                setIsCallActive(false);
            });

        } catch (err) {
            console.error('Failed to connect:', err);
            setStatus('Failed to connect: ' + err.message);
            setIsCallActive(false);
        }
    };

    const endCall = () => {
        if (callRef.current) {
            callRef.current.disconnect();
            setStatus('Ending call...');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>User Panel</CardTitle>
                    <CardDescription>Initialize audio and call the agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={initUser}
                            disabled={isAudioReady || isInitializing}
                            className="w-full"
                            size="lg"
                        >
                            <Headphones className="mr-2 h-5 w-5" />
                            {isInitializing ? 'Initializing...' : 'Start Audio'}
                        </Button>

                        <Button
                            onClick={callAgent}
                            disabled={!isAudioReady || isCallActive}
                            className="w-full"
                            size="lg"
                            variant="default"
                        >
                            <Phone className="mr-2 h-5 w-5" />
                            Call Agent
                        </Button>

                        {isCallActive && (
                            <Button
                                onClick={endCall}
                                className="w-full"
                                size="lg"
                                variant="destructive"
                            >
                                <Phone className="mr-2 h-5 w-5" />
                                End Call
                            </Button>
                        )}
                    </div>

                    <Alert>
                        <AlertDescription>{status}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomerCallPage;