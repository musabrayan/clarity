import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown, ChevronUp, History, Phone, ChevronRight, GripHorizontal } from 'lucide-react';
import './CustomerHistoryPopup.css';
import API_URL from '@/config';

const CustomerHistoryPopup = ({ phoneNumber, isOpen, onToggle, onCallBack }) => {
    const [callHistory, setCallHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [expandedCall, setExpandedCall] = useState(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const popupRef = useRef(null);
    const headerRef = useRef(null);

    useEffect(() => {
        if (isOpen && phoneNumber) {
            fetchCustomerHistory();
        }
    }, [isOpen, phoneNumber]);

    const fetchCustomerHistory = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${API_URL}/api/v1/call/customer-history/${phoneNumber}`,
                { credentials: 'include' }
            );
            const data = await response.json();

            if (data.success) {
                setCallHistory(data.calls);
                if (data.calls.length > 0) {
                    setExpandedCall(data.calls[0]._id);
                }
            }
        } catch (error) {
            console.error('Error fetching customer history:', error);
        } finally {
            setLoading(false);
        }
    };

    // Handle mouse down on header
    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return; // Don't drag if clicking a button

        setIsDragging(true);
        const rect = popupRef.current?.getBoundingClientRect();

        setDragOffset({
            x: e.clientX - (position.x || rect?.left || 0),
            y: e.clientY - (position.y || rect?.top || 0)
        });
    };

    // Handle mouse move
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    if (!isOpen) return null;

    const mostRecentCall = callHistory[0];
    const previousCalls = callHistory.slice(1);

    const getEmotionColor = (emotion) => {
        const colors = {
            'Positive': 'bg-green-100 text-green-800 border-green-300',
            'Neutral': 'bg-gray-100 text-gray-800 border-gray-300',
            'Negative': 'bg-red-100 text-red-800 border-red-300',
            'Frustrated': 'bg-yellow-100 text-yellow-800 border-yellow-300',
            'Satisfied': 'bg-blue-100 text-blue-800 border-blue-300'
        };
        return colors[emotion] || 'bg-gray-100 text-gray-800 border-gray-300';
    };

    return (
        <>
            {/* Overlay - Only show when popup is open */}
            <div
                className={`history-popup-overlay ${isOpen ? 'visible' : ''}`}
                onClick={onToggle}
            />

            {/* Popup Container */}
            <div
                ref={popupRef}
                className={`history-popup-container ${isOpen ? 'open' : ''} ${isMinimized ? 'minimized' : ''}`}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            >
                <Card className="history-popup-card">
                    {/* Header - Draggable */}
                    <CardHeader
                        ref={headerRef}
                        className="popup-header cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMouseDown}
                    >
                        <div className="header-content">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <GripHorizontal className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <History className="h-5 w-5 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-lg truncate">Customer History</CardTitle>
                                    {callHistory.length > 0 && (
                                        <CardDescription className="text-xs">
                                            {callHistory.length} call{callHistory.length !== 1 ? 's' : ''} found
                                        </CardDescription>
                                    )}
                                </div>
                            </div>
                            <div className="header-actions flex-shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="h-8 w-8 p-0"
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    {isMinimized ? (
                                        <ChevronUp className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onToggle}
                                    className="h-8 w-8 p-0"
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Content - Hidden when minimized */}
                    {!isMinimized && (
                        <CardContent className="popup-content">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : callHistory.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        No previous calls found
                                    </p>
                                </div>
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
                                    {previousCalls.length > 0 && (
                                        <div className="my-4 border-t border-border"></div>
                                    )}

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
                        </CardContent>
                    )}
                </Card>
            </div>
        </>
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
        <div className={`call-card ${isMostRecent ? 'most-recent' : ''}`}>
            <button
                onClick={onToggle}
                className="w-full text-left call-header"
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
                            {call.issueCategory} • {call.resolutionStatus}
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
                <div className="call-details mt-3 pt-3 border-t border-border">
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
                                            <span className="text-primary flex-shrink-0">•</span>
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
                                className="w-full bg-green-600 hover:bg-green-700 text-xs h-8"
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