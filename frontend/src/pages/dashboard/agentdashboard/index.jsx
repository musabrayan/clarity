import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentUser, selectUserId } from '@/redux/slice/user.slice';
import { useGetAgentRecordingsQuery, useUpdateTicketStatusMutation } from '@/redux/api/recordingsApi';
import { formatDuration } from '@/lib/formatters';
import RecordingSummaryDialog from '@/components/RecordingSummaryDialog';
import { Button } from '@/components/ui/button';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/shared/PageHeader';
import TableSkeleton from '@/components/shared/TableSkeleton';
import EmptyState from '@/components/shared/EmptyState';
import {
  Headphones, Phone, Mail, User, AlertCircle, FileText,
} from 'lucide-react';

const AgentDashboard = () => {
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);
  const userId = useSelector(selectUserId);
  const { data: recordings = [], isLoading, error: queryError } = useGetAgentRecordingsQuery(userId, { skip: !userId });
  const [updateTicketStatus] = useUpdateTicketStatusMutation();
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [error, setError] = useState(null);

  const handleUpdateTicketStatus = async (recordingSid, nextStatus) => {
    try {
      const result = await updateTicketStatus({ recordingSid, ticketStatus: nextStatus }).unwrap();
      if (!result.success) {
        setError(result.message || 'Failed to update ticket status');
      }
    } catch (err) {
      setError(err?.data?.message || 'Failed to update ticket status');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Dashboard"
        description="Manage your calls and support tickets"
        actions={
          <Button onClick={() => navigate('/agent/call')}>
            <Headphones className="mr-2 h-4 w-4" />
            Go Online
          </Button>
        }
      />

      {/* Profile & Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg">
                  {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">{currentUser?.fullName}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {currentUser?.username}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {currentUser?.email}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="ml-auto capitalize">
                {currentUser?.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-3xl font-bold">{recordings.length}</p>
              <p className="text-xs text-muted-foreground">Total Calls</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {(error || queryError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Failed to load call history'}</AlertDescription>
        </Alert>
      )}

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call History</CardTitle>
          <CardDescription>
            View and manage your support call recordings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton columns={6} rows={5} />
          ) : recordings.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No calls yet"
              description="Your call history will appear here once you start taking calls."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/agent/call')}
                >
                  Go Online
                </Button>
              }
            />
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Handled By</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Call Status</TableHead>
                    <TableHead>Ticket Status</TableHead>
                    <TableHead className="text-center">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordings.map((recording) => (
                    <TableRow key={recording.recordingSid}>
                      <TableCell className="whitespace-nowrap">
                        {recording.createdAt
                          ? new Date(recording.createdAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>{recording.customerName || 'Unknown'}</TableCell>
                      <TableCell>{recording.agentName || 'Unknown'}</TableCell>
                      <TableCell>{formatDuration(recording.duration)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {recording.status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={recording.ticketStatus || 'Pending'}
                          onValueChange={(value) => handleUpdateTicketStatus(recording.recordingSid, value)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        {recording.summary || recording.transcript || recording.bulletPoints?.length ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRecording(recording)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No summary</span>
                        )}
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

      {/* Call Summary Dialog */}
      <RecordingSummaryDialog
        recording={selectedRecording}
        onClose={() => setSelectedRecording(null)}
      />
    </div>
  );
};

export default AgentDashboard;