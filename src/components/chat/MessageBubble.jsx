import React from 'react';
import { cn } from '@/lib/utils';

/**
 * MessageBubble - Renders an individual chat message
 * 
 * @param {Object} message - Message data
 * @param {boolean} isOwnMessage - Whether the message is from the current user
 */
export const MessageBubble = React.memo(function MessageBubble({ message, isOwnMessage }) {
  const { content, sender, created_at } = message;
  
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp:', timestamp);
        return '';
      }
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  return (
    <div
      className={cn(
        'flex mb-4',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2 shadow-sm',
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {!isOwnMessage && (
          <div className="text-xs font-semibold mb-1 opacity-70">
            {sender?.username || 'User'}
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap wrap-break-word">
          {content}
        </div>
        {created_at && (
          <div
            className={cn(
              'text-xs mt-1 opacity-60',
              isOwnMessage ? 'text-right' : 'text-left'
            )}
          >
            {formatTime(created_at)}
          </div>
        )}
      </div>
    </div>
  );
});
