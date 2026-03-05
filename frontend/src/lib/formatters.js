/**
 * Shared formatting utilities.
 * Pure functions — safe to call from any component or hook.
 */

/**
 * Format a date string into a short readable form.
 * @param {string|null} dateStr  ISO date string
 * @returns {string}
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a duration in seconds to a human-readable string.
 * @param {number|string} value  Seconds
 * @returns {string}
 */
export const formatDuration = (value) => {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds)) return '-';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

/**
 * Human-readable wait time from a Date timestamp.
 * @param {Date} timestamp
 * @returns {string}
 */
export const getWaitTime = (timestamp) => {
  const now = new Date();
  const diff = Math.floor((now - timestamp) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
};
