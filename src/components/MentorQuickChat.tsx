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

  const QUESTION_ICONS = ["💪", "🎯", "🚀"];

  return (
    <div className="rounded-3xl p-6 bg-gradient-to-br from-[#B2DFDB] via-[#C8E6C9] to-[#DCEDC8] dark:from-card dark:via-card/95 dark:to-card/90 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <MessageCircle className="h-6 w-6 text-[#00897B] dark:text-primary" />
          <div className="absolute inset-0 bg-[#00897B]/20 dark:bg-primary/20 blur-md rounded-full" />
        </div>
        <h3 className="font-black text-xl text-[#00695C] dark:text-foreground">
          {personality?.name ? `Ask ${personality.name}` : "Quick Chat"}
        </h3>
      </div>
      
      <div className="space-y-3 mb-4">
        {currentQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => handleQuestionClick(question)}
            className="group w-full flex items-center gap-3 px-5 py-4 rounded-full bg-gradient-to-r from-[#80CBC4] to-[#4DB6AC] dark:from-primary/70 dark:to-primary/50 hover:from-[#4DB6AC] hover:to-[#26A69A] dark:hover:from-primary dark:hover:to-primary/70 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)] hover:scale-105 transition-all duration-300"
          >
            <span className="text-2xl group-hover:animate-bounce">{QUESTION_ICONS[index]}</span>
            <span className="text-sm font-bold text-white text-left flex-1">
              {question}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={handleCustomSubmit} className="flex gap-2">
        <Input
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          placeholder="Or ask your own question..."
          className="flex-1 rounded-full border-2 border-[#80CBC4]/40 dark:border-primary/40 bg-white/60 dark:bg-background/50 focus:border-[#00897B] dark:focus:border-primary"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={!customQuestion.trim()}
          className="rounded-full w-12 h-12 bg-gradient-to-r from-[#00897B] to-[#00695C] dark:from-primary dark:to-primary/80 hover:scale-110 transition-all shadow-[0_4px_12px_rgba(0,137,123,0.3)] dark:shadow-glow"
        >
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
};
