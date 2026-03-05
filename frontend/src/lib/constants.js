// ── Issue / ticket status badge styles ────────────────────────────────

export const issueStatusConfig = {
  Open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'In Progress':
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Resolved:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Closed:
    'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
};

export const priorityConfig = {
  Low: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  Medium:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Critical:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const ticketStatusConfig = {
  Pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Resolved:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Closed:
    'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
};

export const ticketBadgeVariant = {
  Pending: 'outline',
  Resolved: 'default',
  Closed: 'secondary',
};

// ── Emotion badge styles ──────────────────────────────────────────────

export const emotionColorMap = {
  Positive:
    'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  Neutral: 'bg-muted text-muted-foreground border-border',
  Negative:
    'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  Frustrated:
    'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  Satisfied:
    'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
};

/**
 * Get the Tailwind classes for an emotion label.
 * Falls back to neutral styling for unknown labels.
 */
export const getEmotionColor = (emotion) =>
  emotionColorMap[emotion] || 'bg-muted text-muted-foreground border-border';
