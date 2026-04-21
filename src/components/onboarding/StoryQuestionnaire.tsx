import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  resolveOnboardingClarifierQuestionId,
  type AssignmentAnswerInput,
} from "@/config/onboardingMentorAssignments";
import { cn } from "@/lib/utils";
import { logger } from "@/utils/logger";
import { isNativeIOSHandheld } from "@/utils/platformTargets";
import { type FactionType } from "./FactionSelector";

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

type QuestionId =
  | "mentor_energy"
  | "focus_area"
  | "guidance_tone"
  | "progress_style"
  | "clarity_lens"
  | "pressure_style";

type InteractionSource = "click" | "pointerdown" | "touchstart";

const BASE_QUESTION_IDS: readonly QuestionId[] = [
  "mentor_energy",
  "focus_area",
  "guidance_tone",
  "progress_style",
];

const OPTIONAL_QUESTION_IDS: readonly QuestionId[] = ["clarity_lens", "pressure_style"];

const NATIVE_PRESS_DEDUPE_WINDOW_MS = 800;
const questionnaireLog = logger.scope("StoryQuestionnaire");

const getFactionNarrative = (faction: FactionType, questionIndex: number): string => {
  const narratives: Record<FactionType, string[]> = {
    starfall: [
      "Before you chart your course, the cosmos asks one question...",
      "As flames dance in the distance, your ship awaits its next destination...",
      "The engines hum with potential energy. Your crew looks to you for direction...",
      "Your path grows clearer with each choice...",
      "The signal sharpens. Your final answer brings your guide into focus...",
    ],
    void: [
      "In the stillness, a presence awaits. What form does it take?",
      "In the silent depths between stars, clarity emerges from stillness...",
      "The void speaks to those who listen. A whisper guides your path...",
      "The shadows reveal what light cannot...",
      "The hidden pattern comes closer. One last distinction remains...",
    ],
    stellar: [
      "The stars align to reveal your guide. Who do you see among them?",
      "Nebulas paint the cosmos in infinite colors. Each holds a dream...",
      "Your companion gazes at the stars with wonder. What do you see?",
      "The constellations align to show your way...",
      "A final constellation flickers into place. Your guide is almost clear...",
    ],
  };
  return narratives[faction][questionIndex] || narratives[faction][0];
};

const QUESTION_BANK: Record<QuestionId, StoryQuestion> = {
  mentor_energy: {
    id: "mentor_energy",
    narrative: "",
    question: "What kind of guide energy feels right for you?",
    options: [
      { optionId: "masculine_presence", text: "Masculine energy", tags: ["masculine_preference"] },
      { optionId: "feminine_presence", text: "Feminine energy", tags: ["feminine_preference"] },
      { optionId: "neutral_presence", text: "Neutral energy", tags: ["neutral_preference"] },
      { optionId: "either_works", text: "It doesn't matter", tags: [] },
    ],
  },
  focus_area: {
    id: "focus_area",
    narrative: "",
    question: "What kind of help do you need most right now?",
    options: [
      { optionId: "clarity_signal", text: "Clarity, signal, and perspective", tags: ["clarity", "signal"] },
      { optionId: "standards_identity", text: "Standards, identity, and self-respect", tags: ["confidence", "identity"] },
      { optionId: "gentle_routines", text: "Gentle routines and self-trust", tags: ["supportive", "healing"] },
      { optionId: "execution_pressure", text: "Execution, pressure, and accountability", tags: ["discipline", "execution"] },
    ],
  },
  guidance_tone: {
    id: "guidance_tone",
    narrative: "",
    question: "How should your guide sound?",
    options: [
      { optionId: "calm_reflective", text: "Calm and reflective", tags: ["calm", "reflection"] },
      { optionId: "composed_polished", text: "Composed and polished", tags: ["confidence", "composed"] },
      { optionId: "warm_encouraging", text: "Warm and encouraging", tags: ["supportive", "warm"] },
      { optionId: "direct_challenging", text: "Direct and challenging", tags: ["discipline", "direct"] },
    ],
  },
  progress_style: {
    id: "progress_style",
    narrative: "",
    question: "What actually helps you follow through?",
    options: [
      { optionId: "perspective_next_step", text: "Show me the clearest next step", tags: ["calm", "clarity"] },
      { optionId: "identity_alignment", text: "Help me act in line with my standards", tags: ["confidence", "identity"] },
      { optionId: "gentle_accountability", text: "Keep me steady without shame", tags: ["supportive", "healing"] },
      { optionId: "hard_accountability", text: "Push me to execute and stop stalling", tags: ["discipline", "accountability"] },
    ],
  },
  clarity_lens: {
    id: "clarity_lens",
    narrative: "",
    question: "What kind of clarity cuts through best for you?",
    options: [
      { optionId: "calm_perspective", text: "Calm perspective", tags: ["calm", "clarity"] },
      { optionId: "pattern_strategy", text: "Pattern strategy", tags: ["signal", "strategy"] },
      { optionId: "standards_self_command", text: "Standards and self-command", tags: ["confidence", "identity"] },
    ],
  },
  pressure_style: {
    id: "pressure_style",
    narrative: "",
    question: "What kind of pressure works best on you?",
    options: [
      { optionId: "systems_precision", text: "Systems precision", tags: ["discipline", "execution"] },
      { optionId: "prove_it_pressure", text: "Prove-it pressure", tags: ["momentum", "performance"] },
      { optionId: "sarcastic_callout", text: "Sarcastic callout", tags: ["accountability", "sarcastic"] },
    ],
  },
};

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

