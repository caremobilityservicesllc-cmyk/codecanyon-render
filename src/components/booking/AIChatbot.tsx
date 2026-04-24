import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-booking-chat`;

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const appName = businessInfo.companyName || 'RideFlow';
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! 👋 I'm your AI assistant. I can help you book a ride, get fare estimates, or answer questions about our service. How can I assist you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Track unread messages when minimized
  useEffect(() => {
    if (isMinimized && messages.length > prevMessagesLengthRef.current) {
      const newMessages = messages.slice(prevMessagesLengthRef.current);
      const assistantMessages = newMessages.filter(m => m.role === 'assistant').length;
      setUnreadCount(prev => prev + assistantMessages);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isMinimized]);

  // Clear unread when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setUnreadCount(0);
    }
  }, [isOpen, isMinimized]);

  const streamChat = useCallback(async (userMessage: string) => {
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => ({}));
        const isRateLimit = resp.status === 429;
        const message = isRateLimit
          ? (t as any).aiChatbot?.rateLimitError || '🕐 The AI assistant is busy right now. Please wait a moment and try again.'
          : errorData.error || 'Failed to connect to AI';
        throw new Error(message);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';
      let streamDone = false;

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 
        ((t as any).aiChatbot?.connectionError || `I'm sorry, I'm having trouble connecting right now. Please try again in a moment or contact our support team.`);
      setMessages((prev) => {
        // Remove the empty assistant message if it was added
        const cleaned = prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === ''
          ? prev.slice(0, -1)
          : prev;
        return [
          ...cleaned,
          { role: 'assistant', content: errorMessage },
        ];
      });
    }

    setIsLoading(false);
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    streamChat(userMessage);
  };

  const ac = (t as any).aiChatbot || {};
  const quickActions = [
    { label: ac.bookARide || 'Book a ride', message: ac.bookARideMsg || 'I want to book a ride' },
    { label: ac.getFareEstimate || 'Get fare estimate', message: ac.getFareEstimateMsg || 'Can you give me a fare estimate?' },
    { label: ac.vehicleOptions || 'Vehicle options', message: ac.vehicleOptionsMsg || 'What vehicles do you have?' },
  ];

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
    setUnreadCount(0);
  };

  return (
    <>
      {/* Floating Button - show when closed */}
      <Button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110',
          'bg-gradient-to-r from-primary to-accent text-primary-foreground',
          (isOpen || isMinimized) && 'scale-0 opacity-0'
        )}
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
      </Button>

      {/* Minimized Indicator */}
      <button
        onClick={handleRestore}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105',
          isMinimized ? 'scale-100 opacity-100' : 'pointer-events-none scale-0 opacity-0'
        )}
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">{appName} AI</span>
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      <div
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-300',
          'bottom-0 right-0 h-full w-full sm:bottom-6 sm:right-6 sm:h-[500px] sm:w-[380px] sm:rounded-2xl',
          isOpen && !isMinimized ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary to-accent p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-foreground">{appName} AI</h3>
              <p className="text-xs text-primary-foreground/80">{ac.bookingAssistant || 'Your booking assistant'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMinimize}
              className="text-primary-foreground hover:bg-primary-foreground/20"
              title={ac.minimize || 'Minimize'}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
              title={ac.close || 'Close'}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl bg-secondary px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        {messages.length <= 2 && (
          <div className="flex gap-2 overflow-x-auto border-t border-border bg-card p-3 pb-safe">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="shrink-0 text-xs bg-background text-foreground border-border hover:bg-secondary whitespace-nowrap"
                onClick={() => streamChat(action.message)}
                disabled={isLoading}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-border p-4 pb-safe">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ac.typeAMessage || 'Type a message...'}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
