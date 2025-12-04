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
      "The cosmos rewards those who take action...",
      "Your final choice approaches, warrior...",
    ],
    void: [
      "In the silent depths between stars, clarity emerges from stillness...",
      "The void speaks to those who listen. A whisper guides your path...",
      "Ancient energies swirl around you, revealing hidden truths...",
      "In the darkness, you find your light...",
      "The universe awaits your answer...",
    ],
    stellar: [
      "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
      "Your companion gazes at the stars with wonder. What do you see?",
      "A constellation shifts, forming a path only dreamers can follow...",
      "The stars whisper secrets of possibility...",
      "Your cosmic journey reaches its turning point...",
    ],
  };
  return narratives[faction][questionIndex] || narratives[faction][0];
};

const questions: StoryQuestion[] = [
  {
    id: "growth_focus",
    narrative: "",
    question: "What area of growth calls to you most right now?",
    options: [
      { text: "Strengthening my discipline and performance", tags: ["discipline", "tough_love", "performance", "elite"] },
      { text: "Cultivating inner peace and clarity", tags: ["calm", "mindfulness", "clarity", "presence"] },
      { text: "Deepening healing and emotional resilience", tags: ["healing", "supportive", "soft", "recovery"] },
      { text: "Building confidence and forward momentum", tags: ["confidence", "self_belief", "momentum", "uplifting"] },
    ],
  },
  {
    id: "guidance_style",
    narrative: "",
    question: "What kind of guidance resonates with you most?",
    options: [
      { text: "Direct and honest guidance", tags: ["tough_love", "direct", "intense"] },
      { text: "Gentle and supportive encouragement", tags: ["warm", "soft", "supportive", "feminine"] },
      { text: "Calm and thoughtful wisdom", tags: ["stoic", "deep", "grounded", "calm"] },
      { text: "High-energy motivation", tags: ["high_energy", "energetic", "elite", "uplifting"] },
    ],
  },
  {
    id: "current_support_need",
    narrative: "",
    question: "Where could you use a little extra support or strength right now?",
    options: [
      { text: "Staying consistent on my path", tags: ["discipline", "habits", "execution", "grind"] },
      { text: "Feeling mentally scattered or tense", tags: ["mindfulness", "calm", "presence", "anxiety_relief"] },
      { text: "Moving forward from emotional heaviness", tags: ["healing", "relationships", "heartbreak", "self_worth"] },
      { text: "Believing in myself more deeply", tags: ["confidence", "self_belief", "supportive", "momentum"] },
    ],
  },
  {
    id: "energy_preference",
    narrative: "",
    question: "What kind of energy do you want from your mentor?",
    options: [
      { text: "Focused, intense energy", tags: ["intense", "elite", "high_energy"] },
      { text: "Calm, grounded presence", tags: ["calm", "grounded", "neutral"] },
      { text: "Warm, uplifting support", tags: ["warm", "encouraging", "accessible", "uplifting"] },
      { text: "Spiritual and intuitive guidance", tags: ["spiritual", "intuition", "higher_self"] },
    ],
  },
  {
    id: "who_becoming",
    narrative: "",
    question: "Who are you becoming?",
    options: [
      { text: "Mentally strong and unshakeable", tags: ["stoic", "discipline", "clarity", "strong"] },
      { text: "Peaceful and centered", tags: ["inner_peace", "calm", "mindfulness", "presence"] },
      { text: "Confident and self-assured", tags: ["confidence", "self_belief", "momentum", "performance"] },
      { text: "Emotionally whole and grounded", tags: ["healing", "self_compassion", "soft", "recovery"] },
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
    starfall: "#FF6600",
    void: "#7F26D9",
    stellar: "#3DB8F5",
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
        className="pt-safe-top mb-10 z-10"
      >
        <div className="flex items-center justify-between text-white/60 text-sm mb-3">
          <span className="tracking-wide">Your Path Unfolds</span>
          <span className="font-medium tabular-nums">{currentIndex + 1} of {questions.length}</span>
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
              className="text-white/60 text-sm italic mb-6 text-center leading-relaxed px-2"
            >
              {getFactionNarrative(faction, currentIndex)}
            </motion.p>

            {/* Question */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white text-center mb-10 leading-snug"
            >
              {currentQuestion.question}
            </motion.h2>

            {/* Options */}
            <div className="space-y-4">
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
                    className="w-full min-h-[64px] py-4 px-4 text-left justify-start text-white border-white/20 hover:border-white/40 bg-card/30 backdrop-blur-sm hover:bg-card/50 transition-all"
                    style={{
                      ["--hover-bg" as string]: `${factionColor}20`,
                    }}
                  >
                    <span 
                      className="w-9 h-9 min-w-[36px] rounded-full flex items-center justify-center mr-4 text-sm font-bold shrink-0"
                      style={{ backgroundColor: `${factionColor}30`, color: factionColor }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-base leading-snug">{option.text}</span>
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
