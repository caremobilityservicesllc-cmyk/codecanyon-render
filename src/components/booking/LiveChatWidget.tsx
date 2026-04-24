import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  status?: MessageStatus;
}

interface LiveChatWidgetProps {
  bookingReference?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  className?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-booking-chat`;

async function streamChat({
  messages,
  context,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  context?: object;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, context }),
    });

    if (resp.status === 429) {
      onError("tooManyRequests");
      return;
    }
    if (resp.status === 402) {
      onError("aiUnavailable");
      return;
    }
    if (!resp.ok || !resp.body) {
      onError("failedToConnect");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    onError("connectionError");
  }
}

function MessageStatusIndicator({ status }: { status?: MessageStatus }) {
  if (!status) return null;

  switch (status) {
    case 'sending':
      return <Loader2 className="h-3 w-3 animate-spin text-primary-foreground/50" />;
    case 'sent':
      return <Check className="h-3 w-3 text-primary-foreground/50" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-primary-foreground/50" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    default:
      return null;
  }
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function LiveChatWidget({ bookingReference, pickupLocation, dropoffLocation, className }: LiveChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { businessInfo } = useSystemSettings();
  const { t } = useLanguage();
  const lc = (t as any).liveChat || {};
  const appName = businessInfo.companyName || 'RideFlow';
  
  const QUICK_REPLIES = [
    lc.whereIsMyDriver || 'Where is my driver?',
    lc.changePickupLocation || 'Change pickup location',
    lc.cancelBooking || 'Cancel booking',
    lc.contactSupport || 'Contact support',
  ];

  const getGreeting = () => {
    const base = lc.greeting || "Hi! 👋 I'm your AI assistant. How can I help you";
    if (bookingReference) {
      return `${base} ${(lc.greetingWithBooking || 'with booking **{ref}**').replace('{ref}', bookingReference)}?`;
    }
    return `${base} ${lc.greetingDefault || 'today'}?`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: getGreeting(),
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.role === 'user' && msg.status !== 'read' 
            ? { ...msg, status: 'read' as MessageStatus }
            : msg
        ));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, messages]);

  const getErrorMessage = (errorKey: string) => {
    const errorMessages: Record<string, string> = {
      tooManyRequests: lc.tooManyRequests || "Too many requests. Please wait a moment and try again.",
      aiUnavailable: lc.aiUnavailable || "AI service temporarily unavailable. Please try again later.",
      failedToConnect: lc.failedToConnect || "Failed to connect to AI assistant.",
      connectionError: lc.connectionError || "Connection error. Please try again.",
    };
    return errorMessages[errorKey] || errorKey;
  };

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'sent' as MessageStatus } : msg
      ));
    }, 200);

    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: 'delivered' as MessageStatus } : msg
      ));
    }, 500);

    setShowTyping(true);
    setIsStreaming(true);

    const chatHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    chatHistory.push({ role: 'user', content: content.trim() });

    const context = bookingReference ? {
      currentBooking: {
        reference: bookingReference,
        pickupLocation,
        dropoffLocation,
      }
    } : undefined;

    let assistantContent = "";
    let hasStartedStreaming = false;

    const upsertAssistant = (chunk: string) => {
      if (!hasStartedStreaming) {
        hasStartedStreaming = true;
        setShowTyping(false);
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'read' as MessageStatus } : msg
        ));
      }
      
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id.startsWith("stream-")) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantContent } : m
          );
        }
        return [
          ...prev,
          {
            id: `stream-${Date.now()}`,
            content: assistantContent,
            role: "assistant" as const,
            timestamp: new Date(),
          },
        ];
      });
    };

    await streamChat({
      messages: chatHistory,
      context,
      onDelta: upsertAssistant,
      onDone: () => {
        setIsStreaming(false);
        setShowTyping(false);
      },
      onError: (errorKey) => {
        setIsStreaming(false);
        setShowTyping(false);
        toast.error(getErrorMessage(errorKey));
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            content: lc.errorFallback || "Sorry, I'm having trouble connecting right now. Please try again in a moment or contact our support team.",
            role: "assistant",
            timestamp: new Date(),
          },
        ]);
      },
    });
  }, [messages, isStreaming, bookingReference, pickupLocation, dropoffLocation, lc]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const unreadCount = messages.filter(m => m.role === 'assistant' && !isOpen).length;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className={cn(
            "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
            "bg-primary hover:bg-primary/90",
            "animate-in slide-in-from-bottom-4 duration-300",
            className
          )}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      )}

      {isOpen && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border bg-background shadow-2xl",
          "animate-in slide-in-from-bottom-4 duration-300"
        )}>
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">{appName} AI</h3>
                <p className="text-xs text-primary-foreground/80">
                  {isStreaming || showTyping ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                      {lc.typing || 'typing...'}
                    </span>
                  ) : (
                    lc.online || 'Online'
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  )}>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    <div className={cn(
                      "mt-1 flex items-center gap-1 text-[10px]",
                      message.role === 'user' 
                        ? "justify-end text-primary-foreground/70" 
                        : "text-muted-foreground"
                    )}>
                      <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {message.role === 'user' && (
                        <MessageStatusIndicator status={message.status} />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {showTyping && <TypingIndicator label={lc.typing || 'typing...'} />}
            </div>
          </ScrollArea>

          <div className="flex flex-wrap gap-2 border-t px-4 py-2">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                onClick={() => handleSend(reply)}
                disabled={isStreaming}
                className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {reply}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="border-t p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={lc.typeMessage || 'Type a message...'}
                className="flex-1 rounded-full"
                disabled={isStreaming}
              />
              <Button
                type="submit"
                size="icon"
                className="rounded-full"
                disabled={!input.trim() || isStreaming}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
