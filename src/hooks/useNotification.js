import { useState, useCallback } from 'react';

/**
 * Custom hook for managing in-app notifications
 * Replace alert() calls with proper UI feedback
 */
export const useNotification = () => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type, id: Date.now() });
  }, []);

  const showError = useCallback((message) => {
    showNotification(message, 'error');
  }, [showNotification]);

  const showSuccess = useCallback((message) => {
    showNotification(message, 'success');
  }, [showNotification]);

  const showWarning = useCallback((message) => {
    showNotification(message, 'warning');
  }, [showNotification]);

  const showInfo = useCallback((message) => {
    showNotification(message, 'info');
  }, [showNotification]);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    clearNotification,
  };
};

export default useNotification;
