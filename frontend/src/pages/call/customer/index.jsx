import React from 'react';
import { Phone, Headphones, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import { useCustomerCall } from '@/components/shared/CustomerCallContext';

function StatusBadge({ isCallActive, isAudioReady }) {
    if (isCallActive) return <Badge variant="default">In Call</Badge>;
    if (isAudioReady) return <Badge variant="secondary">Ready</Badge>;
    return <Badge variant="outline">Idle</Badge>;
}

const CustomerCallPage = () => {
    const {
        status,
        isAudioReady,
        isCallActive,
        isInitializing,
        isFindingAgent,
        initUser,
        callAgent,
        endCall,
    } = useCustomerCall();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Call Support"
                description="Connect with an available support agent"
                actions={<StatusBadge isCallActive={isCallActive} isAudioReady={isAudioReady} />}
            />

            <div className="mx-auto max-w-lg space-y-6">
                {/* Call Controls */}
                <Card>
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            {isCallActive ? (
                                <Phone className="h-6 w-6 text-primary animate-pulse" />
                            ) : (
                                <Phone className="h-6 w-6 text-muted-foreground" />
                            )}
                        </div>
                        <CardTitle>
                            {isCallActive ? 'Call In Progress' : 'Ready to Call?'}
                        </CardTitle>
                        <CardDescription>
                            {!isAudioReady
                                ? 'Initialize your audio first, then connect to an agent'
                                : isCallActive
                                    ? 'You are connected with a support agent'
                                    : 'Audio is ready — click below to call an agent'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Step 1: Start Audio */}
                        <Button
                            onClick={initUser}
                            disabled={isAudioReady || isInitializing}
                            className="w-full"
                            size="lg"
                            variant={isAudioReady ? 'secondary' : 'default'}
                        >
                            {isInitializing ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Headphones className="mr-2 h-5 w-5" />
                            )}
                            {isAudioReady ? 'Audio Initialized' : isInitializing ? 'Initializing…' : 'Start Audio'}
                        </Button>

                        {/* Step 2: Call Agent */}
                        <Button
                            onClick={callAgent}
                            disabled={!isAudioReady || isCallActive || isFindingAgent}
                            className="w-full"
                            size="lg"
                            variant="default"
                        >
                            {isFindingAgent ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Phone className="mr-2 h-5 w-5" />
                            )}
                            {isFindingAgent ? 'Finding Agent…' : 'Call Agent'}
                        </Button>

                        {/* End Call */}
                        {isCallActive && (
                            <>
                                <Separator />
                                <Button
                                    onClick={endCall}
                                    className="w-full"
                                    size="lg"
                                    variant="destructive"
                                >
                                    <PhoneOff className="mr-2 h-5 w-5" />
                                    End Call
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Status */}
                <Alert>
                    <AlertDescription className="text-center">{status}</AlertDescription>
                </Alert>
            </div>
        </div>
    );
};

export default CustomerCallPage;