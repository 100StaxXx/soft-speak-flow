import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft } from "lucide-react";
import { type FactionType } from "./FactionSelector";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { isNativeIOSHandheld } from "@/utils/platformTargets";
import {
  ONBOARDING_SCHEDULE_ARCHETYPE_OPTIONS,
  ONBOARDING_SCHEDULE_ARCHETYPE_QUESTION_ID,
} from "@/shared/onboardingScheduleArchetype";
import {
  ONBOARDING_VISUAL_PERSONA_OPTIONS,
  ONBOARDING_VISUAL_PERSONA_QUESTION_ID,
} from "@/shared/onboardingVisualPersona";

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

type InteractionSource = "click" | "pointerdown" | "touchstart";

const NATIVE_PRESS_DEDUPE_WINDOW_MS = 800;
const questionnaireLog = logger.scope("StoryQuestionnaire");

// Faction-themed narratives (1 per questionnaire step)
const getFactionNarrative = (faction: FactionType, questionIndex: number): string => {
  const narratives: Record<FactionType, string[]> = {
    starfall: [
      "Before your title art takes shape, the cosmos tunes its portrait lens...",
      "Before you chart your course, the cosmos asks one question...",
      "As flames dance in the distance, your ship awaits its next destination...",
      "The engines hum with potential energy. Your crew looks to you for direction...",
      "Your path grows clearer with each choice...",
      "One last calibration: the map needs to know the terrain of your real days...",
    ],
    void: [
      "In the dark between stars, a silhouette waits to be drawn...",
      "In the stillness, a presence awaits. What form does it take?",
      "In the silent depths between stars, clarity emerges from stillness...",
      "The void speaks to those who listen. A whisper guides your path...",
      "The shadows reveal what light cannot...",
      "The void studies the shape of your time before it offers a path...",
    ],
    stellar: [
      "The first constellation sketches the form your title art will take...",
      "The stars align to reveal your guide. Who do you see among them?",
      "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
      "Your companion gazes at the stars with wonder. What do you see?",
      "The constellations align to show your way...",
      "The stars ask what kind of orbit your days usually follow...",
    ],
  };
  const factionNarratives = narratives[faction] ?? narratives.stellar;
  return factionNarratives[questionIndex] || factionNarratives[0];
};

