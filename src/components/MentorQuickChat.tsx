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
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">
          {personality?.name ? `Ask ${personality.name}` : "Quick Chat"}
        </h3>
      </div>
      
      <div className="space-y-2">
        {currentQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => handleQuestionClick(question)}
            className="w-full text-left px-4 py-3 rounded-lg bg-secondary/50 hover:bg-secondary hover:shadow-glow transition-all text-sm text-foreground hover:scale-[1.02]"
          >
            "{question}"
          </button>
        ))}
      </div>

      <form onSubmit={handleCustomSubmit} className="flex gap-2">
        <Input
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          placeholder="Or ask your own question..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!customQuestion.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
};
