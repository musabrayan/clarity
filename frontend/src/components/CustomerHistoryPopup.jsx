import React, { useState } from 'react';
import { useGetCustomerHistoryQuery } from '@/redux/api/recordingsApi';
import { getEmotionColor } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, History, Phone } from 'lucide-react';

const CustomerHistoryPopup = ({ phoneNumber, isOpen, onToggle, onCallBack }) => {
    const { data: callHistory = [], isLoading: loading } = useGetCustomerHistoryQuery(phoneNumber, {
        skip: !isOpen || !phoneNumber,
    });
    const [expandedCall, setExpandedCall] = useState(null);

    const mostRecentCall = callHistory[0];
    const previousCalls = callHistory.slice(1);

    return (
        <Sheet open={isOpen} onOpenChange={onToggle}>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                <SheetHeader className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        <SheetTitle>Customer History</SheetTitle>
                    </div>
                    <SheetDescription>
                        {loading
                            ? 'Loading call history…'
                            : callHistory.length > 0
                                ? `${callHistory.length} call${callHistory.length !== 1 ? 's' : ''} found`
                                : 'No previous calls found'
                        }
                    </SheetDescription>
                </SheetHeader>

                <Separator />

                <ScrollArea className="flex-1 px-6 py-4">
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-2 rounded-md border p-3">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            ))}
                        </div>
                    ) : callHistory.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No previous calls found
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {/* Most Recent Call */}
                            {mostRecentCall && (
                                <CallCard
                                    call={mostRecentCall}
                                    isExpanded={expandedCall === mostRecentCall._id}
                                    onToggle={() => setExpandedCall(expandedCall === mostRecentCall._id ? null : mostRecentCall._id)}
                                    isMostRecent={true}
                                    getEmotionColor={getEmotionColor}
                                    onCallBack={onCallBack}
                                />
                            )}

                            {/* Divider */}
                            {previousCalls.length > 0 && <Separator className="my-4" />}

                            {/* Previous Calls */}
                            {previousCalls.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground px-1">
                                        PREVIOUS CALLS ({previousCalls.length})
                                    </p>
                                    <div className="space-y-2">
                                        {previousCalls.map((call) => (
                                            <CallCard
                                                key={call._id}
                                                call={call}
                                                isExpanded={expandedCall === call._id}
                                                onToggle={() => setExpandedCall(expandedCall === call._id ? null : call._id)}
                                                isMostRecent={false}
                                                getEmotionColor={getEmotionColor}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
};

// Call Card Component
const CallCard = ({ call, isExpanded, onToggle, isMostRecent, getEmotionColor, onCallBack }) => {
    const callDate = new Date(call.createdAt);
    const formattedDate = callDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: callDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    const formattedTime = callDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return (
        <div className={`rounded-md border p-3 transition-colors hover:border-primary ${
            isMostRecent ? 'border-2 border-primary bg-primary/5' : 'bg-card'
        }`}>
            <button
                onClick={onToggle}
                className="w-full text-left"
            >
                <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold whitespace-nowrap">
                                {formattedDate} at {formattedTime}
                            </span>
                            {isMostRecent && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">Latest</Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {call.issueCategory} &bull; {call.resolutionStatus}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                            variant="outline"
                            className={`${getEmotionColor(call.emotionLabel)} text-xs`}
                        >
                            {call.emotionLabel}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border">
                    <div className="space-y-3">
                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="min-w-0">
                                <p className="text-muted-foreground font-medium">Emotion Score</p>
                                <p className="font-semibold text-foreground">
                                    {(call.emotionScore * 100).toFixed(0)}%
                                </p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-muted-foreground font-medium">Expertise</p>
                                <p className="font-semibold text-foreground truncate">
                                    {call.expertiseLevel}
                                </p>
                            </div>
                        </div>

                        {/* Summary */}
                        {call.summary && (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold">Summary</p>
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                                    {call.summary}
                                </p>
                            </div>
                        )}

                        {/* Bullet Points */}
                        {call.bulletPoints && call.bulletPoints.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-semibold">Key Points</p>
                                <ul className="space-y-1">
                                    {call.bulletPoints.map((point, idx) => (
                                        <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                                            <span className="text-primary flex-shrink-0">&bull;</span>
                                            <span className="line-clamp-2">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Transcript */}
                        {call.transcript && (
                            <div className="space-y-1">
                                <details className="group">
                                    <summary className="cursor-pointer flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80">
                                        <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
                                        View Full Transcript
                                    </summary>
                                    <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                                        {call.transcript}
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Call Back Button */}
                        {isMostRecent && onCallBack && (
                            <Button
                                onClick={() => onCallBack(call.phone)}
                                size="sm"
                                className="w-full text-xs h-8"
                            >
                                <Phone className="mr-1 h-3 w-3" />
                                Call Back Customer
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerHistoryPopup;