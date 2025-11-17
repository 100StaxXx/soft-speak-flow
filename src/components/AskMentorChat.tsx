import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Loader2, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskMentorChatProps {
  mentorName: string;
  mentorTone: string;
  hasActiveHabits?: boolean;
  hasActiveChallenges?: boolean;
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
  hasActiveHabits = false,
  hasActiveChallenges = false
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const hasProcessedInitialMessage = useRef(false);

  const DAILY_MESSAGE_LIMIT = 10;

  useEffect(() => {
    // Check today's message count
    const checkDailyLimit = async () => {
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('mentor_chats')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('role', 'user')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`);
      
      setDailyMessageCount(count || 0);
    };
    checkDailyLimit();
  }, [messages, user]);

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
  }, [location.state]);


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

  const sendMessage = async (text: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    // Check daily limit
    if (dailyMessageCount >= DAILY_MESSAGE_LIMIT) {
      toast({ 
        title: "Daily limit reached", 
        description: `You've reached your daily limit of ${DAILY_MESSAGE_LIMIT} messages. Reset tomorrow!`,
        variant: "destructive" 
      });
      return;
    }

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      console.log("Sending message to mentor-chat function:", { text, mentorName, mentorTone });
      
      const { data, error } = await supabase.functions.invoke("mentor-chat", {
        body: {
          message: text,
          mentorName,
          mentorTone,
          conversationHistory: messages.slice(-10)
        },
      });

      console.log("Mentor chat response:", { data, error });

      if (error) {
        console.error("Mentor chat error:", error);
        throw error;
      }

      if (!data || !data.response) {
        console.error("Invalid response from mentor-chat:", data);
        throw new Error("Invalid response from mentor");
      }

      const assistantMsg: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMsg]);

      // Increment daily count
      setDailyMessageCount(prev => prev + 1);

      await supabase.from('mentor_chats').insert([
        { user_id: user.id, role: 'user', content: text },
        { user_id: user.id, role: 'assistant', content: data.response }
      ]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
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
            Daily messages: {dailyMessageCount}/{DAILY_MESSAGE_LIMIT}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: DAILY_MESSAGE_LIMIT }).map((_, i) => (
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-tour="chat-history">
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
            <div className="font-semibold mb-1 text-sm">
              {msg.role === 'user' ? 'You' : mentorName}
            </div>
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          </Card>
        ))}

        {isLoading && (
          <Card className="p-4 mr-8">
            <div className="font-semibold mb-1 text-sm">{mentorName}</div>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Card>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t" data-tour="chat-input">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};