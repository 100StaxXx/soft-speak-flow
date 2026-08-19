import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, WifiOff, AlertCircle } from "lucide-react";
import { MentorResponseLoader } from "./MentorResponseLoader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasActiveSupabaseFunctionSession } from "@/services/supabaseFunctionSession";
import {
  resolveMentorSlugAlias,
  type ActiveMentorSlug,
} from "@/lib/mentorRoster";
import { cn } from "@/lib/utils";
import { getFallbackResponse, getConnectionErrorFallback } from "@/utils/mentorFallbacks";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import { MentorChatFeedback } from "./MentorChatFeedback";
import { PRODUCT, type ProductMode } from "@/config/product";

interface Message {
  role: "user" | "assistant";
  content: string;
  isFallback?: boolean;
}

// Maximum dots to show in the visual indicator to prevent layout issues
const MAX_VISUAL_INDICATOR_DOTS = 15;
const DEFAULT_DAILY_LIMIT = 20;

const GRACEWARD_GUIDE_PROMPTS: Record<
  ActiveMentorSlug,
  readonly [string, string, string]
> = {
  sage: [
    "Help me slow down and sort through what's weighing on me",
    "Ask me a reflection question for today",
    "Help me notice one faithful next step",
  ],
  lyra: [
    "Help me sort what matters from what is noise",
    "Ask me questions to help me make a wise decision",
    "Help me understand a pattern I keep repeating",
  ],
  icon: [
    "Help me decide whether I need a boundary",
    "Help me say something honest and gracious",
    "Help me make a choice that fits my values",
  ],
  charles: [
    "Help me name what I'm avoiding",
    "Give me one small action to take now",
    "Hold me accountable without shaming me",
  ],
  princess: [
    "Help me create a gentle rhythm for today",
    "Help me make room for prayer, work, and rest",
    "Help me restart after falling out of a routine",
  ],
  operator: [
    "Help me turn today's responsibilities into a realistic plan",
    "Help me decide what to do first",
    "Help me use my time and energy wisely",
  ],
  rival: [
    "Help me face something I've been avoiding",
    "Challenge me to take one courageous next step",
    "Help me keep going when I want to quit",
  ],
};

const COSMIQ_MENTOR_PROMPTS: Record<
  ActiveMentorSlug,
  readonly [string, string, string]
> = {
  sage: [
    "Help me slow down and sort through what's weighing on me",
    "Ask me a reflection question for today",
    "Help me notice one useful next step",
  ],
  lyra: [
    "Help me sort what matters from what is noise",
    "Ask me questions to help me make a wise decision",
    "Help me understand a pattern I keep repeating",
  ],
  icon: [
    "Help me decide whether I need a boundary",
    "Help me say something honest and constructive",
    "Help me make a choice that fits my values",
  ],
  charles: [
    "Help me name what I'm avoiding",
    "Give me one small action to take now",
    "Hold me accountable without shaming me",
  ],
  princess: [
    "Help me create a gentle rhythm for today",
    "Help me make room for focus, care, and rest",
    "Help me restart after falling out of a routine",
  ],
  operator: [
    "Help me turn today's responsibilities into a realistic plan",
    "Help me decide what to do first",
    "Help me use my time and energy wisely",
  ],
  rival: [
    "Help me face something I've been avoiding",
    "Challenge me to take one courageous next step",
    "Help me keep going when I want to quit",
  ],
};

interface AskMentorChatProps {
  mentorName: string;
  mentorTone: string;
  mentorSlug?: string;
  mentorId?: string;
  hasActiveHabits?: boolean;
  hasActiveChallenges?: boolean;
  briefingContext?: string;
  comprehensiveMode?: boolean;
}

