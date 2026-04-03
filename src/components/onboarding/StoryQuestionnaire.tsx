import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Sparkles } from "lucide-react";
import { type FactionType } from "./FactionSelector";
import { OnboardingStageShell } from "./OnboardingStageShell";

interface QuestionOption {
  optionId: string;
  text: string;
  tags: string[];
}

interface StoryQuestion {
  id: string;
  narrative: string;
  question: string;
  options: QuestionOption[];
}

// Faction-themed narratives (4 per faction for 4 questions)
const getFactionNarrative = (faction: FactionType, questionIndex: number): string => {
  const narratives: Record<FactionType, string[]> = {
    starfall: [
      "Before you chart your course, the cosmos asks one question...",
      "As flames dance in the distance, your ship awaits its next destination...",
      "The engines hum with potential energy. Your crew looks to you for direction...",
      "Your path grows clearer with each choice...",
    ],
    void: [
      "In the stillness, a presence awaits. What form does it take?",
      "In the silent depths between stars, clarity emerges from stillness...",
      "The void speaks to those who listen. A whisper guides your path...",
      "The shadows reveal what light cannot...",
    ],
    stellar: [
      "The stars align to reveal your guide. Who do you see among them?",
      "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
      "Your companion gazes at the stars with wonder. What do you see?",
      "The constellations align to show your way...",
    ],
  };
  return narratives[faction][questionIndex] || narratives[faction][0];
};

const questions: StoryQuestion[] = [
  {
    id: "mentor_energy",
    narrative: "",
    question: "What kind of guide energy resonates with you?",
    options: [
      { optionId: "feminine_presence", text: "Feminine presence", tags: ["feminine_preference"] },
      { optionId: "masculine_presence", text: "Masculine presence", tags: ["masculine_preference"] },
      { optionId: "either_works", text: "Either works for me", tags: [] },
    ],
  },
  {
    id: "focus_area",
    narrative: "",
    question: "What do you want to work on right now?",
    options: [
      { optionId: "clarity_mindset", text: "Clarity & mindset", tags: ["calm", "discipline"] },
      { optionId: "emotions_healing", text: "Emotions & healing", tags: ["healing", "supportive"] },
      { optionId: "discipline_performance", text: "Discipline & performance", tags: ["discipline", "momentum"] },
      { optionId: "confidence_self_belief", text: "Confidence & self-belief", tags: ["confidence", "supportive"] },
    ],
  },
  {
    id: "guidance_tone",
    narrative: "",
    question: "How do you want guidance to feel?",
    options: [
      { optionId: "gentle_compassionate", text: "Gentle & compassionate", tags: ["healing", "calm"] },
      { optionId: "encouraging_supportive", text: "Encouraging & supportive", tags: ["supportive", "confidence"] },
      { optionId: "calm_grounded", text: "Calm & grounded", tags: ["calm", "discipline"] },
      { optionId: "direct_demanding", text: "Direct & demanding", tags: ["discipline", "momentum"] },
    ],
  },
  {
    id: "progress_style",
    narrative: "",
    question: "What helps you make progress?",
    options: [
      { optionId: "principles_logic", text: "Clear principles and logic", tags: ["calm", "discipline"] },
      { optionId: "emotional_reassurance", text: "Emotional reassurance", tags: ["supportive", "healing"] },
      { optionId: "belief_support", text: "Someone who believes in me", tags: ["confidence", "supportive"] },
      { optionId: "pressure_standards", text: "Pressure and high standards", tags: ["discipline", "momentum"] },
    ],
  },
];

export interface OnboardingAnswer {
  questionId: string;
  optionId: string;
  answer: string;
  tags: string[];
}

interface StoryQuestionnaireProps {
  faction: FactionType;
  onComplete: (answers: OnboardingAnswer[]) => void;
  isSubmitting?: boolean;
}

export const StoryQuestionnaire = ({
  faction,
  onComplete,
  isSubmitting = false,
}: StoryQuestionnaireProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const answerLockRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const factionColors: Record<FactionType, string> = {
    starfall: "#FF6600",
    void: "#7F26D9",
    stellar: "#3DB8F5",
  };
  const factionColor = factionColors[faction];
  const factionAccent: Record<FactionType, string> = useMemo(() => ({
    starfall: "20 100% 60%",
    void: "272 78% 60%",
    stellar: "198 86% 62%",
  }), []);

  const controlsLocked = isSubmitting || isTransitioning;
  const canGoBack = currentIndex > 0 && !controlsLocked;

  useEffect(() => {
    if (isSubmitting) return;
    answerLockRef.current = false;
    setIsTransitioning(false);
  }, [isSubmitting, currentIndex]);

  const handleAnswer = (option: QuestionOption) => {
    if (controlsLocked || answerLockRef.current) return;
    answerLockRef.current = true;
    setIsTransitioning(true);

    const newAnswer: OnboardingAnswer = {
      questionId: currentQuestion.id,
      optionId: option.optionId,
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

  const handleBack = () => {
    if (!canGoBack) return;
    answerLockRef.current = false;
    setAnswers((prev) => prev.slice(0, -1));
    setIsTransitioning(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <OnboardingStageShell
      width="lg"
      align="top"
      accent={factionAccent[faction]}
      eyebrow={`Question ${currentIndex + 1} of ${questions.length}`}
      title={currentQuestion.question}
      description={getFactionNarrative(faction, currentIndex)}
      bodyClassName="mx-auto w-full max-w-4xl"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="onb-stage-panel p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center gap-3 text-white/74">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={!canGoBack}
            className="gap-2 rounded-full border border-white/12 bg-black/25 px-3 text-white hover:bg-black/35 hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-1 items-center gap-3">
            <Progress value={progress} className="h-2 flex-1 bg-white/10 [&>div]:bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(137,81,204,0.95))]" />
            <span className="min-w-[82px] text-right text-sm font-medium tabular-nums">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/58">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" style={{ color: factionColor }} />
            <span>{faction}</span>
          </div>
          {isSubmitting ? (
            <span className="text-white/78">Matching your guide...</span>
          ) : (
            <span>Answer from instinct</span>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {currentQuestion.options.map((option, index) => (
            <motion.div
              key={option.text}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.06 }}
            >
              <Button
                variant="outline"
                onClick={() => handleAnswer(option)}
                disabled={controlsLocked}
                className="group relative min-h-[96px] w-full overflow-hidden rounded-[1.6rem] border-white/10 bg-black/20 px-5 py-5 text-left text-white shadow-[0_20px_50px_rgba(0,0,0,0.26)] backdrop-blur-xl hover:border-white/18 hover:bg-white/[0.05]"
              >
                <span
                  className="absolute inset-y-4 left-3 w-1 rounded-full opacity-90"
                  style={{ backgroundColor: factionColor }}
                />
                <span className="flex w-full items-center gap-4 sm:gap-5">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/20 text-base font-bold tracking-wide"
                    style={{ boxShadow: `0 0 20px ${factionColor}28`, color: factionColor }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 whitespace-normal break-words text-sm leading-6 text-white/84 sm:text-base">
                    {option.text}
                  </span>
                </span>
              </Button>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </OnboardingStageShell>
  );
};
