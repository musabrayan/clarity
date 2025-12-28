/**
 * WebSocket utility functions
 */

/**
 * Get WebSocket URL with proper protocol
 * @param {string} path - WebSocket path
 * @returns {string} Complete WebSocket URL
 */
export const getWebSocketUrl = (path) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = import.meta.env.VITE_WS_URL || 'localhost:8000';
  return `${wsProtocol}//${wsHost}${path}`;
};

/**
 * Get authentication token from storage
 * @returns {string|null} Auth token
 */
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

/**
 * Create WebSocket URL with token in query param (temporary until backend supports headers)
 * @param {string} path - WebSocket path
 * @returns {string} Complete WebSocket URL with token
 */
export const getAuthenticatedWebSocketUrl = (path) => {
  const baseUrl = getWebSocketUrl(path);
  const token = getAuthToken();
  return token ? `${baseUrl}?token=${token}` : baseUrl;
};

/**
 * Check if WebSocket is in connected state
 * @param {WebSocket} socket - WebSocket instance
 * @returns {boolean} True if connected
 */
export const isWebSocketConnected = (socket) => {
  return socket && socket.readyState === WebSocket.OPEN;
};

/**
 * Safely close WebSocket connection
 * @param {WebSocket} socket - WebSocket instance
 * @param {number} code - Close code
 * @param {string} reason - Close reason
 */
export const closeWebSocket = (socket, code = 1000, reason = 'Client closing connection') => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close(code, reason);
  }
};
