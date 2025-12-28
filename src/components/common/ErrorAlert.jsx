import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, XCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Reusable alert component for different types of messages
 */
export const ErrorAlert = ({ 
  type = 'error', 
  message, 
  onClose,
  className = '' 
}) => {
  const icons = {
    error: XCircle,
    success: CheckCircle,
    warning: AlertCircle,
    info: Info,
  };

  const variants = {
    error: 'border-destructive bg-destructive/10',
    success: 'border-green-500 bg-green-50',
    warning: 'border-amber-500 bg-amber-50',
    info: 'border-blue-500 bg-blue-50',
  };

  const Icon = icons[type] || AlertCircle;

  return (
    <Alert className={`${variants[type]} ${className}`}>
      <Icon className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default ErrorAlert;
