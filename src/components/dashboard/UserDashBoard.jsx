import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  useGetConversationsQuery,
  useCreateConversationMutation,
} from '@/redux/chatApi';
import Navbar from '../global/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  MessageSquare, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * UserDashboard - Main dashboard for users
 * 
 * Features:
 * - Start chat button (only when agents available)
 * - Chat history
 * - Conversation status
 */
const UserDashBoard = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const currentUser = useSelector((state) => state.auth.user);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    refetch: refetchConversations,
  } = useGetConversationsQuery();

  const [createConversation, { isLoading: isCreating }] =
    useCreateConversationMutation();

  const handleStartChat = async () => {
    try {
      const result = await createConversation({}).unwrap();
      const conversationId = result.conversation?.id || result.id;
      navigate(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Failed to start chat:', error);
      alert('Failed to start chat. Please try again.');
    }
  };

  const handleSelectConversation = (conversationId) => {
    navigate(`/chat/${conversationId}`);
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <Navbar />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Welcome, {currentUser?.username}</h1>
            <p className="text-muted-foreground mt-1">
              Start a new chat or continue an existing conversation
            </p>
          </div>

          {/* Start Chat Card */}
          <Card>
            <CardHeader>
              <CardTitle>Support Chat</CardTitle>
              <CardDescription>
                Connect with a support agent to get help with your questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStartChat}
                disabled={isCreating}
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting with agent...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start New Chat
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Chat History */}
          <Card>
            <CardHeader>
              <CardTitle>Your Conversations</CardTitle>
              <CardDescription>
                {conversations.length === 0
                  ? 'No conversations yet'
                  : `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No conversation history</p>
                  <p className="text-sm mt-1">Start a new chat to get help from our support team</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conversation) => {
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
                                <StatusIcon className={cn("h-4 w-4", status.color)} />
                                <span className="font-medium">
                                  {conversation.title || 'Support Conversation'}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(conversation.updated_at)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground truncate flex-1 mr-2">
                                {conversation.last_message?.content || 'No messages yet'}
                              </p>

                              {conversation.unread_count > 0 && (
                                <Badge variant="default" className="ml-2">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-2">
                              <Badge variant={status.variant} className="text-xs">
                                {status.label}
                              </Badge>
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
        </div>
      </div>
    </div>
  );
};

export default UserDashBoard;