const questions: StoryQuestion[] = [
  {
    id: ONBOARDING_VISUAL_PERSONA_QUESTION_ID,
    narrative: "",
    question: "For generated title art, what kind of persona should we show?",
    options: ONBOARDING_VISUAL_PERSONA_OPTIONS.map((option) => ({
      ...option,
      tags: [...option.tags],
    })),
  },
  {
    id: "mentor_energy",
    narrative: "",
    question: "Would you prefer your guide to be a man or a woman?",
    options: [
      { optionId: "masculine_presence", text: "Man", tags: ["masculine_preference"] },
      { optionId: "feminine_presence", text: "Woman", tags: ["feminine_preference"] },
      { optionId: "either_works", text: "No preference", tags: [] },
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
  {
    id: ONBOARDING_SCHEDULE_ARCHETYPE_QUESTION_ID,
    narrative: "",
    question: "What kind of schedule are we planning around?",
    options: ONBOARDING_SCHEDULE_ARCHETYPE_OPTIONS.map((option) => ({
      ...option,
      tags: [...option.tags],
    })),
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
  initialAnswers?: OnboardingAnswer[];
}

export const StoryQuestionnaire = ({
  faction,
  onComplete,
  isSubmitting = false,
  initialAnswers = [],
}: StoryQuestionnaireProps) => {
  const seededAnswers = useMemo(() => {
    const answersByQuestionId = new Map(
      initialAnswers.map((answer) => [answer.questionId, answer]),
    );
    const nextAnswers: OnboardingAnswer[] = [];

    questions.forEach((question, index) => {
      const answer = answersByQuestionId.get(question.id);
      if (
        answer
        && question.options.some((option) => option.optionId === answer.optionId)
      ) {
        nextAnswers[index] = answer;
      }
    });

    return nextAnswers;
  }, [initialAnswers]);
  const initialQuestionIndex = useMemo(() => {
    const firstUnansweredIndex = questions.findIndex((_, index) => !seededAnswers[index]);
    return firstUnansweredIndex === -1 ? questions.length - 1 : firstUnansweredIndex;
  }, [seededAnswers]);
  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>(seededAnswers);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const continueLockRef = useRef(false);
  const recentNativePressRef = useRef<{ key: string; at: number } | null>(null);
  const activeQuestionIdRef = useRef<string | null>(null);

  // Memoize star positions to prevent them from jumping on re-render
  const starPositions = useMemo(() => 
    [...Array(30)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    })), []);

  const lastQuestionIndex = questions.length - 1;
  const currentQuestionIndex = Math.min(Math.max(currentIndex, 0), lastQuestionIndex);
  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex] ?? null;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const nativeIOSHandheld = useMemo(() => isNativeIOSHandheld(), []);
  activeQuestionIdRef.current = currentQuestion.id;

  // Get faction-specific colors
  const factionColors: Record<FactionType, string> = {
    starfall: "#FF6600",
    void: "#7F26D9",
    stellar: "#3DB8F5",
  };
  const factionColor = factionColors[faction] ?? factionColors.stellar;

  const controlsLocked = isSubmitting || isTransitioning;
  const canGoBack = currentQuestionIndex > 0 && !controlsLocked;
  const canContinue = Boolean(currentAnswer) && !controlsLocked;

  useEffect(() => {
    if (isSubmitting) return;
    continueLockRef.current = false;
    setIsTransitioning(false);
  }, [isSubmitting, currentQuestionIndex]);

  useEffect(() => {
    if (currentIndex === currentQuestionIndex) return;
    continueLockRef.current = false;
    setIsTransitioning(false);
    setCurrentIndex(currentQuestionIndex);
  }, [currentIndex, currentQuestionIndex]);

  const isStaleQuestionEvent = (questionId: string) => {
    return activeQuestionIdRef.current !== questionId;
  };

  const wasNativePressRecentlyHandled = (key: string) => {
    const recentPress = recentNativePressRef.current;
    if (!recentPress) return false;

    return recentPress.key === key && Date.now() - recentPress.at < NATIVE_PRESS_DEDUPE_WINDOW_MS;
  };

  const handleSelectOption = (
    option: QuestionOption,
    source: InteractionSource,
    questionId: string,
  ) => {
    if (controlsLocked || isStaleQuestionEvent(questionId)) return;

    const nextAnswer: OnboardingAnswer = {
      questionId: currentQuestion.id,
      optionId: option.optionId,
      answer: option.text,
      tags: option.tags,
    };

    questionnaireLog.debug("Selected onboarding question option", {
      source,
      currentIndex: currentQuestionIndex,
      questionId: currentQuestion.id,
      optionId: option.optionId,
    });

    setAnswers((prev) => {
      const next = prev.slice();
      next[currentQuestionIndex] = nextAnswer;
      return next;
    });
  };

  const handleContinue = (source: InteractionSource, questionId: string) => {
    if (
      !currentAnswer
      || controlsLocked
      || continueLockRef.current
      || isStaleQuestionEvent(questionId)
    ) return;

    continueLockRef.current = true;
    setIsTransitioning(true);

    const finalizedAnswers = questions.flatMap((_, index) => {
      const answer = index === currentQuestionIndex ? currentAnswer : answers[index];
      return answer ? [answer] : [];
    });

    questionnaireLog.debug("Continuing onboarding questionnaire", {
      source,
      currentIndex: currentQuestionIndex,
      questionId: currentQuestion.id,
      optionId: currentAnswer.optionId,
      answersCount: finalizedAnswers.length,
    });

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentIndex(currentQuestionIndex + 1);
      return;
    }

    onComplete(finalizedAnswers);
  };

  const handleBack = (source: InteractionSource, questionId: string) => {
    if (!canGoBack || isStaleQuestionEvent(questionId)) return;

    questionnaireLog.debug("Moved back in onboarding questionnaire", {
      source,
      currentIndex: currentQuestionIndex,
      nextIndex: currentQuestionIndex - 1,
    });

    continueLockRef.current = false;
    setIsTransitioning(false);
    setCurrentIndex(Math.max(0, currentQuestionIndex - 1));
  };

  const createPressHandlers = (
    key: string,
    action: (source: InteractionSource) => void,
    disabled: boolean,
  ) => ({
    onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      recentNativePressRef.current = { key, at: Date.now() };
      action("touchstart");
    },
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || event.pointerType === "touch") return;
      event.preventDefault();
      event.stopPropagation();
      recentNativePressRef.current = { key, at: Date.now() };
      action("pointerdown");
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (wasNativePressRecentlyHandled(key)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      action("click");
    },
  });

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col px-6 pb-safe-lg pt-safe-top">
      {/* Background Stars */}
      <div className="absolute inset-0 overflow-hidden">
        {starPositions.map((star, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: star.left,
              top: star.top,
            }}
            animate={{
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
            }}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 z-10"
      >
        <div className="flex items-center justify-between text-white/70 text-xs uppercase tracking-wide mb-4 gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canGoBack}
            className="gap-2 text-white/80 hover:text-white disabled:opacity-40 disabled:hover:text-white/70 border border-white/10 rounded-full px-3 py-1 bg-black/30 backdrop-blur-sm"
            {...createPressHandlers(
              "questionnaire-back",
              (source) => handleBack(source, currentQuestion.id),
              !canGoBack,
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="flex-1" />
          <span className="text-sm font-medium tabular-nums min-w-[72px] text-right">
            {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        {isSubmitting ? (
          <p className="mt-3 text-center text-xs uppercase tracking-[0.14em] text-white/70">
            Matching your guide...
          </p>
        ) : null}
      </motion.div>

      {/* Question Content */}
      <div className="flex-1 flex flex-col justify-center items-center z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: nativeIOSHandheld ? 0 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: nativeIOSHandheld ? 0 : -50 }}
            transition={{ duration: nativeIOSHandheld ? 0.2 : 0.3 }}
            className="w-full max-w-2xl"
          >
            {/* Narrative Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/60 text-sm italic mb-5 text-center leading-relaxed px-2"
            >
              {getFactionNarrative(faction, currentQuestionIndex)}
            </motion.p>

            {/* Question */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl sm:text-2xl font-bold text-white text-center mb-8 sm:mb-10 leading-tight sm:leading-snug px-4"
            >
              {currentQuestion.question}
            </motion.h2>

            {/* Options */}
            <div className="space-y-4 w-full max-w-xl mx-auto">
              {currentQuestion.options.map((option, index) => {
                const isSelected = currentAnswer?.optionId === option.optionId;

                return (
                  <motion.div
                    key={option.text}
                    initial={{ opacity: 0, y: nativeIOSHandheld ? 0 : 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      disabled={controlsLocked}
                      aria-pressed={isSelected}
                      data-selected={isSelected ? "true" : "false"}
                      className={cn(
                        "w-full flex items-center text-left gap-4 sm:gap-5 min-h-[88px] py-5 px-5 text-white rounded-2xl backdrop-blur-xl transition-all touch-manipulation shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
                        isSelected
                          ? "border-white/50 bg-white/10"
                          : "border-white/15 bg-black/30 hover:border-white/40 hover:bg-black/40",
                      )}
                      style={{
                        ["--hover-bg" as string]: `${factionColor}20`,
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                        boxShadow: isSelected
                          ? `0 0 0 1px ${factionColor}55, 0 16px 36px rgba(0, 0, 0, 0.34)`
                          : "0 10px 40px rgba(0, 0, 0, 0.35)",
                        borderColor: isSelected ? `${factionColor}99` : undefined,
                        background: isSelected
                          ? `linear-gradient(135deg, ${factionColor}26, rgba(255,255,255,0.08))`
                          : undefined,
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      {...createPressHandlers(
                        `questionnaire-option-${currentQuestion.id}-${option.optionId}`,
                        (source) => handleSelectOption(option, source, currentQuestion.id),
                        controlsLocked,
                      )}
                    >
                      <span
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center text-base font-bold border bg-white/5 tracking-wide transition-colors",
                          isSelected ? "border-white/45 text-white" : "border-white/20 text-white",
                        )}
                        style={{
                          boxShadow: isSelected ? `0 0 18px ${factionColor}55` : `0 0 15px ${factionColor}33`,
                          color: isSelected ? "#FFFFFF" : factionColor,
                          background: isSelected ? `${factionColor}55` : undefined,
                        }}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span
                        className={cn(
                          "text-sm sm:text-base leading-relaxed whitespace-normal break-words flex-1 transition-colors",
                          isSelected ? "text-white font-semibold" : "text-white/88",
                        )}
                      >
                        {option.text}
                      </span>
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: nativeIOSHandheld ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-6 w-full max-w-xl mx-auto"
            >
              <Button
                type="button"
                size="lg"
                disabled={!canContinue}
                className="w-full rounded-full px-6 py-6 text-base font-semibold"
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  touchAction: "manipulation",
                  WebkitTapHighlightColor: "transparent",
                }}
                {...createPressHandlers(
                  `questionnaire-continue-${currentQuestion.id}`,
                  (source) => handleContinue(source, currentQuestion.id),
                  !canContinue,
                )}
              >
                Continue
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
