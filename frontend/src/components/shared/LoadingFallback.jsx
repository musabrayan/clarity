import { Loader2 } from 'lucide-react';

/**
 * Full-screen loading spinner used as React.Suspense fallback
 * for lazily-loaded route components.
 */
export default function LoadingFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
