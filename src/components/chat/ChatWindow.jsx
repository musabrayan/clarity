import React, { useEffect, useRef, useMemo } from 'react';
import { useGetMessagesQuery } from '@/redux/chatApi';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { Loader2 } from 'lucide-react';

/**
 * ChatWindow - Main message display area
 * 
 * @param {number} conversationId - Active conversation ID
 * @param {Array} realtimeMessages - Messages received via WebSocket
 * @param {Array} typingUsers - Users currently typing
 * @param {number} currentUserId - ID of the current user
 */
export const ChatWindow = React.memo(function ChatWindow({ 
  conversationId, 
  realtimeMessages = [], 
  typingUsers = [],
  currentUserId 
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

  // Fetch initial messages from REST API
  const { 
    data: messagesData, 
    isLoading, 
    isError 
  } = useGetMessagesQuery(
    { conversationId, page: 1 },
    { skip: !conversationId }
  );

  // Combine REST API messages with real-time messages and deduplicate
  const allMessages = useMemo(() => {
    const restMessages = messagesData?.results || [];
    const messageMap = new Map();
    
    // Add REST messages first
    restMessages.forEach(msg => {
      if (msg.id) messageMap.set(msg.id, msg);
    });
    
    // Add/override with realtime messages (newer data)
    realtimeMessages.forEach(msg => {
      if (msg.id) {
        messageMap.set(msg.id, msg);
      } else if (msg.tempId) {
        // Handle optimistic messages - fix sender data
        const optimisticMsg = {
          ...msg,
          sender: msg.sender?.id === 'current' 
            ? { id: currentUserId, username: 'You' }
            : msg.sender
        };
        messageMap.set(msg.tempId, optimisticMsg);
      }
    });
    
    // Return sorted by creation time
    return Array.from(messageMap.values()).sort((a, b) => 
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );
  }, [messagesData?.results, realtimeMessages, currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages, shouldAutoScroll]);

  // Check if user is near bottom of scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No conversation selected</p>
          <p className="text-sm mt-2">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        <p>Failed to load messages. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          allMessages.map((message) => (
            <MessageBubble
              key={message.id || message.tempId || `temp-${message.created_at}`}
              message={message}
              isOwnMessage={message.sender?.id === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <TypingIndicator typingUsers={typingUsers} />
    </div>
  );
});
