import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

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
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);

  useEffect(() => {
    // Select 3 random questions on mount
    const shuffled = [...ROTATING_QUESTIONS].sort(() => Math.random() - 0.5);
    setCurrentQuestions(shuffled.slice(0, 3));
  }, []);

  const handleQuestionClick = (question: string) => {
    // Navigate to chat with the question as state
    navigate("/mentor-chat", { state: { initialMessage: question } });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-foreground">Quick Chat</h3>
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
    </Card>
  );
};