export const getSmartPrompts = (
  mentorSlug: string | undefined,
  mentorTone: string,
  hasActiveHabits: boolean,
  hasActiveChallenges: boolean,
  productMode: ProductMode = PRODUCT.mode,
): string[] => {
  const hour = new Date().getHours();
  const resolvedSlug = resolveMentorSlugAlias(mentorSlug);
  const isTough = /tough|direct/i.test(mentorTone);
  const isEmpathetic = /empathetic|supportive/i.test(mentorTone);

  if (resolvedSlug && resolvedSlug !== "reign") {
    return [
      ...(productMode === "christian"
        ? GRACEWARD_GUIDE_PROMPTS[resolvedSlug]
        : COSMIQ_MENTOR_PROMPTS[resolvedSlug]),
    ];
  }
  
  const prompts: string[] = [];
  
  if (hour >= 5 && hour < 12) {
    prompts.push(
      productMode === "christian"
        ? "Help me begin today with prayer and purpose"
        : "Help me begin today with clarity and purpose",
      "What matters most today?",
    );
  } else if (hour >= 12 && hour < 17) {
    prompts.push("Help me reset for the rest of today", "What needs my attention next?");
  } else {
    prompts.push("Help me reflect honestly on today", "Help me release today and prepare for tomorrow");
  }
  
  if (isTough) {
    prompts.push("Tell me honestly what I may be avoiding");
  } else if (isEmpathetic) {
    prompts.push(
      productMode === "christian"
        ? "Help me receive grace and take one small step"
        : "Help me reset gently and take one small step",
    );
  } else {
    prompts.push(
      productMode === "christian"
        ? "Help me choose one faithful next step"
        : "Help me choose one meaningful next step",
    );
  }
  
  if (hasActiveHabits || hasActiveChallenges) {
    prompts.push(
      hasActiveHabits
        ? productMode === "christian"
          ? "Help me practice steady faithfulness"
          : "Help me practice steady consistency"
        : "Help me keep going with courage",
    );
  } else {
    prompts.push(
      productMode === "christian"
        ? "Help me discern what I need today"
        : "Help me understand what I need today",
    );
  }
  
  return [
    ...prompts.slice(0, 2),
    ...prompts.slice(2).sort(() => Math.random() - 0.5),
  ].slice(0, 3);
};

