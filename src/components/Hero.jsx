import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button } from './ui/button';
import { MessageSquare } from 'lucide-react';

export default function Hero() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const currentUser = useSelector((state) => state.auth.user);

  const isUser = currentUser?.role === 'USER';

  const handleGoToChat = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/dashboard');
  };

  return (
    <main className="flex flex-1 items-center">
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-12 py-24">
        <div className="flex flex-col items-center text-center gap-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight max-w-3xl">
            Intelligent Call Center System
          </h1>

          <p className="text-muted-foreground max-w-2xl text-base sm:text-lg">
            AI-powered call routing, real-time transcription, and intelligent
            summaries designed to improve agent efficiency and customer experience.
          </p>

          {isAuthenticated && isUser && (
            <div className="mt-4">
              <Button
                onClick={handleGoToChat}
                size="lg"
                className="text-base px-8"
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                Chat with an Agent
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