const toAssignmentAnswers = (
  answersByQuestionId: Partial<Record<QuestionId, OnboardingAnswer>>,
): AssignmentAnswerInput[] => {
  return Object.values(answersByQuestionId).map((answer) => ({
    questionId: answer.questionId,
    optionId: answer.optionId,
  }));
};

const buildQuestionSequence = (
  answersByQuestionId: Partial<Record<QuestionId, OnboardingAnswer>>,
): StoryQuestion[] => {
  const sequence = [...BASE_QUESTION_IDS];
  const clarifierQuestionId = resolveOnboardingClarifierQuestionId(
    toAssignmentAnswers(answersByQuestionId),
  );

  if (clarifierQuestionId) {
    sequence.push(clarifierQuestionId);
  }

  return sequence.map((questionId) => QUESTION_BANK[questionId]);
};

export const StoryQuestionnaire = ({
  faction,
  onComplete,
  isSubmitting = false,
}: StoryQuestionnaireProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Partial<Record<QuestionId, OnboardingAnswer>>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const continueLockRef = useRef(false);
  const recentNativePressRef = useRef<{ key: string; at: number } | null>(null);

  const starPositions = useMemo(() =>
    [...Array(30)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    })), []);

  const questionSequence = useMemo(
    () => buildQuestionSequence(answersByQuestionId),
    [answersByQuestionId],
  );
  const currentQuestion = questionSequence[currentIndex];
  const currentAnswer = currentQuestion ? answersByQuestionId[currentQuestion.id] ?? null : null;
  const progress = currentQuestion
    ? ((currentIndex + 1) / questionSequence.length) * 100
    : 0;
  const nativeIOSHandheld = useMemo(() => isNativeIOSHandheld(), []);

  const factionColors: Record<FactionType, string> = {
    starfall: "#FF6600",
    void: "#7F26D9",
    stellar: "#3DB8F5",
  };
  const factionColor = factionColors[faction];

  const controlsLocked = isSubmitting || isTransitioning;
  const canGoBack = currentIndex > 0 && !controlsLocked;
  const canContinue = Boolean(currentAnswer) && !controlsLocked;

  useEffect(() => {
    if (isSubmitting) return;
    continueLockRef.current = false;
    setIsTransitioning(false);
  }, [currentIndex, isSubmitting]);

  useEffect(() => {
    const activeQuestionIds = new Set(questionSequence.map((question) => question.id));

    setAnswersByQuestionId((previousAnswers) => {
      let changed = false;
      const nextAnswers = { ...previousAnswers };

      for (const questionId of OPTIONAL_QUESTION_IDS) {
        if (activeQuestionIds.has(questionId)) continue;
        if (!nextAnswers[questionId]) continue;
        delete nextAnswers[questionId];
        changed = true;
      }

      return changed ? nextAnswers : previousAnswers;
    });

    if (currentIndex >= questionSequence.length) {
      setCurrentIndex(Math.max(0, questionSequence.length - 1));
    }
  }, [currentIndex, questionSequence]);

  const wasNativePressRecentlyHandled = (key: string) => {
    const recentPress = recentNativePressRef.current;
    if (!recentPress) return false;

    return recentPress.key === key && Date.now() - recentPress.at < NATIVE_PRESS_DEDUPE_WINDOW_MS;
  };

  const handleSelectOption = (option: QuestionOption, source: InteractionSource) => {
    if (controlsLocked || !currentQuestion) return;

    const nextAnswer: OnboardingAnswer = {
      questionId: currentQuestion.id,
      optionId: option.optionId,
      answer: option.text,
      tags: option.tags,
    };

    questionnaireLog.debug("Selected onboarding question option", {
      source,
      currentIndex,
      questionId: currentQuestion.id,
      optionId: option.optionId,
    });

    setAnswersByQuestionId((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion.id]: nextAnswer,
    }));
  };

  const handleContinue = (source: InteractionSource) => {
    if (!currentQuestion || !currentAnswer || controlsLocked || continueLockRef.current) return;

    continueLockRef.current = true;
    setIsTransitioning(true);

    const finalizedAnswers = questionSequence.flatMap((question) => {
      const answer = answersByQuestionId[question.id] ?? (question.id === currentQuestion.id ? currentAnswer : null);
      return answer ? [answer] : [];
    });

    questionnaireLog.debug("Continuing onboarding questionnaire", {
      source,
      currentIndex,
      questionId: currentQuestion.id,
      optionId: currentAnswer.optionId,
      answersCount: finalizedAnswers.length,
    });

    if (currentIndex < questionSequence.length - 1) {
      setCurrentIndex((previousIndex) => previousIndex + 1);
      return;
    }

    onComplete(finalizedAnswers);
  };

  const handleBack = (source: InteractionSource) => {
    if (!canGoBack) return;

    questionnaireLog.debug("Moved back in onboarding questionnaire", {
      source,
      currentIndex,
      nextIndex: currentIndex - 1,
    });

    continueLockRef.current = false;
    setIsTransitioning(false);
    setCurrentIndex((previousIndex) => Math.max(0, previousIndex - 1));
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

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col px-6 pb-safe-lg pt-safe-top">
      <div className="absolute inset-0 overflow-hidden">
        {starPositions.map((star, index) => (
          <motion.div
            key={index}
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
            {...createPressHandlers("questionnaire-back", handleBack, !canGoBack)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="flex-1" />
          <span className="text-sm font-medium tabular-nums min-w-[72px] text-right">
            {currentIndex + 1} of {questionSequence.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        {isSubmitting ? (
          <p className="mt-3 text-center text-xs uppercase tracking-[0.14em] text-white/70">
            Matching your guide...
          </p>
        ) : null}
      </motion.div>

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
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/60 text-sm italic mb-5 text-center leading-relaxed px-2"
            >
              {getFactionNarrative(faction, currentIndex)}
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl sm:text-2xl font-bold text-white text-center mb-8 sm:mb-10 leading-tight sm:leading-snug px-4"
            >
              {currentQuestion.question}
            </motion.h2>

            <div className="space-y-4 w-full max-w-xl mx-auto">
              {currentQuestion.options.map((option, index) => {
                const isSelected = currentAnswer?.optionId === option.optionId;

                return (
                  <motion.div
                    key={option.optionId}
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
                      data-testid="questionnaire-option"
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
                        (source) => handleSelectOption(option, source),
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
                  handleContinue,
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
