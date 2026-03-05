import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUserId } from '@/redux/slice/user.slice';
import { useGetUserRecordingsQuery } from '@/redux/api/recordingsApi';
import { useGetUserIssuesQuery } from '@/redux/api/issuesApi';
import { issueStatusConfig, priorityConfig, ticketStatusConfig } from '@/lib/constants';
import { formatDate } from '@/lib/formatters';
import IssueDetailDialog from '@/components/IssueDetailDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import TableSkeleton from '@/components/shared/TableSkeleton';
import EmptyState from '@/components/shared/EmptyState';
import { ClipboardList, AlertCircle, Bug } from 'lucide-react';

const CustomerIssues = () => {
  const userId = useSelector(selectUserId);
  const [activeTab, setActiveTab] = useState('tickets');
  const [selectedBug, setSelectedBug] = useState(null);

  const { data: recordings = [], isLoading: ticketLoading, error: ticketQueryError } = useGetUserRecordingsQuery(userId, { skip: !userId });
  const { data: bugReports = [], isLoading: bugLoading, error: bugQueryError } = useGetUserIssuesQuery(userId, { skip: !userId });

  const ticketError = ticketQueryError ? 'Failed to load call tickets' : null;
  const bugError = bugQueryError ? 'Failed to load bug reports' : null;
  const error = activeTab === 'tickets' ? ticketError : bugError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Issues"
        description="Track the status of your support requests and bug reports"
      />

      {/* Tab Switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'tickets'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
          Call Tickets
          {recordings.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">{recordings.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('bugs')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'bugs'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bug className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
          Bug Reports
          {bugReports.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">{bugReports.length}</Badge>
          )}
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Call Tickets Tab */}
      {activeTab === 'tickets' && (
        <Card>
          <CardContent className="p-0">
            {ticketLoading ? (
              <TableSkeleton columns={3} rows={5} />
            ) : recordings.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="No call tickets yet"
                  description="When you contact support, your call tickets will appear here with their current status."
                />
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Handled By</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordings.map((rec) => (
                      <TableRow key={rec._id || rec.recordingSid}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(rec.createdAt)}
                        </TableCell>
                        <TableCell>{rec.agentName || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={ticketStatusConfig[rec.ticketStatus] || ticketStatusConfig.Pending}
                          >
                            {rec.ticketStatus || 'Pending'}
                          </Badge>
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
      )}

      {/* Bug Reports Tab */}
      {activeTab === 'bugs' && (
        <Card>
          <CardContent className="p-0">
            {bugLoading ? (
              <TableSkeleton columns={5} rows={5} />
            ) : bugReports.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Bug}
                  title="No bug reports yet"
                  description="When you report a bug from the dashboard, it will appear here."
                />
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bugReports.map((bug) => (
                      <TableRow
                        key={bug._id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedBug(bug)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {bug.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bug.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={priorityConfig[bug.priority] || ''}>
                            {bug.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={issueStatusConfig[bug.status] || ''}>
                            {bug.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(bug.createdAt)}
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
      )}

      {/* Bug Detail Dialog */}
      <IssueDetailDialog
        issue={selectedBug}
        onClose={() => setSelectedBug(null)}
        subtitle={`Submitted ${formatDate(selectedBug?.createdAt)}`}
      />
    </div>
  );
};

export default CustomerIssues;