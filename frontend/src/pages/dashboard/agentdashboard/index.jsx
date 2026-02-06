import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import Navbar from '@/components/shared/Navbar';
import API_URL from '@/config';

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?._id) return;

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `${API_URL}/api/v1/call/recordings/agent/${currentUser._id}`,
          { credentials: 'include', cache: 'no-store' }
        );

        if (!res.ok) {
          setError('Failed to load call history');
          setRecordings([]);
          return;
        }
        const data = await res.json();

        if (!data.success) {
          setError(data.message || 'Failed to load call history');
          setRecordings([]);
          return;
        }

        setRecordings(data.recordings || []);
      } catch (err) {
        setError(err.message || 'Failed to load call history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [currentUser?._id]);

  const formatDuration = (value) => {
    const seconds = Number(value || 0);
    if (!Number.isFinite(seconds)) return '-';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const updateTicketStatus = async (recordingSid, nextStatus) => {
    const previous = recordings;
    setRecordings((items) => items.map((item) => (
      item.recordingSid === recordingSid
        ? { ...item, ticketStatus: nextStatus }
        : item
    )));

    try {
      const res = await fetch(
        `${API_URL}/api/v1/call/recordings/${recordingSid}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ticketStatus: nextStatus }),
        }
      );
      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'Failed to update ticket status');
        setRecordings(previous);
      }
    } catch (err) {
      setError(err.message || 'Failed to update ticket status');
      setRecordings(previous);
    }
  };

  

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-6 space-y-6 mt-20">
        <h1 className="text-3xl font-bold">Agent Dashboard</h1>
      
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/agent/call')} size="lg">
            Go Online & Take Calls
          </Button>
        </CardContent>
      </Card>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Name:</strong> {currentUser?.fullName}</p>
          <p><strong>Username:</strong> {currentUser?.username}</p>
          <p><strong>Email:</strong> {currentUser?.email}</p>
        </CardContent>
      </Card>

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle>Call History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading call history...</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {!isLoading && !error && recordings.length === 0 && (
            <p className="text-sm text-muted-foreground">No calls yet.</p>
          )}

          {!isLoading && !error && recordings.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Call Status</TableHead>
                  <TableHead>Ticket Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordings.map((recording) => (
                  <TableRow key={recording.recordingSid}>
                    <TableCell>
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
                        onValueChange={(value) => updateTicketStatus(recording.recordingSid, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
};

export default AgentDashboard;