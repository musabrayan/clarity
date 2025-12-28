import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useGetConversationsQuery, useCloseConversationMutation } from '@/redux/chatApi';
import { useGetAvailabilityQuery, useSetAvailabilityMutation } from '@/redux/authApi';
import Navbar from '../global/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  MessageSquare, 
  Loader2, 
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AgentDashboard - Main dashboard for agents
 * 
 * Features:
 * - Availability toggle
 * - Assigned conversation list
 * - Unread message count
 * - Last message preview
 */
const AgentDashboard = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const currentUser = useSelector((state) => state.auth.user);
  const [isAvailable, setIsAvailable] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [notificationSocket, setNotificationSocket] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }

    return () => {
      // Cleanup notification socket on unmount
      if (notificationSocket && notificationSocket.readyState === WebSocket.OPEN) {
        notificationSocket.close();
      }
    };
  }, [isAuthenticated, navigate, notificationSocket]);

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
  } = useGetConversationsQuery();

  const {
    data: availabilityData,
    isLoading: availabilityLoading,
  } = useGetAvailabilityQuery();

  const [setAvailability, { isLoading: isUpdatingAvailability }] =
    useSetAvailabilityMutation();

  const [closeConversation] = useCloseConversationMutation();

  // Sync availability state with backend
  useEffect(() => {
    if (availabilityData?.is_available !== undefined) {
      setIsAvailable(availabilityData.is_available);
    }
  }, [availabilityData]);

  // Setup notification WebSocket for incoming chat requests
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || 'localhost:8000';
    const authToken = localStorage.getItem('authToken');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/agent/notifications/?token=${authToken}`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Agent notification WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'new_conversation_request') {
            setPendingRequest({
              conversationId: data.conversation_id,
              username: data.username,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Notification WebSocket disconnected');
      };

      setNotificationSocket(ws);

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Failed to create notification WebSocket:', error);
    }
  }, [isAuthenticated, currentUser]);

  const handleAvailabilityToggle = async () => {
    const newStatus = !isAvailable;
    try {
      await setAvailability(newStatus).unwrap();
      setIsAvailable(newStatus);
    } catch (error) {
      console.error('Failed to update availability:', error);
      alert('Failed to update availability status');
    }
  };

  const handleAcceptRequest = (conversationId) => {
    setPendingRequest(null);
    navigate(`/agent/chat/${conversationId}`);
  };

  const handleDismissRequest = async () => {
    if (!pendingRequest) return;

    try {
      // Close the conversation when agent dismisses
      await closeConversation(pendingRequest.conversationId).unwrap();
      setPendingRequest(null);
    } catch (error) {
      console.error('Failed to close conversation:', error);
      // Still clear the notification even if close fails
      setPendingRequest(null);
    }
  };

  const handleSelectConversation = (conversationId) => {
    navigate(`/agent/chat/${conversationId}`);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getOtherParticipant = (conversation) => {
    const otherParticipant = conversation.participants?.find(
      (p) => p.user?.id !== currentUser?.id
    );
    return otherParticipant?.user?.username || 'User';
  };

  const getStatusInfo = (conversation) => {
    if (!conversation.is_active) {
      return {
        label: 'Closed',
        variant: 'outline',
        icon: XCircle,
        color: 'text-gray-500',
      };
    }

    if (conversation.unread_count > 0) {
      return {
        label: 'Active',
        variant: 'default',
        icon: CheckCircle,
        color: 'text-green-500',
      };
    }

    return {
      label: 'Active',
      variant: 'secondary',
      icon: CheckCircle,
      color: 'text-green-500',
    };
  };

  if (!isAuthenticated) {
    return null;
  }

  const activeConversations = conversations.filter((c) => c.is_active);
  const closedConversations = conversations.filter((c) => !c.is_active);
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <Navbar />

      {/* Notification Popup for Incoming Requests */}
      {pendingRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                New Chat Request
              </CardTitle>
              <CardDescription>
                A user wants to connect with you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">User:</p>
                <p className="text-lg font-semibold">{pendingRequest.username}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAcceptRequest(pendingRequest.conversationId)}
                  className="flex-1"
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept Chat
                </Button>
                <Button
                  onClick={handleDismissRequest}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Agent Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your support conversations and availability
            </p>
          </div>

          {/* Availability Control Card */}
          <Card>
            <CardHeader>
              <CardTitle>Availability Status</CardTitle>
              <CardDescription>
                Toggle your availability to receive new chat assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {availabilityLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : isAvailable ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isAvailable ? 'Available' : 'Away'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isAvailable
                        ? 'You can receive new chat assignments'
                        : 'You will not receive new assignments'}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAvailabilityToggle}
                  disabled={isUpdatingAvailability || availabilityLoading}
                  variant={isAvailable ? 'outline' : 'default'}
                >
                  {isUpdatingAvailability ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {isAvailable ? 'Go Away' : 'Go Available'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Active Conversations</CardDescription>
                <CardTitle className="text-3xl">
                  {activeConversations.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Unread Messages</CardDescription>
                <CardTitle className="text-3xl">{totalUnread}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Closed Today</CardDescription>
                <CardTitle className="text-3xl">
                  {closedConversations.length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Active Conversations */}
          <Card>
            <CardHeader>
              <CardTitle>Active Conversations</CardTitle>
              <CardDescription>
                {activeConversations.length === 0
                  ? 'No active conversations'
                  : `${activeConversations.length} ${activeConversations.length === 1 ? 'conversation' : 'conversations'}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeConversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active conversations</p>
                  <p className="text-sm mt-1">
                    {isAvailable
                      ? 'New chats will appear here when users start conversations'
                      : 'Set yourself as available to receive new assignments'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeConversations.map((conversation) => {
                    const status = getStatusInfo(conversation);
                    const StatusIcon = status.icon;

                    return (
                      <div key={conversation.id}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-auto py-3 px-4"
                          onClick={() => handleSelectConversation(conversation.id)}
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <StatusIcon
                                  className={cn('h-4 w-4', status.color)}
                                />
                                <span className="font-medium">
                                  {getOtherParticipant(conversation)}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conversation.updated_at)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground truncate flex-1 mr-2">
                                {conversation.last_message?.content ||
                                  'No messages yet'}
                              </p>

                              {conversation.unread_count > 0 && (
                                <Badge variant="default" className="ml-2">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Button>
                        <Separator className="last:hidden" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Closed Conversations */}
          {closedConversations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Closed Conversations</CardTitle>
                <CardDescription>
                  {closedConversations.length} closed{' '}
                  {closedConversations.length === 1
                    ? 'conversation'
                    : 'conversations'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {closedConversations.slice(0, 5).map((conversation) => (
                    <div key={conversation.id}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto py-3 px-4 opacity-60"
                        onClick={() => handleSelectConversation(conversation.id)}
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <XCircle className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">
                                {getOtherParticipant(conversation)}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conversation.updated_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conversation.last_message?.content || 'No messages'}
                          </p>
                        </div>
                      </Button>
                      <Separator className="last:hidden" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;