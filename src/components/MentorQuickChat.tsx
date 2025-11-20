import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send } from "lucide-react";
import { useMentorPersonality } from "@/hooks/useMentorPersonality";

const ROTATING_QUESTIONS = [
  "What should I focus on today?",
  "How can I stay motivated?",
  "I need a mindset shift",
  "Give me a pep talk",
  "Help me overcome self-doubt",
  "How do I build better habits?",
  "I'm feeling stuck",
  "What's my next step?",
  "Help me start strong today",
  "Keep me on track",
  "I need encouragement",
  "Give me the hard truth",
];

export const MentorQuickChat = () => {
  const navigate = useNavigate();
  const personality = useMentorPersonality();
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");

  useEffect(() => {
    // Select 3 random questions on mount
    const shuffled = [...ROTATING_QUESTIONS].sort(() => Math.random() - 0.5);
    setCurrentQuestions(shuffled.slice(0, 3));
  }, []);

  const handleQuestionClick = (question: string) => {
    navigate("/mentor-chat", { state: { initialMessage: question } });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuestion.trim()) {
      navigate("/mentor-chat", { state: { initialMessage: customQuestion } });
    }
  };

  return (
    <Card className="p-6 space-y-5 rounded-3xl border-2 border-primary/20 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 animate-gradient-shift" />
      
      <div className="relative z-10 space-y-5">
        <div className="flex items-center justify-center gap-2">
          <div className="relative">
            <MessageCircle className="h-6 w-6 text-primary" />
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse-slow" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {personality?.name ? `Ask ${personality.name}` : "Quick Chat"}
          </h3>
        </div>
        
        {/* Big rounded pill buttons */}
        <div className="space-y-3">
          {currentQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionClick(question)}
              className="group relative w-full text-center px-6 py-4 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border-2 border-primary/30 hover:border-primary/50 transition-all text-sm font-medium text-foreground hover:scale-105 hover:shadow-glow active:scale-95"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/0 to-accent/0 group-hover:from-primary/10 group-hover:to-accent/10 transition-all" />
              <span className="relative">{question}</span>
            </button>
          ))}
        </div>

        {/* Custom question input */}
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <Input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Or type your own..."
            className="flex-1 rounded-full border-2 focus:border-primary/50 transition-all"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!customQuestion.trim()}
            className="rounded-full h-10 w-10 shadow-soft hover:shadow-glow transition-all hover:scale-110 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};
