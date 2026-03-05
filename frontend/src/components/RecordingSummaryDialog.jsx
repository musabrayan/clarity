import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, FileText, Tag, CheckCircle, List } from 'lucide-react';

export default function RecordingSummaryDialog({ recording, onClose }) {
  return (
    <Dialog
      open={!!recording}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Call Summary
          </DialogTitle>
          <DialogDescription>
            {recording?.customerName || 'Customer'} &mdash;{' '}
            {recording?.createdAt
              ? new Date(recording.createdAt).toLocaleString()
              : ''}
          </DialogDescription>
        </DialogHeader>

        {recording && (
          <div className="space-y-4 pt-2">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              {recording.emotionLabel && (
                <Badge variant="outline" className="gap-1">
                  <Brain className="h-3 w-3" />
                  {recording.emotionLabel}
                </Badge>
              )}
              {recording.issueCategory && (
                <Badge variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {recording.issueCategory}
                </Badge>
              )}
              {recording.resolutionStatus && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {recording.resolutionStatus}
                </Badge>
              )}
              {recording.expertiseLevel && (
                <Badge variant="secondary" className="gap-1">
                  Level: {recording.expertiseLevel}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Summary */}
            {recording.summary && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <FileText className="h-4 w-4" /> Summary
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {recording.summary}
                </p>
              </div>
            )}

            {/* Bullet Points */}
            {recording.bulletPoints?.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <List className="h-4 w-4" /> Key Points
                </h4>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                  {recording.bulletPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transcript */}
            {recording.transcript && (
              <>
                <Separator />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Transcript</h4>
                  <ScrollArea className="max-h-48 rounded-md border p-3">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {recording.transcript}
                    </p>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Fallback if nothing processed */}
            {!recording.summary &&
              !recording.transcript &&
              !recording.bulletPoints?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No AI summary available for this call yet.
                </p>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
