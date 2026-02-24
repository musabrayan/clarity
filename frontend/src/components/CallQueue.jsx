import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, PhoneOff, User } from 'lucide-react';
import './CallQueue.css';

const CallQueue = ({ calls, onAttendCall, onRejectCall, activeCallCount }) => {
    const getWaitTime = (timestamp) => {
        const now = new Date();
        const diff = Math.floor((now - timestamp) / 1000);

        if (diff < 60) {
            return `${diff}s`;
        } else if (diff < 3600) {
            return `${Math.floor(diff / 60)}m`;
        } else {
            return `${Math.floor(diff / 3600)}h`;
        }
    };

    return (
        <Card className="call-queue-card border-blue-200">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-600" />
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
                    <div key={call.id} className="call-queue-item">
                        <div className="call-queue-info">
                            <div className="call-position">
                                <span className="position-badge">{index + 1}</span>
                            </div>

                            <div className="call-details">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-semibold">{call.phone}</span>
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
                            <div className="call-queue-actions">
                                <Button
                                    size="sm"
                                    onClick={onAttendCall}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Phone className="mr-1 h-4 w-4" />
                                    Accept
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onRejectCall(call.id)}
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