import React, { useState } from 'react';
import { useCreateIssueMutation } from '@/redux/api/issuesApi';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Bug, Loader2 } from 'lucide-react';

export default function BugReportDialog() {
  const [createIssue] = useCreateIssueMutation();
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugCategory, setBugCategory] = useState('Bug');
  const [bugPriority, setBugPriority] = useState('Medium');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugDialogOpen, setBugDialogOpen] = useState(false);

  const handleBugSubmit = async () => {
    if (!bugTitle.trim()) return;
    setBugSubmitting(true);
    try {
      const result = await createIssue({
        title: bugTitle.trim(),
        description: bugDesc.trim(),
        category: bugCategory,
        priority: bugPriority,
      }).unwrap();
      if (result.success) {
        toast.success('Bug reported successfully!');
        setBugTitle('');
        setBugDesc('');
        setBugCategory('Bug');
        setBugPriority('Medium');
        setBugDialogOpen(false);
      } else {
        toast.error(result.message || 'Failed to submit bug report');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to submit bug report');
    } finally {
      setBugSubmitting(false);
    }
  };

  return (
    <Dialog open={bugDialogOpen} onOpenChange={setBugDialogOpen}>
      <DialogTrigger asChild>
        <Card className="flex flex-col items-center text-center p-6 gap-3 cursor-pointer hover:shadow-md transition-shadow">
          <div className="rounded-full bg-destructive/10 p-4">
            <Bug className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-base">Report a Bug</CardTitle>
          <CardDescription className="text-xs">
            Found something wrong? Let us know
          </CardDescription>
          <Button variant="outline" className="mt-auto w-full">
            Report
          </Button>
        </Card>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Describe the issue and we&apos;ll look into it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="bug-title">Title</Label>
            <Input
              id="bug-title"
              placeholder="Short summary…"
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bug-desc">Description</Label>
            <textarea
              id="bug-desc"
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
              placeholder="Steps to reproduce, expected vs actual behaviour…"
              value={bugDesc}
              onChange={(e) => setBugDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={bugCategory} onValueChange={setBugCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug</SelectItem>
                  <SelectItem value="Feature Request">Feature Request</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={bugPriority} onValueChange={setBugPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!bugTitle.trim() || bugSubmitting}
            onClick={handleBugSubmit}
          >
            {bugSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
