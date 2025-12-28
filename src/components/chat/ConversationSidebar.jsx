import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useGetConversationsQuery } from '@/redux/chatApi';
import { setActiveConversation, selectActiveConversationId } from '@/redux/chatUiSlice';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ConversationSidebar - List of conversations for agent view
 */
export function ConversationSidebar() {
  const dispatch = useDispatch();
  const activeConversationId = useSelector(selectActiveConversationId);
  const currentUser = useSelector((state) => state.auth.user);
  
  const { 
    data: conversations = [], 
    isLoading, 
    isError 
  } = useGetConversationsQuery();

  const handleSelectConversation = (conversationId) => {
    dispatch(setActiveConversation(conversationId));
  };
  
  // Get the display name for a conversation
  const getConversationDisplayName = (conversation) => {
    // Try to find the other participant (not the current user)
    const otherParticipant = conversation.participants?.find(
      p => p.user?.id !== currentUser?.id
    );
    
    if (otherParticipant) {
      return otherParticipant.user?.username || otherParticipant.user?.first_name || 'User';
    }
    
    // Fallback to title or generic name
    return conversation.title || 'Unknown';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-80 h-full flex items-center justify-center border-r rounded-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="w-80 h-full flex items-center justify-center border-r rounded-none p-4">
        <p className="text-destructive text-sm text-center">
          Failed to load conversations
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full border-r rounded-none flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversations
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {conversations.length} active
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div key={conversation.id}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start p-4 h-auto rounded-none',
                  activeConversationId === conversation.id && 'bg-accent'
                )}
                onClick={() => handleSelectConversation(conversation.id)}
              >
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {getConversationDisplayName(conversation)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(conversation.updated_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate flex-1 mr-2">
                      {conversation.last_message?.content || 'No messages'}
                    </p>
                    
                    {conversation.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>

                  {conversation.status && (
                    <Badge 
                      variant={conversation.status === 'open' ? 'secondary' : 'outline'}
                      className="mt-2 text-xs"
                    >
                      {conversation.status}
                    </Badge>
                  )}
                </div>
              </Button>
              <Separator />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
