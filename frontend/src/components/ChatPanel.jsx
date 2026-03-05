import React, { useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/redux/slice/user.slice';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Bot, Trash2 } from 'lucide-react';

const DUMMY_REPLIES = [
  "Thanks for reaching out! An agent will be with you shortly.",
  "Could you provide more details so we can help you faster?",
  "We're looking into this — hang tight!",
  "Is there anything else I can help you with?",
  "Your issue has been noted. We'll follow up soon.",
];

const pickReply = () =>
  DUMMY_REPLIES[Math.floor(Math.random() * DUMMY_REPLIES.length)];

export default function ChatPanel() {
  const currentUser = useSelector(selectCurrentUser);
  const [messages, setMessages] = useState([
    { id: crypto.randomUUID(), role: 'bot', text: 'Hi there! How can we help you today?' },
  ]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text }]);
    setDraft('');

    setTimeout(() => {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'bot', text: pickReply() }]);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 800);
  }, [draft]);

  return (
    <Card id="chat-section">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Support Chat
          </CardTitle>
          <CardDescription>
            This is a demo chat — messages are not sent to a real agent.
          </CardDescription>
        </div>
        {messages.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              setMessages([{ id: crypto.randomUUID(), role: 'bot', text: 'Hi there! How can we help you today?' }])
            }
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages area */}
        <ScrollArea className="h-[350px] px-4 pt-2 pb-4">
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'bot' && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-blue-500/10 text-blue-500 text-xs">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.role === 'user' && (
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-xs">
                      {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t px-4 py-3">
          <Input
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1"
          />
          <Button size="icon" onClick={sendMessage} disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
