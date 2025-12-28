/**
 * Application-wide constants
 */

// WebSocket Event Types
export const WS_EVENTS = {
  MESSAGE: 'message',
  TYPING: 'typing',
  PRESENCE: 'presence',
  PRESENCE_UPDATE: 'presence_update',
  READ_RECEIPT: 'read_receipt',
  CONVERSATION_CLOSED: 'conversation_closed',
  NEW_CONVERSATION_REQUEST: 'new_conversation_request',
  ERROR: 'error',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
};

// User Roles
export const USER_ROLES = {
  USER: 'USER',
  AGENT: 'AGENT',
};

// WebSocket Close Codes
export const WS_CLOSE_CODES = {
  NORMAL: 1000,
  UNAUTHORIZED: 4001,
  FORBIDDEN: 4003,
};

// Timeouts
export const TIMEOUTS = {
  TYPING_INDICATOR: 3000,
  REDIRECT_DELAY: 1500,
  RECONNECT_BASE: 1000,
  AVAILABILITY_POLL: 30000,
};

// Connection Settings
export const CONNECTION_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY_MULTIPLIER: 1,
};

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  SYSTEM: 'system',
  FILE: 'file',
};

// API Endpoints (relative to base URL)
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login/',
    REGISTER: '/api/auth/register/',
    LOGOUT: '/api/auth/logout/',
    AVAILABILITY: '/api/auth/availability/',
  },
  CHAT: {
    CONVERSATIONS: '/api/chat/conversations/',
    MESSAGES: (id) => `/api/chat/conversations/${id}/messages/`,
    CLOSE: (id) => `/api/chat/conversations/${id}/close/`,
    READ: (id) => `/api/chat/conversations/${id}/read/`,
  },
};

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  AGENT_DASHBOARD: '/agent/dashboard',
  CHAT: (id) => `/chat/${id}`,
  AGENT_CHAT: (id) => `/agent/chat/${id}`,
};

// WebSocket Paths
export const WS_PATHS = {
  CHAT: (id) => `/ws/chat/${id}/`,
  AGENT_NOTIFICATIONS: '/ws/agent/notifications/',
};
