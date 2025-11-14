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

export const AskMentorChat = ({ mentorName, mentorTone }: AskMentorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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

  return (
    <Card className="bg-graphite border-steel/20 p-6 h-[600px] flex flex-col">
      <h3 className="text-2xl font-heading font-black text-pure-white mb-4">
        Ask {mentorName} Anything
      </h3>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <p className="text-steel text-center py-12 italic">
            Your mentor is ready to guide you. Ask anything...
          </p>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === "user"
                  ? "bg-royal-gold/10 border border-royal-gold/30 text-pure-white"
                  : "bg-obsidian border border-steel/20 text-steel"
              }`}
            >
              <p className="leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-obsidian border border-steel/20 rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin text-royal-gold" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask your mentor..."
          disabled={isLoading}
          className="bg-obsidian border-steel/30 text-pure-white placeholder:text-steel/50 focus:border-royal-gold"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="bg-royal-gold hover:bg-royal-gold/90 text-obsidian"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
};
