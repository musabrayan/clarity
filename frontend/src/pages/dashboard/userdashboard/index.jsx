import React, { useEffect, useMemo, useState } from 'react';
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
import Navbar from '@/components/shared/Navbar';
import API_URL from '@/config';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusBadgeVariant = useMemo(() => ({
    Pending: 'secondary',
    Resolved: 'default',
    Closed: 'outline',
  }), []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?._id) return;

      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `${API_URL}/api/v1/call/recordings/user/${currentUser._id}`,
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

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-6 space-y-6 mt-20">
        <h1 className="text-3xl font-bold">Customer Dashboard</h1>
      
      {/* Quick Call Action */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate('/customer/call')} size="lg">
            Call Support Agent
          </Button>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Name:</strong> {currentUser?.fullName}</p>
          <p><strong>Email:</strong> {currentUser?.email}</p>
          <p><strong>Phone:</strong> {currentUser?.phoneNumber}</p>
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
                      <Badge variant={statusBadgeVariant[recording.ticketStatus] || 'secondary'}>
                        {recording.ticketStatus || 'Pending'}
                      </Badge>
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

export default UserDashboard;