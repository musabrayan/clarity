/**
 * WebSocket Service for Real-time Chat
 * 
 * Handles WebSocket connection lifecycle and message exchange
 */

import { 
  getAuthenticatedWebSocketUrl, 
  isWebSocketConnected, 
  closeWebSocket 
} from '../utils/websocket';
import { WS_EVENTS, WS_PATHS, CONNECTION_CONFIG } from '../constants';

class ChatSocketService {
  constructor() {
    this.socket = null;
    this.conversationId = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = CONNECTION_CONFIG.MAX_RECONNECT_ATTEMPTS;
    this.reconnectDelay = 1000;
    this.isIntentionalClose = false;
  }

  /**
   * Connect to a conversation's WebSocket
   */
  connect(conversationId, token = null) {
    if (this.socket && this.conversationId === conversationId) {
      return; // Already connected to this conversation
    }

    // Close existing connection if switching conversations
    if (this.socket) {
      this.disconnect();
    }

    this.conversationId = conversationId;
    this.isIntentionalClose = false;

    const wsUrl = getAuthenticatedWebSocketUrl(WS_PATHS.CHAT(conversationId));

    try {
      this.socket = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.emit(WS_EVENTS.ERROR, { message: 'Failed to establish WebSocket connection' });
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit(WS_EVENTS.CONNECTED, { conversationId: this.conversationId });
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code);
      this.emit(WS_EVENTS.DISCONNECTED, { code: event.code });

      // Attempt reconnection if not intentional close
      if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
          if (this.conversationId && !this.isIntentionalClose) {
            this.connect(this.conversationId);
          }
        }, delay);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit(WS_EVENTS.ERROR, { message: 'WebSocket error occurred' });
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    const { type } = data;

    switch (type) {
      case WS_EVENTS.MESSAGE:
        this.emit(WS_EVENTS.MESSAGE, data);
        break;
      case WS_EVENTS.TYPING:
        this.emit(WS_EVENTS.TYPING, data);
        break;
      case WS_EVENTS.PRESENCE:
      case WS_EVENTS.PRESENCE_UPDATE:
        this.emit(WS_EVENTS.PRESENCE, data);
        break;
      case WS_EVENTS.READ_RECEIPT:
        this.emit(WS_EVENTS.READ_RECEIPT, data);
        break;
      case WS_EVENTS.CONVERSATION_CLOSED:
        this.emit(WS_EVENTS.CONVERSATION_CLOSED, data);
        break;
      case WS_EVENTS.ERROR:
        this.emit(WS_EVENTS.ERROR, data);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Send a chat message
   */
  sendMessage(content) {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify({
        type: 'message',
        content,
      }));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(isTyping) {
    if (!this.isConnected()) return;

    try {
      this.socket.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
      }));
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  /**
   * Send read receipt
   */
  sendReadReceipt() {
    if (!this.isConnected()) return;

    try {
      this.socket.send(JSON.stringify({
        type: 'read',
      }));
    } catch (error) {
      console.error('Error sending read receipt:', error);
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected() {
    return isWebSocketConnected(this.socket);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.isIntentionalClose = true;
    closeWebSocket(this.socket, 1000, 'Client closing connection');
    this.socket = null;
    this.conversationId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Clear all listeners
   */
  clearListeners() {
    this.listeners.clear();
  }
}

// Export singleton instance
export const chatSocket = new ChatSocketService();
