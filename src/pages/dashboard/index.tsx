import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';

const Dashboard = () => {
  const navigate = useNavigate();
  const { role, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Redirect based on role
    if (role === 'user') {
      navigate('/dashboard/user');
    } else if (role === 'agent') {
      navigate('/dashboard/agent');
    } else {
      // If role is not recognized, redirect to login
      navigate('/login');
    }
  }, [role, isAuthenticated, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
};

export default Dashboard;
