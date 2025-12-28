import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * TypingIndicator - Shows when other participants are typing
 */
export function TypingIndicator({ typingUsers = [] }) {
  if (typingUsers.length === 0) return null;

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing...`
    : `${typingUsers.length} people are typing...`;

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <Badge variant="secondary" className="text-xs">
        {typingText}
      </Badge>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  );
}
