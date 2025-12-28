import { useEffect, useCallback, useRef, useState } from 'react';
import { chatSocket } from '../services/chatSocket';
import { WS_EVENTS, TIMEOUTS } from '../constants';

/**
 * Custom hook for managing chat WebSocket connection
 * 
 * @param {number|null} conversationId - ID of the conversation to connect to
 * @returns {Object} Socket state and methods
 */
export function useChatSocket(conversationId) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [presenceStatus, setPresenceStatus] = useState(new Map());
  const [conversationClosed, setConversationClosed] = useState(false);
  const typingTimeoutRef = useRef(new Map());

  // Connect to conversation when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      chatSocket.disconnect();
      setIsConnected(false);
      return;
    }

    // Connect to the conversation
    chatSocket.connect(conversationId);

    // Set up event listeners (regular functions, not hooks inside useEffect)
    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleMessage = (data) => {
      // WebSocket message format: { type: 'message', message: {...}, timestamp: '...' }
      if (data.message) {
        setMessages(prev => {
          // Remove optimistic message if it exists (match by content and recent timestamp)
          const filtered = prev.filter(msg => {
            if (!msg.isOptimistic) return true;
            // Remove optimistic if content matches and was sent within last 5 seconds
            const timeDiff = new Date() - new Date(msg.created_at);
            return !(msg.content === data.message.content && timeDiff < 5000);
          });
          return [...filtered, data.message];
        });
      }
    };

    const handleTyping = (data) => {
      const { user_id, username, is_typing } = data;
      
      setTypingUsers(prev => {
        const next = new Map(prev);
        if (is_typing) {
          next.set(user_id, username);
          
          // Clear existing timeout
          if (typingTimeoutRef.current.has(user_id)) {
            clearTimeout(typingTimeoutRef.current.get(user_id));
          }
          
          // Set new timeout to clear typing status after specified duration
          const timeout = setTimeout(() => {
            setTypingUsers(current => {
              const updated = new Map(current);
              updated.delete(user_id);
              return updated;
            });
            typingTimeoutRef.current.delete(user_id);
          }, TIMEOUTS.TYPING_INDICATOR);
          
          typingTimeoutRef.current.set(user_id, timeout);
        } else {
          next.delete(user_id);
          // Clear timeout if exists
          if (typingTimeoutRef.current.has(user_id)) {
            clearTimeout(typingTimeoutRef.current.get(user_id));
            typingTimeoutRef.current.delete(user_id);
          }
        }
        return next;
      });
    };

    const handlePresence = (data) => {
      const { user_id, username, is_online } = data;
      setPresenceStatus(prev => {
        const next = new Map(prev);
        if (is_online) {
          next.set(user_id, { username, online: true });
        } else {
          next.set(user_id, { username, online: false });
        }
        return next;
      });
    };

    const handleError = (data) => {
      console.error('WebSocket error:', data);
    };

    const handleConversationClosed = (data) => {
      console.log('Conversation closed by:', data.username);
      setConversationClosed(true);
    };

    // Register listeners
    chatSocket.on(WS_EVENTS.CONNECTED, handleConnected);
    chatSocket.on(WS_EVENTS.DISCONNECTED, handleDisconnected);
    chatSocket.on(WS_EVENTS.MESSAGE, handleMessage);
    chatSocket.on(WS_EVENTS.TYPING, handleTyping);
    chatSocket.on(WS_EVENTS.PRESENCE, handlePresence);
    chatSocket.on(WS_EVENTS.ERROR, handleError);
    chatSocket.on(WS_EVENTS.CONVERSATION_CLOSED, handleConversationClosed);

    // Cleanup on unmount or conversationId change
    return () => {
      chatSocket.off(WS_EVENTS.CONNECTED, handleConnected);
      chatSocket.off(WS_EVENTS.DISCONNECTED, handleDisconnected);
      chatSocket.off(WS_EVENTS.MESSAGE, handleMessage);
      chatSocket.off(WS_EVENTS.TYPING, handleTyping);
      chatSocket.off(WS_EVENTS.PRESENCE, handlePresence);
      chatSocket.off(WS_EVENTS.ERROR, handleError);
      chatSocket.off(WS_EVENTS.CONVERSATION_CLOSED, handleConversationClosed);
      
      // Clear all typing timeouts
      typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
      
      chatSocket.disconnect();
      setIsConnected(false);
      setMessages([]);
      setTypingUsers(new Map());
      setPresenceStatus(new Map());
      setConversationClosed(false);
    };
  }, [conversationId]);

  // Send a message
  const sendMessage = useCallback((content) => {
    if (!content.trim()) return false;
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      tempId,
      content: content.trim(),
      sender: { id: 'current' }, // Will be replaced by actual user data in component
      created_at: new Date().toISOString(),
      message_type: 'text',
      isOptimistic: true
    };
    
    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Send via WebSocket
    const success = chatSocket.sendMessage(content);
    
    if (!success) {
      // Remove optimistic message if send failed
      setMessages(prev => prev.filter(msg => msg.tempId !== tempId));
    }
    
    return success;
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    chatSocket.sendTyping(isTyping);
  }, []);

  // Send read receipt
  const sendReadReceipt = useCallback(() => {
    chatSocket.sendReadReceipt();
  }, []);

  // Clear received messages (useful when switching conversations)
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    isConnected,
    messages,
    typingUsers: Array.from(typingUsers.values()),
    presenceStatus,
    conversationClosed,
    sendMessage,
    sendTyping,
    sendReadReceipt,
    clearMessages,
  };
}