export const AskMentorChat = ({ 
  mentorName, 
  mentorTone,
  mentorSlug,
  mentorId,
  hasActiveHabits = false,
  hasActiveChallenges = false,
  briefingContext,
  comprehensiveMode = false
}: AskMentorChatProps) => {
  const { user, refreshSession } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT); // Server provides the actual limit
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasProcessedInitialMessage = useRef(false);
  
  // Use ref for messages to avoid stale closure in sendMessage callback
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (text: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    const hasSession = await hasActiveSupabaseFunctionSession(refreshSession);
    if (!hasSession) {
      toast({
        title: "Session expired",
        description: "Please sign in again to chat with your guide.",
        variant: "destructive",
      });
      return;
    }

    // Check daily limit
    if (dailyMessageCount >= dailyLimit) {
      toast({ 
        title: "Daily limit reached", 
        description: `You've reached your daily limit of ${dailyLimit} messages. It resets at 00:00 UTC.`,
        variant: "destructive" 
      });
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Use ref to get fresh conversation history (avoids stale closure)
      const currentMessages = messagesRef.current;
      
      const { data, error } = await supabase.functions.invoke("mentor-chat", {
        body: {
          message: text,
          mentorName,
          mentorTone,
          mentorSlug,
          conversationHistory: currentMessages.slice(-10),
          comprehensiveMode,
          briefingContext,
        },
      });

      if (error) throw error;

      if (!data || !data.response) {
        throw new Error("Invalid response from guide");
      }

      const assistantMsg: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update limit from server if provided
      if (typeof data.dailyLimit === 'number' && Number.isFinite(data.dailyLimit)) {
        setDailyLimit(data.dailyLimit);
      }
      
      // Use server's count if available, otherwise increment locally
      if (data.messagesUsed !== undefined) {
        setDailyMessageCount(data.messagesUsed);
      } else {
        setDailyMessageCount(prev => prev + 1);
      }

      // Save conversation history (non-blocking - don't fail if this errors)
      // Only save if mentorId is defined to maintain data integrity
      if (mentorId) {
        void supabase.from('mentor_chats').insert([
          { user_id: user.id, mentor_id: mentorId, role: 'user', content: text },
          { user_id: user.id, mentor_id: mentorId, role: 'assistant', content: data.response }
        ]).then(({ error }) => { if (error) console.error('Failed to save chat history:', error); });
      }
    } catch (error) {
      console.error("Mentor chat error:", error);
      const parsedError = await parseFunctionInvokeError(error);
      const parsedMessage =
        parsedError.responsePayload?.message ??
        parsedError.responsePayload?.error ??
        parsedError.message;
      const parsedCode = parsedError.code ?? parsedError.responsePayload?.code;
      const isDailyGuideLimit =
        parsedCode === "DAILY_GUIDE_LIMIT_REACHED" ||
        parsedMessage?.toLowerCase().includes("daily limit reached") === true;
      const isTemporaryGuideFailure =
        parsedError.category === "rate_limit" ||
        parsedCode === "GUIDE_REQUEST_LIMITED" ||
        parsedCode === "GUIDE_PROVIDER_RATE_LIMITED" ||
        parsedCode === "GUIDE_PROVIDER_UNAVAILABLE";

      // Server-side cap reached: show authoritative message and do not generate fallback.
      if (parsedError.status === 429 && isDailyGuideLimit) {
        toast({
          title: "Daily limit reached",
          description: parsedMessage || `You've reached your daily limit of ${dailyLimit} messages. It resets at 00:00 UTC.`,
          variant: "destructive"
        });
        setDailyMessageCount(dailyLimit);
        setMessages((prev) => prev.filter((_, index) => index !== prev.length - 1));
        return;
      }

      // Use fallback response instead of just showing error
      const fallback = isOnline
        ? getFallbackResponse(text, mentorName, mentorTone)
        : getConnectionErrorFallback(mentorName);

      const fallbackMsg: Message = {
        role: "assistant",
        content: fallback.content,
        isFallback: true
      };
      setMessages((prev) => [...prev, fallbackMsg]);

      // Show subtle notification that fallback was used
      toast({
        title: isTemporaryGuideFailure ? "Guide is temporarily busy" : "Connection issue",
        description: isTemporaryGuideFailure
          ? "Your daily allowance is still available. Showing a short reflection while live replies recover."
          : "Live reply unavailable. Showing fallback guidance.",
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  }, [dailyMessageCount, dailyLimit, toast, mentorName, mentorTone, mentorSlug, mentorId, isOnline, comprehensiveMode, briefingContext, refreshSession, user]);

  useEffect(() => {
    // Check today's message count on mount only
    // The count is updated via server response in sendMessage, no need to recheck after each message
    const checkDailyLimit = async () => {
      if (!user) return;

      // Match server-side counting window (UTC day) for consistent limits.
      const startOfDayUtc = new Date();
      startOfDayUtc.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('mentor_chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('role', 'user')
        .gte('created_at', startOfDayUtc.toISOString());
      
      setDailyMessageCount(count || 0);
    };
    checkDailyLimit();
  }, [user]); // Only run on mount and user change, not on every message

  useEffect(() => {
    setSuggestedPrompts(getSmartPrompts(mentorSlug, mentorTone, hasActiveHabits, hasActiveChallenges));
  }, [mentorSlug, mentorTone, hasActiveHabits, hasActiveChallenges]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle initial message from navigation state
  useEffect(() => {
    const initialMessage = location.state?.initialMessage;
    if (initialMessage && !hasProcessedInitialMessage.current) {
      hasProcessedInitialMessage.current = true;
      setShowSuggestions(false);
      sendMessage(initialMessage);
    }
  }, [location.state, sendMessage]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setShowSuggestions(false);
    sendMessage(suggestion);
  };


  return (
    <div className="flex flex-col h-full">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Live guide replies are unavailable; fallback guidance is shown.</span>
        </div>
      )}
      
      {/* Message Limit Indicator */}
      <div className="rounded-2xl border border-border/60 bg-card/[0.88] px-4 pb-2 pt-3 shadow-soft backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground/75">
            Daily messages: {dailyMessageCount}/{dailyLimit}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(dailyLimit, MAX_VISUAL_INDICATOR_DOTS) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-3 rounded-full transition-colors",
                  i < dailyMessageCount ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && showSuggestions && (
          <div className="space-y-4">
            <p className="rounded-full bg-card/[0.88] px-4 py-2 text-center text-sm font-medium text-foreground/75 shadow-soft backdrop-blur-xl">
              Choose a prompt or type your own message
            </p>
            <div className="grid gap-2">
              {suggestedPrompts.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="h-auto min-w-0 justify-start whitespace-normal break-words bg-card/[0.88] px-4 py-3 text-left leading-5 shadow-soft backdrop-blur-xl hover:bg-card active:bg-primary/10"
                  onClick={() => handleSuggestionClick(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <Card key={idx} className={`p-4 ${msg.role === 'user' ? 'ml-8 bg-primary/10' : 'mr-8'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-sm">
                {msg.role === 'user' ? 'You' : mentorName}
              </div>
              {msg.isFallback && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  <span>Offline mode</span>
                </div>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            {/* Feedback buttons for assistant messages */}
            {msg.role === 'assistant' && !msg.isFallback && (
              <MentorChatFeedback messageContent={msg.content} />
            )}
          </Card>
        ))}

        {isLoading && (
          <Card className="p-4 mr-8">
            <MentorResponseLoader mentorName={mentorName} />
          </Card>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
