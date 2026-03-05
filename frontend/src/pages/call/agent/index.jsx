import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Headphones, Phone, PhoneOff, AlertCircle, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import CustomerHistoryPopup from '@/components/CustomerHistoryPopup';
import CallQueue from '@/components/CallQueue';
import { useAgentCall } from '@/components/shared/AgentCallContext';

const AgentPanel = () => {
    const {
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
    } = useAgentCall();

    const statusVariants = {
        offline: 'secondary',
        initializing: 'outline',
        registering: 'outline',
        online: 'default',
        'call-waiting': 'destructive',
        calling: 'default',
        'in-call': 'default'
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Call Panel"
                description="Manage your agent status and handle incoming calls"
                actions={
                    <Badge variant={statusVariants[status] || 'secondary'} className="text-xs">
                        {statusMessage}
                    </Badge>
                }
            />

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column — Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Agent Controls Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Headphones className="h-5 w-5" />
                                    <CardTitle className="text-base">Agent Controls</CardTitle>
                                </div>
                                {status === 'in-call' && (
                                    <Phone className="h-4 w-4 text-primary animate-pulse" />
                                )}
                            </div>
                            <CardDescription>
                                {!isOnline
                                    ? 'Go online to start receiving calls'
                                    : status === 'in-call'
                                        ? 'You are currently on a call'
                                        : `Waiting for calls${callQueue.length > 0 ? ` • ${callQueue.length} in queue` : ''}`
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                                className="flex-1 min-w-[120px]"
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
                                <>
                                    <Separator />
                                    <Button
                                        onClick={toggleHistory}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <History className="mr-2 h-4 w-4" />
                                        {showHistory ? 'Hide' : 'Show'} Customer History
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Call Queue Section */}
                    {isOnline && callQueue.length > 0 && (
                        <CallQueue 
                            calls={callQueue}
                            onAttendCall={attendNextCall}
                            onRejectCall={rejectCall}
                        />
                    )}
                </div>

                {/* Right Column — Stats */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Waiting Calls</span>
                                <span className="text-xl font-bold">{callQueue.length}</span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Active Call</span>
                                <span className="text-xl font-bold">{activeCall ? '1' : '0'}</span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Agent Status</span>
                                <Badge variant={isOnline ? 'default' : 'secondary'}>
                                    {isOnline ? 'Online' : 'Offline'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Customer History Popup */}
            <CustomerHistoryPopup 
                phoneNumber={customerPhone}
                isOpen={showHistory}
                onToggle={toggleHistory}
                onCallBack={callBackCustomer}
            />
        </div>
    );
};

export default AgentPanel;