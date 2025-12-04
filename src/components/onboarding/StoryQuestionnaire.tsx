import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type FactionType } from "./FactionSelector";

interface QuestionOption {
  text: string;
  tags: string[];
}

interface StoryQuestion {
  id: string;
  narrative: string;
  question: string;
  options: QuestionOption[];
}

// Faction-themed narratives
const getFactionNarrative = (faction: FactionType, questionIndex: number): string => {
  const narratives: Record<FactionType, string[]> = {
    starfall: [
      "As flames dance in the distance, your ship awaits its next destination...",
      "The engines hum with potential energy. Your crew looks to you for direction...",
      "A new star system appears on the horizon. Victory favors the bold...",
    ],
    void: [
      "In the silent depths between stars, clarity emerges from stillness...",
      "The void speaks to those who listen. A whisper guides your path...",
      "Ancient energies swirl around you, revealing hidden truths...",
    ],
    stellar: [
      "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
      "Your companion gazes at the stars with wonder. What do you see?",
      "A constellation shifts, forming a path only dreamers can follow...",
    ],
  };
  return narratives[faction][questionIndex] || narratives[faction][0];
};

const questions: StoryQuestion[] = [
  {
    id: "growth_focus",
    narrative: "",
    question: "What calls to your spirit most strongly?",
    options: [
      { text: "Building unshakeable discipline", tags: ["discipline", "tough-love"] },
      { text: "Finding inner peace & balance", tags: ["wellness", "calm"] },
      { text: "Achieving ambitious goals", tags: ["achievement", "driven"] },
      { text: "Healing and emotional growth", tags: ["healing", "supportive"] },
    ],
  },
  {
    id: "guidance_style",
    narrative: "",
    question: "When facing challenges, what voice do you need?",
    options: [
      { text: "Direct truth, no sugarcoating", tags: ["direct", "tough-love"] },
      { text: "Gentle encouragement", tags: ["soft", "supportive"] },
      { text: "Strategic wisdom", tags: ["strategic", "wise"] },
      { text: "Passionate motivation", tags: ["energetic", "inspiring"] },
    ],
  },
  {
    id: "chapter_entering",
    narrative: "",
    question: "What chapter of your journey are you stepping into?",
    options: [
      { text: "Building a stronger foundation", tags: ["rebuilding", "grounded"] },
      { text: "Leveling up my life", tags: ["growth", "ambitious"] },
      { text: "Finding my true path", tags: ["discovery", "searching"] },
      { text: "Becoming my best self", tags: ["transformation", "evolution"] },
    ],
  },
];

export interface OnboardingAnswer {
  questionId: string;
  answer: string;
  tags: string[];
}

interface StoryQuestionnaireProps {
  faction: FactionType;
  onComplete: (answers: OnboardingAnswer[]) => void;
}

export const StoryQuestionnaire = ({ faction, onComplete }: StoryQuestionnaireProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Get faction-specific colors
  const factionColors: Record<FactionType, string> = {
    starfall: "hsl(24, 100%, 50%)",
    void: "hsl(270, 70%, 50%)",
    stellar: "hsl(200, 90%, 60%)",
  };
  const factionColor = factionColors[faction];

  const handleAnswer = (option: QuestionOption) => {
    const newAnswer: OnboardingAnswer = {
      questionId: currentQuestion.id,
      answer: option.text,
      tags: option.tags,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(updatedAnswers);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col p-6">
      {/* Background Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-safe-top mb-8 z-10"
      >
        <div className="flex items-center justify-between text-white/60 text-sm mb-2">
          <span>Your Path Unfolds</span>
          <span>{currentIndex + 1} of {questions.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </motion.div>

      {/* Question Content */}
      <div className="flex-1 flex flex-col justify-center z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {/* Narrative Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/60 text-sm italic mb-4 text-center"
            >
              {getFactionNarrative(faction, currentIndex)}
            </motion.p>

            {/* Question */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white text-center mb-8"
            >
              {currentQuestion.question}
            </motion.h2>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <motion.div
                  key={option.text}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Button
                    variant="outline"
                    onClick={() => handleAnswer(option)}
                    className="w-full py-6 text-left justify-start text-white border-white/20 hover:border-white/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all"
                    style={{
                      ["--hover-bg" as string]: `${factionColor}20`,
                    }}
                  >
                    <span 
                      className="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-semibold"
                      style={{ backgroundColor: `${factionColor}30`, color: factionColor }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-base">{option.text}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
