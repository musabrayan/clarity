import React, { useState, useEffect } from 'react';
import { getWaitTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, PhoneOff, User } from 'lucide-react';

const CallQueue = ({ calls, onAttendCall, onRejectCall }) => {
    // Force re-render every 30s so wait times stay accurate
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 30_000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="animate-in slide-in-from-bottom-2 duration-300">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-lg">
                                Incoming Call Queue
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {calls.length} call{calls.length !== 1 ? 's' : ''} waiting
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                        {calls.length}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-2">
                {calls.map((call, index) => (
                    <div
                        key={call.id}
                        className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:border-primary ${
                            index === 0 ? 'border-2 border-destructive bg-destructive/5' : 'bg-card'
                        } max-sm:flex-col max-sm:items-start`}
                    >
                        <div className="flex flex-1 items-center gap-3 min-w-0 max-sm:w-full">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                {index + 1}
                            </span>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">
                                        {call.callerName || 'Resolving…'}
                                    </span>
                                    {index === 0 && (
                                        <Badge variant="destructive" className="text-xs">NEXT</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Waiting for {getWaitTime(call.timestamp)}
                                </p>
                            </div>
                        </div>

                        {index === 0 && (
                            <div className="flex gap-2 max-sm:w-full">
                                <Button
                                    size="sm"
                                    onClick={onAttendCall}
                                    className="max-sm:flex-1"
                                >
                                    <Phone className="mr-1 h-4 w-4" />
                                    Accept
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onRejectCall(call.id)}
                                    className="max-sm:flex-1"
                                >
                                    <PhoneOff className="mr-1 h-4 w-4" />
                                    Reject
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default CallQueue;