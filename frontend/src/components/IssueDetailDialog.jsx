import { issueStatusConfig, priorityConfig } from '@/lib/constants';
import { formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Bug } from 'lucide-react';

/**
 * Shared dialog for viewing issue/bug details.
 * Used by both agent issues and customer issues pages.
 */
export default function IssueDetailDialog({ issue, onClose, subtitle }) {
  return (
    <Dialog open={!!issue} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            {issue?.title}
          </DialogTitle>
          <DialogDescription>
            {subtitle || formatDate(issue?.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {issue && (
          <div className="space-y-4 pt-2">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{issue.category}</Badge>
              <Badge variant="secondary" className={priorityConfig[issue.priority] || ''}>
                {issue.priority}
              </Badge>
              <Badge variant="secondary" className={issueStatusConfig[issue.status] || ''}>
                {issue.status}
              </Badge>
            </div>

            <Separator />

            {/* Description */}
            {issue.description ? (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {issue.description}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No description provided.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
