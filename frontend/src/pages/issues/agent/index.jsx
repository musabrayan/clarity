import React, { useState, useMemo } from 'react';
import { useGetIssuesQuery, useUpdateIssueStatusMutation } from '@/redux/api/issuesApi';
import { priorityConfig } from '@/lib/constants';
import { formatDate } from '@/lib/formatters';
import IssueDetailDialog from '@/components/IssueDetailDialog';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import TableSkeleton from '@/components/shared/TableSkeleton';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import {
  Bug,
  AlertCircle,
  Filter,
} from 'lucide-react';

const AgentIssues = () => {
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const queryParams = {};
  if (statusFilter !== 'all') queryParams.status = statusFilter;
  if (priorityFilter !== 'all') queryParams.priority = priorityFilter;

  const { data: issues = [], isLoading, error: queryError } = useGetIssuesQuery(queryParams);
  const [updateIssueStatus] = useUpdateIssueStatusMutation();

  const handleUpdateStatus = async (issueId, nextStatus) => {
    try {
      const result = await updateIssueStatus({ issueId, status: nextStatus }).unwrap();
      if (!result.success) {
        toast.error(result.message || 'Failed to update status');
      } else {
        toast.success('Status updated');
        if (selectedIssue?._id === issueId) {
          setSelectedIssue((prev) => ({ ...prev, status: nextStatus }));
        }
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status');
    }
  };

  const stats = useMemo(() => ({
    total: issues.length,
    open: issues.filter((i) => i.status === 'Open').length,
    inProgress: issues.filter((i) => i.status === 'In Progress').length,
    resolved: issues.filter((i) => i.status === 'Resolved' || i.status === 'Closed').length,
  }), [issues]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Issues"
        description="Manage and respond to customer bug reports and feature requests"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground">Resolved / Closed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {queryError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load issues</AlertDescription>
        </Alert>
      )}

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reported Issues</CardTitle>
          <CardDescription>Click any row to view details</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton columns={6} rows={5} />
            </div>
          ) : issues.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Bug}
                title="No issues found"
                description={
                  statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'No issues match the current filters. Try adjusting them.'
                    : 'No customer issues have been reported yet.'
                }
              />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow
                      key={issue._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedIssue(issue)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {issue.title}
                      </TableCell>
                      <TableCell>{issue.customerName || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{issue.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={priorityConfig[issue.priority] || ''}>
                          {issue.priority}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={issue.status}
                          onValueChange={(value) => handleUpdateStatus(issue._id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(issue.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Issue Detail Dialog */}
      <IssueDetailDialog
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        subtitle={`${selectedIssue?.customerName || 'Customer'} — ${formatDate(selectedIssue?.createdAt)}`}
      />
    </div>
  );
};

export default AgentIssues;
