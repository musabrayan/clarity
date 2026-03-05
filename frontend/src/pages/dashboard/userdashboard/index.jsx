import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectCurrentUser } from '@/redux/slice/user.slice';
import BugReportDialog from '@/components/BugReportDialog';
import ChatPanel from '@/components/ChatPanel';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import { Phone, MessageCircle } from 'lucide-react';

const UserDashboard = () => {
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${currentUser?.fullName?.split(' ')[0] || 'Customer'}`}
        description="Get support, report issues, or chat with us"
      />

      {/* ---- Action Cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Call Support */}
        <Card className="flex flex-col items-center text-center p-6 gap-3 hover:shadow-md transition-shadow">
          <div className="rounded-full bg-primary/10 p-4">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-base">Call Support</CardTitle>
          <CardDescription className="text-xs">
            Speak directly with an available agent
          </CardDescription>
          <Button className="mt-auto w-full" onClick={() => navigate('/customer/call')}>
            Start Call
          </Button>
        </Card>

        {/* Report a Bug */}
        <BugReportDialog />

        {/* Chat (scroll-to) */}
        <Card
          className="flex flex-col items-center text-center p-6 gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() =>
            document.getElementById('chat-section')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <div className="rounded-full bg-blue-500/10 p-4">
            <MessageCircle className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-base">Live Chat</CardTitle>
          <CardDescription className="text-xs">
            Chat with our support bot instantly
          </CardDescription>
          <Button variant="secondary" className="mt-auto w-full">
            Open Chat
          </Button>
        </Card>
      </div>

      {/* ---- Chat Interface ---- */}
      <ChatPanel />
    </div>
  );
};

export default UserDashboard;