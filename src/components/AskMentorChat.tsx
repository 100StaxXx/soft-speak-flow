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
import { cn } from "@/lib/utils";
import { getFallbackResponse, getConnectionErrorFallback } from "@/utils/mentorFallbacks";
import { MentorChatFeedback } from "./MentorChatFeedback";

interface Message {
  role: "user" | "assistant";
  content: string;
  isFallback?: boolean;
}

// Maximum dots to show in the visual indicator to prevent layout issues
const MAX_VISUAL_INDICATOR_DOTS = 15;

interface AskMentorChatProps {
  mentorName: string;
  mentorTone: string;
  mentorId?: string;
  hasActiveHabits?: boolean;
  hasActiveChallenges?: boolean;
  briefingContext?: string;
  comprehensiveMode?: boolean;
}

const getSmartPrompts = (
  mentorTone: string,
  hasActiveHabits: boolean,
  hasActiveChallenges: boolean
): string[] => {
  const hour = new Date().getHours();
  const isTough = /tough|direct/i.test(mentorTone);
  const isEmpathetic = /empathetic|supportive/i.test(mentorTone);
  
  const prompts = [];
  
  if (hour >= 5 && hour < 12) {
    prompts.push("Help me start my day strong", "What should I focus on today?");
  } else if (hour >= 12 && hour < 17) {
    prompts.push("I need an afternoon boost", "Keep me on track");
  } else {
    prompts.push("Help me reflect on today", "Prepare me for tomorrow");
  }
  
  if (isTough) {
    prompts.push("Give me the hard truth");
  } else if (isEmpathetic) {
    prompts.push("I need some encouragement");
  } else {
    prompts.push("Give me a pep talk");
  }
  
  if (hasActiveHabits || hasActiveChallenges) {
    prompts.push(hasActiveHabits ? "Help me stay consistent" : "Keep me motivated");
  } else {
    prompts.push("Help me build better habits");
  }
  
  return prompts.sort(() => Math.random() - 0.5).slice(0, 3);
};

export const AskMentorChat = ({ 
  mentorName, 
  mentorTone,
  mentorId,
  hasActiveHabits = false,
  hasActiveChallenges = false,
  briefingContext,
  comprehensiveMode = false
}: AskMentorChatProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [dailyMessageCount, setDailyMessageCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dailyLimit, setDailyLimit] = useState(10); // Server provides the actual limit
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasProcessedInitialMessage = useRef(false);
  
  // Use ref for messages to avoid stale closure in sendMessage callback
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (text: string) => {
    // Verify user is still authenticated
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    // Check daily limit
    if (dailyMessageCount >= dailyLimit) {
      toast({ 
        title: "Daily limit reached", 
        description: `You've reached your daily limit of ${dailyLimit} messages. Reset tomorrow!`,
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
          conversationHistory: currentMessages.slice(-10),
          comprehensiveMode,
          briefingContext,
        },
      });

      if (error) throw error;

      if (!data || !data.response) {
        throw new Error("Invalid response from mentor");
      }

      const assistantMsg: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update limit from server if provided
      if (data.dailyLimit) {
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
          { user_id: currentUser.id, mentor_id: mentorId, role: 'user', content: text },
          { user_id: currentUser.id, mentor_id: mentorId, role: 'assistant', content: data.response }
        ]).then(({ error }) => { if (error) console.error('Failed to save chat history:', error); });
      }
    } catch (error) {
      console.error("Mentor chat error:", error);

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
        title: "Connection issue",
        description: "Using offline response. Your message was saved.",
        duration: 3000
      });

      // Still increment count and save to history
      setDailyMessageCount(prev => prev + 1);

      // Save both messages even with fallback (non-blocking)
      // Only save if mentorId is defined to maintain data integrity
      if (mentorId) {
        void supabase.from('mentor_chats').insert([
          { user_id: currentUser.id, mentor_id: mentorId, role: 'user', content: text },
          { user_id: currentUser.id, mentor_id: mentorId, role: 'assistant', content: fallback.content }
        ]).then(({ error }) => { if (error) console.error('Failed to save fallback chat:', error); });
      }
    } finally {
      setIsLoading(false);
    }
  }, [dailyMessageCount, dailyLimit, toast, mentorName, mentorTone, mentorId, isOnline, comprehensiveMode, briefingContext]);

  useEffect(() => {
    // Check today's message count on mount only
    // The count is updated via server response in sendMessage, no need to recheck after each message
    const checkDailyLimit = async () => {
      if (!user) return;

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const { count } = await supabase
        .from('mentor_chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('role', 'user')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      setDailyMessageCount(count || 0);
    };
    checkDailyLimit();
  }, [user]); // Only run on mount and user change, not on every message

  useEffect(() => {
    setSuggestedPrompts(getSmartPrompts(mentorTone, hasActiveHabits, hasActiveChallenges));
  }, [mentorTone, hasActiveHabits, hasActiveChallenges]);

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
          <span>You're offline. Messages will be sent when you reconnect.</span>
        </div>
      )}
      
      {/* Message Limit Indicator */}
      <div className="px-4 pt-3 pb-2 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
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
            <p className="text-muted-foreground text-center">
              Choose a prompt or type your own message
            </p>
            <div className="grid gap-2">
              {suggestedPrompts.map((prompt, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="justify-start text-left h-auto py-3 px-4 hover:bg-accent"
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