import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useCloseConversationMutation } from '@/redux/chatApi';
import { useNotification } from '@/hooks/useNotification';
import { ChatWindow } from './ChatWindow';
import { MessageComposer } from './MessageComposer';
import Navbar from '../global/Navbar';
import ErrorAlert from '../common/ErrorAlert';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { TIMEOUTS } from '@/constants';

/**
 * Unified chat layout component for both user and agent views
 * Eliminates duplication between UserChat and AgentChat
 */
export const ChatLayout = ({ 
  conversationId, 
  dashboardPath,
  headerTitle = 'Support Chat'
}) => {
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  
  const { notification, showError, clearNotification } = useNotification();
  
  const [closeConversation, { isLoading: isClosing }] = 
    useCloseConversationMutation();

  const {
    isConnected,
    messages: realtimeMessages,
    typingUsers,
    conversationClosed,
    sendMessage,
    sendTyping,
  } = useChatSocket(conversationId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Redirect to dashboard if no conversation ID
  useEffect(() => {
    if (isAuthenticated && !conversationId) {
      navigate(dashboardPath);
    }
  }, [isAuthenticated, conversationId, navigate, dashboardPath]);

  // Handle conversation closed event
  useEffect(() => {
    if (conversationClosed) {
      setTimeout(() => {
        navigate(dashboardPath);
      }, TIMEOUTS.REDIRECT_DELAY);
    }
  }, [conversationClosed, navigate, dashboardPath]);

  const handleSendMessage = (content) => {
    if (!isConnected) {
      showError('Not connected to chat. Please wait...');
      return;
    }
    sendMessage(content);
  };

  const handleEndChat = async () => {
    if (!conversationId) return;
    
    if (window.confirm('Are you sure you want to end this chat session?')) {
      try {
        await closeConversation(conversationId).unwrap();
        navigate(dashboardPath);
      } catch (error) {
        console.error('Failed to close conversation:', error);
        showError('Failed to end chat. Please try again.');
      }
    }
  };

  const handleBackToDashboard = () => {
    navigate(dashboardPath);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b p-4 bg-background">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToDashboard}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">{headerTitle}</h1>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? (
                    <span className="text-green-600">● Connected</span>
                  ) : (
                    <span className="text-amber-600">● Connecting...</span>
                  )}
                </p>
              </div>
            </div>
            {conversationId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndChat}
                disabled={isClosing || conversationClosed}
              >
                {isClosing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ending...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    End Chat
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="max-w-7xl w-full mx-auto px-4 pt-4">
            <ErrorAlert
              type={notification.type}
              message={notification.message}
              onClose={clearNotification}
            />
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="max-w-7xl w-full mx-auto flex flex-col">
            {conversationClosed && (
              <ErrorAlert
                type="warning"
                message="This conversation has been ended. Redirecting to dashboard..."
                className="m-4"
              />
            )}
            
            <Card className="flex-1 flex flex-col rounded-none border-x">
              <ChatWindow
                conversationId={conversationId}
                realtimeMessages={realtimeMessages}
                typingUsers={typingUsers}
                currentUserId={currentUser?.id}
              />
              
              {conversationId && (
                <div className="border-t p-3 bg-muted/30 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEndChat}
                    disabled={isClosing || conversationClosed}
                    className="text-destructive hover:text-destructive"
                  >
                    {isClosing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Ending Chat...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        End Chat Session
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <MessageComposer
                onSendMessage={handleSendMessage}
                onTyping={sendTyping}
                disabled={!isConnected || conversationClosed}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
