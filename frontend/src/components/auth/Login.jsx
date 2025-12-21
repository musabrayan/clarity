import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../redux/authApi';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Label } from '../ui/label';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [login] = useLoginMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login({ username, password }).unwrap();
      localStorage.setItem('userRole', response.role);
      localStorage.setItem('username', response.username);
      const role = response.role;
      role === 'USER' ? navigate('/user-dashboard') : navigate('/agent-dashboard');
    } catch (err) {
      setError(err?.data?.detail || err?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">Login</h1>
            <p className="text-sm">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="p-3 text-sm text-destructive">{error}</div>}

            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className='hover:cursor-pointer'
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
