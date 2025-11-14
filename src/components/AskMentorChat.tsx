import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskMentorChatProps {
  mentorName: string;
  mentorTone: string;
}

const SUGGESTED_PROMPTS = [
  "I'm struggling to stay consistent",
  "How do I stop procrastinating?",
  "Give me a confidence boost",
  "Help me get back on track",
  "I'm feeling overwhelmed",
];

export const AskMentorChat = ({ mentorName, mentorTone }: AskMentorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("mentor-chat", {
        body: {
          messages: [...messages, userMessage],
          mentorName,
          mentorTone,
        },
      });

      if (error) {
        if (error.message?.includes("429")) {
          toast({
            title: "Rate limit exceeded",
            description: "Please wait a moment before sending another message.",
            variant: "destructive",
          });
        } else if (error.message?.includes("402")) {
          toast({
            title: "Credits required",
            description: "Please add credits to continue using AI features.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLilPush = async () => {
    await handleSend("Give me a lil push to stay motivated today");
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border p-5 md:p-6 h-[400px] md:h-[500px] flex flex-col shadow-medium">
      <h3 className="text-lg md:text-xl font-heading font-black text-foreground mb-4">
        Ask {mentorName} Anything
      </h3>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-hide">
        {messages.length === 0 && showSuggestions && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground text-center">What do you need a lil push on?</p>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(prompt)}
                  className="text-left justify-start h-auto py-3 px-4 hover:bg-primary/10 hover:border-primary/50 whitespace-normal"
                >
                  <span className="text-xs">{prompt}</span>
                </Button>
              ))}
            </div>
            <Button
              onClick={handleLilPush}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 font-bold"
            >
              Lil Push of the Day
            </Button>
          </div>
        )}
        {messages.length === 0 && !showSuggestions && (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground text-center py-8 text-sm italic max-w-xs">
              Your motivator is ready to guide you. Ask anything...
            </p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-velocity-fade-in`}
          >
            <div
              className={`max-w-[85%] md:max-w-[80%] rounded-xl p-3 md:p-4 ${
                message.role === "user"
                  ? "bg-primary/15 border border-primary/30 text-foreground"
                  : "bg-secondary/80 border border-border text-foreground"
              }`}
            >
              <p className="leading-relaxed text-sm md:text-base break-words">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start animate-velocity-fade-in">
            <div className="bg-secondary/80 border border-border rounded-xl p-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type your question..."
          disabled={isLoading}
          className="flex-1 resize-none bg-secondary/50"
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-11 w-11 flex-shrink-0 rounded-lg"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </Card>
  );
};
