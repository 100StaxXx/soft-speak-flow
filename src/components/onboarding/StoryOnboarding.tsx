import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { safeNavigate } from "@/utils/nativeNavigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner";

import { StoryPrologue } from "./StoryPrologue";
import type { FactionType } from "./FactionSelector";
import { StoryQuestionnaire, type OnboardingAnswer } from "./StoryQuestionnaire";
import { MentorCalculating } from "./MentorCalculating";
import { OnboardingStoryToneSelection } from "./OnboardingStoryToneSelection";
import type { OnboardingStoryToneSelectionValue } from "./OnboardingStoryToneSelection";
import { EggSelectionPrelude } from "./EggSelectionPrelude";
import type { OnboardingBackdropStage } from "./OnboardingCosmicBackdrop";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { CompanionCreationLoader } from "@/components/CompanionCreationLoader";
import { AICompanionCreator } from "@/components/AICompanionCreator";
import { JourneyBegins } from "./JourneyBegins";
import { MentorGrid } from "@/components/MentorGrid";
import { MentorResult } from "@/components/MentorResult";
import { generateMentorExplanation, type MentorExplanation } from "@/utils/mentorExplanation";
import { useCompanion } from "@/hooks/useCompanion";
import { pollWithDeadline } from "@/utils/asyncTimeout";
import { logger } from "@/utils/logger";
import {
  getPresetCompanionAssetUrl,
  getUniversalEggAssetUrl,
} from "@/lib/companionAssetResolver";
import {
  getCompanionEggLabel,
  getCompanionElementAnchorColor,
  getCompanionFavoriteColorLabel,
  getCompanionPreset,
  COMPANION_STORY_TONES,
  type CompanionStoryTone,
  type CompanionPresetId,
} from "@/config/companionCatalog";
import { persistCompanionCustomName } from "@/lib/companionName";
import {
  filterMentorsByEnergyPreference,
  type EnergyPreference,
  getDesiredIntensityFromGuidanceTone,
  getEnergyPreferenceFromAnswers,
} from "@/utils/onboardingMentorMatching";
import {
  getOnboardingScheduleArchetypeFromAnswers,
  getOnboardingScheduleArchetypeProfile,
} from "@/shared/onboardingScheduleArchetype";
import {
  createInitialGuidedTutorialProgress,
  getGuidedTutorialLocalProgressKey,
} from "@/utils/guidedTutorial";
import type { OnboardingResumeStep } from "@/utils/profileOnboarding";
import { safeLocalStorage } from "@/utils/storage";
import { resolveAssignedMentorFromActiveMentors } from "@/config/onboardingMentorAssignments";
import { trackOnboardingTutorialEvent } from "@/utils/onboardingTutorialTelemetry";

type OnboardingStage = 
  | "prologue" 
  | "questionnaire" 
  | "calculating"
  | "mentor-result" 
  | "mentor-grid"
  | "story-tone"
  | "egg-prelude"
  | "companion"
  | "journey-begins";

type MentorCatalogStatus = "loading" | "ready" | "unavailable";

export const resolveOnboardingBackdropStage = (
  stage: OnboardingStage | "destiny" | "faction",
): OnboardingBackdropStage | null => {
  if (
    stage === "prologue"
    || stage === "destiny"
    || stage === "questionnaire"
    || stage === "calculating"
    || stage === "journey-begins"
  ) {
    return stage;
  }
  if (stage === "story-tone") {
    return "questionnaire";
  }
  if (stage === "egg-prelude") {
    return "journey-begins";
  }
  return null;
};

export const resolveQuestionnaireCompletionStage = (): OnboardingStage => "calculating";
export const CALCULATING_STAGE_DURATION_MS = 1_000;
export const QUESTIONNAIRE_PIPELINE_TIMEOUT_MS = 8_000;
export const MENTOR_CATALOG_RECOVERY_TIMEOUT_MS = 8_000;

export const scheduleMentorRevealTransition = (
  onComplete: () => void,
  setTimeoutFn: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout> = setTimeout,
): ReturnType<typeof setTimeout> => {
  return setTimeoutFn(onComplete, CALCULATING_STAGE_DURATION_MS);
};

export const runWithTimeout = async <T,>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutLabel: string,
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutLabel));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (
    error
    && typeof error === "object"
    && "message" in error
    && typeof error.message === "string"
    && error.message.trim().length > 0
  ) {
    return error.message;
  }

  return fallback;
};

const isCompanionCreationTimeoutError = (error: unknown): boolean => {
  const normalizedErrorMessage = getErrorMessage(error, "").toUpperCase();
  return (
    normalizedErrorMessage.includes("GENERATION_TIMEOUT")
    || normalizedErrorMessage.includes("AI_TIMEOUT")
    || normalizedErrorMessage.includes("TIMED OUT")
  );
};

interface Mentor {
  id: string;
  name: string;
  description: string;
  tone_description: string;
  avatar_url?: string;
  tags: string[];
  mentor_type: string;
  target_user_type?: string;
  slug: string;
  short_title: string;
  primary_color: string;
  target_user: string;
  themes?: string[];
  intensity_level?: string;
  gender_energy?: string | null;
}

export const mapGuidanceToneToIntensity = (answer: string): "high" | "medium" | "gentle" => {
  return getDesiredIntensityFromGuidanceTone(answer.trim());
};

const serializeOnboardingAnswers = (answers: OnboardingAnswer[]) =>
  answers.map((answer) => ({
    questionId: answer.questionId,
    optionId: answer.optionId,
    answer: answer.answer,
    tags: Array.isArray(answer.tags) ? answer.tags : [],
  }));

const parseOnboardingAnswers = (value: unknown): OnboardingAnswer[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const candidate = answer as Record<string, unknown>;
    if (
      typeof candidate.questionId !== "string" ||
      typeof candidate.optionId !== "string" ||
      typeof candidate.answer !== "string"
    ) {
      return [];
    }

    return [{
      questionId: candidate.questionId,
      optionId: candidate.optionId,
      answer: candidate.answer,
      tags: Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    }];
  });
};

const isCompanionStoryTone = (value: unknown): value is CompanionStoryTone =>
  typeof value === "string" && COMPANION_STORY_TONES.some((tone) => tone.value === value);

const isFactionType = (value: unknown): value is FactionType =>
  value === "starfall" || value === "void" || value === "stellar";

const GRACEWARD_INTERNAL_FACTION: FactionType = "starfall";

export const normalizeGracewardResumeStage = (
  stage: OnboardingResumeStep | null,
): OnboardingStage | null => {
  if (stage === "destiny" || stage === "faction") return "questionnaire";
  return stage;
};

const parseMentorExplanation = (value: unknown): MentorExplanation | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.subtitle !== "string" ||
    typeof candidate.paragraph !== "string" ||
    !Array.isArray(candidate.bullets)
  ) {
    return null;
  }

  return {
    title: candidate.title,
    subtitle: candidate.subtitle,
    paragraph: candidate.paragraph,
    bullets: candidate.bullets.filter((bullet): bullet is string => typeof bullet === "string"),
  };
};

type MentorEnergyCandidate = {
  gender_energy?: string | null;
  tags?: string[] | null;
  slug?: string | null;
};

type AnswerEnergyInput = {
  questionId: string;
  tags?: string[] | null;
};

export const deriveOnboardingMentorCandidates = <T extends MentorEnergyCandidate>(
  mentors: T[],
  questionAnswers: AnswerEnergyInput[],
): {
  energyPreference: EnergyPreference;
  mentorsForSelection: T[];
} => {
  const energyPreference = getEnergyPreferenceFromAnswers(questionAnswers);
  const { candidates } = filterMentorsByEnergyPreference(mentors, energyPreference);

  return {
    energyPreference,
    mentorsForSelection: candidates,
  };
};

const COMPANION_RECOVERY_DEADLINE_MS = 90_000;
const COMPANION_RECOVERY_INTERVAL_MS = 2_000;
const onboardingLog = logger.scope("StoryOnboarding");
const JOURNEY_FINALIZATION_FAILURE_TOAST =
  "Your egg was created, but we couldn't finish setup. Please try again.";

type StoryOnboardingMode = "standard" | "creation" | "migration" | "reset";

export interface StoryOnboardingResumeState {
  stage: OnboardingResumeStep;
  userName?: string | null;
  companionLabel?: string | null;
  onboardingData?: Record<string, unknown> | null;
  faction?: string | null;
}

export type GracewardOnboardingResumeState = StoryOnboardingResumeState;

interface StoryOnboardingProps {
  mode?: StoryOnboardingMode;
  existingCompanion?: {
    id: string;
    current_stage: number;
    current_xp: number;
    preset_id?: string | null;
    companion_name?: string | null;
  } | null;
  resumeState?: StoryOnboardingResumeState | null;
  onJourneyCinematicStart?: () => void;
  onJourneyCinematicComplete?: () => void;
}

type CompanionSelectionPreferences = {
  presetId: CompanionPresetId | null;
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: string;
  storyTone: string;
  companionName?: string | null;
};

type CompanionSetupStatus = "idle" | "pending" | "ready" | "failed";

export const GracewardOnboarding = ({
  mode = "standard",
  existingCompanion = null,
  resumeState = null,
  onJourneyCinematicStart,
  onJourneyCinematicComplete,
}: StoryOnboardingProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createCompanion } = useCompanion();
  const isCompanionCreationMode = mode === "creation";
  const isMigrationMode = mode === "migration";
  const isResetMode = mode === "reset";
  const activeResumeState = useMemo<StoryOnboardingResumeState | null>(() => {
    if (!resumeState || isCompanionCreationMode || isMigrationMode || isResetMode) return resumeState;

    const trimmedUserName = typeof resumeState.userName === "string" ? resumeState.userName.trim() : "";
    const canResumeWithoutName = resumeState.stage === "prologue" || resumeState.stage === "journey-begins";
    if (trimmedUserName.length > 0 || canResumeWithoutName) return resumeState;

    return {
      ...resumeState,
      stage: "prologue",
      userName: "",
    };
  }, [isCompanionCreationMode, isMigrationMode, isResetMode, resumeState]);
  const resumesAtJourneyBegins = activeResumeState?.stage === "journey-begins";
  const resumeData = activeResumeState?.onboardingData ?? null;
  const resumeFaction = isFactionType(activeResumeState?.faction)
    ? activeResumeState.faction
    : isFactionType(resumeData?.faction)
    ? resumeData.faction
    : null;
  const resumeAnswers = useMemo(
    () => parseOnboardingAnswers(resumeData?.questionnaireAnswers),
    [resumeData],
  );
  const resumeStoryTone = isCompanionStoryTone(resumeData?.story_tone)
    ? resumeData.story_tone
    : "epic_adventure";
  const resumeStage = !isCompanionCreationMode && !isMigrationMode && !isResetMode
    ? activeResumeState?.stage ?? null
    : null;
  const initialResumeStage = normalizeGracewardResumeStage(resumeStage);

  const [stage, setStage] = useState<OnboardingStage>(
    initialResumeStage
      ? initialResumeStage
      : isCompanionCreationMode
        ? "companion"
        : isMigrationMode
          ? "companion"
          : isResetMode
            ? "story-tone"
            : "prologue",
  );
  const [userName, setUserName] = useState(activeResumeState?.userName ?? "");

  // Auto scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  // Factions are retained only as legacy data. Graceward no longer asks new
  // users to choose a Cosmiq path, but the internal value keeps old mentor
  // matching and persisted profiles compatible during the transition.
  const faction = resumeFaction ?? GRACEWARD_INTERNAL_FACTION;
  const [answers, setAnswers] = useState<OnboardingAnswer[]>(resumeAnswers);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorCatalogStatus, setMentorCatalogStatus] = useState<MentorCatalogStatus>("loading");
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [mentorExplanation, setMentorExplanation] = useState<MentorExplanation | null>(null);
  const [companionAnimal, setCompanionAnimal] = useState(activeResumeState?.companionLabel ?? "");
  const [selectedStoryTone, setSelectedStoryTone] = useState<CompanionStoryTone>(resumeStoryTone);
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);
  const [companionSetupStatus, setCompanionSetupStatus] = useState<CompanionSetupStatus>(
    resumesAtJourneyBegins ? "ready" : "idle",
  );
  const [pendingCompanionSetup, setPendingCompanionSetup] = useState<CompanionSelectionPreferences | null>(null);
  const [isAwaitingJourneyCompletion, setIsAwaitingJourneyCompletion] = useState(false);
  const [isSubmittingQuestionnaire, setIsSubmittingQuestionnaire] = useState(false);
  const [isPersistingOnboardingStep, setIsPersistingOnboardingStep] = useState(false);
  const [mentorCatalogRecoveryTimedOut, setMentorCatalogRecoveryTimedOut] = useState(false);
  const [compatibilityScore, setCompatibilityScore] = useState<number | null>(null);
  const mentorRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journeyCinematicStartedRef = useRef(false);
  const persistStepInFlightRef = useRef(false);
  const mentorResultRecoveryNotifiedRef = useRef(false);

  useEffect(() => {
    trackOnboardingTutorialEvent("onboarding_stage_entered", {
      userId: user?.id ?? null,
      stage,
      mode,
      resumeStage: activeResumeState?.stage ?? null,
    });
  }, [activeResumeState?.stage, mode, stage, user?.id]);

  const clearMentorRevealTimeout = useCallback(() => {
    if (mentorRevealTimeoutRef.current) {
      clearTimeout(mentorRevealTimeoutRef.current);
      mentorRevealTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearMentorRevealTimeout();
    };
  }, [clearMentorRevealTimeout]);

  useEffect(() => {
    if (!activeResumeState || isMigrationMode || isResetMode) return;

    const nextStage = normalizeGracewardResumeStage(activeResumeState.stage);

    if (nextStage) setStage(nextStage);
    setUserName(activeResumeState.userName ?? "");
    setAnswers(resumeAnswers);
    setSelectedStoryTone(resumeStoryTone);

    if (activeResumeState.stage === "journey-begins") {
      setCompanionAnimal(activeResumeState.companionLabel ?? "");
      setCompanionSetupStatus("ready");
    }
  }, [
    activeResumeState,
    isMigrationMode,
    isResetMode,
    resumeAnswers,
    resumeFaction,
    resumeStoryTone,
  ]);

  useEffect(() => {
    if (isResetMode || stage !== "journey-begins" || journeyCinematicStartedRef.current) return;

    journeyCinematicStartedRef.current = true;
    onJourneyCinematicStart?.();
  }, [isResetMode, onJourneyCinematicStart, stage]);

  const loadExistingOnboardingData = useCallback(async () => {
    if (!user) {
      throw new Error("Not authenticated");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    return (profile?.onboarding_data as Record<string, unknown>) || {};
  }, [user]);

  const persistOnboardingProgress = useCallback(async (
    nextStep: OnboardingResumeStep | "complete",
    dataPatch: Record<string, unknown> = {},
  ) => {
    if (!user) return;

    const existingData = await loadExistingOnboardingData();
    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_step: nextStep,
        onboarding_data: {
          ...existingData,
          ...dataPatch,
        } as any,
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }
  }, [loadExistingOnboardingData, user]);

  const persistOnboardingProgressSafely = useCallback((
    nextStep: OnboardingResumeStep,
    dataPatch: Record<string, unknown> = {},
  ) => {
    void persistOnboardingProgress(nextStep, dataPatch).catch((error: unknown) => {
      onboardingLog.warn("Failed to persist onboarding progress", {
        userId: user?.id,
        nextStep,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [persistOnboardingProgress, user?.id]);

  const persistStageBeforeAdvance = useCallback(async (
    nextStep: OnboardingResumeStep,
    dataPatch: Record<string, unknown> = {},
    nextStage: OnboardingStage = nextStep,
  ) => {
    if (persistStepInFlightRef.current) return false;

    persistStepInFlightRef.current = true;
    setIsPersistingOnboardingStep(true);
    try {
      await persistOnboardingProgress(nextStep, dataPatch);
      setStage(nextStage);
      return true;
    } catch (error) {
      onboardingLog.warn("Failed to persist onboarding step before advancing", {
        userId: user?.id,
        nextStep,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("We couldn't save your progress right now. Please try again.");
      return false;
    } finally {
      persistStepInFlightRef.current = false;
      setIsPersistingOnboardingStep(false);
    }
  }, [persistOnboardingProgress, user?.id]);

  const fetchActiveMentors = useCallback(async (): Promise<Mentor[]> => {
    const { data, error } = await supabase
      .from("graceward_guides")
      .select("*")
      .eq("is_active", true);

    if (error) {
      onboardingLog.error("Failed to load active mentors", {
        error: error.message,
      });
      return [];
    }

    if (!data || data.length === 0) {
      onboardingLog.warn("No active mentors returned from query");
      return [];
    }

    return data.map((mentorRow) => ({
      id: mentorRow.id,
      name: mentorRow.name,
      description: mentorRow.description,
      tone_description: mentorRow.tone_description,
      avatar_url: mentorRow.avatar_url ?? undefined,
      tags: mentorRow.tags || [],
      mentor_type: mentorRow.mentor_type,
      target_user_type: mentorRow.target_user_type ?? undefined,
      slug: mentorRow.slug || "",
      short_title: mentorRow.short_title || "",
      primary_color: mentorRow.primary_color || "#7B68EE",
      target_user: mentorRow.target_user || "",
      themes: mentorRow.themes ?? undefined,
      intensity_level: mentorRow.intensity_level ?? undefined,
      gender_energy: mentorRow.gender_energy ?? null,
    }));
  }, []);

  // Load mentors on mount
  useEffect(() => {
    let cancelled = false;
    const loadMentors = async () => {
      const activeMentors = await fetchActiveMentors();
      if (cancelled) return;
      setMentors(activeMentors);
      setMentorCatalogStatus(activeMentors.length > 0 ? "ready" : "unavailable");
    };
    void loadMentors();
    return () => {
      cancelled = true;
    };
  }, [fetchActiveMentors]);

  useEffect(() => {
    if (stage !== "mentor-result") {
      mentorResultRecoveryNotifiedRef.current = false;
    }
  }, [stage]);

  useEffect(() => {
    const isWaitingForCatalog =
      stage === "mentor-result"
      && (!recommendedMentor || !mentorExplanation)
      && mentorCatalogStatus === "loading";

    if (!isWaitingForCatalog) {
      setMentorCatalogRecoveryTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMentorCatalogRecoveryTimedOut(true);
      trackOnboardingTutorialEvent("onboarding_mentor_catalog_restore_stalled", {
        userId: user?.id ?? null,
      });
    }, MENTOR_CATALOG_RECOVERY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [mentorCatalogStatus, mentorExplanation, recommendedMentor, stage, user?.id]);

  useEffect(() => {
    if (!resumeData || recommendedMentor) return;
    const mentorId = typeof resumeData.mentorId === "string" ? resumeData.mentorId : null;
    if (!mentorId) return;

    const mentor = mentors.find((candidate) => candidate.id === mentorId);
    if (!mentor) {
      if (stage !== "mentor-result" || mentorCatalogStatus === "loading") return;

      if (!mentorResultRecoveryNotifiedRef.current) {
        mentorResultRecoveryNotifiedRef.current = true;
        if (mentorCatalogStatus === "ready") {
          toast.error("We couldn't reload your saved guide. Please choose one from the guide list.");
          trackOnboardingTutorialEvent("onboarding_mentor_resume_recovered", {
            userId: user?.id ?? null,
            reason: "saved_mentor_missing",
            recoveryStage: "mentor-grid",
          });
        } else {
          toast.error("We couldn't reload the guide catalog. Please retry your guide match.");
          trackOnboardingTutorialEvent("onboarding_mentor_resume_recovered", {
            userId: user?.id ?? null,
            reason: "mentor_catalog_unavailable",
            recoveryStage: "questionnaire",
          });
        }
      }

      setStage(mentorCatalogStatus === "ready" ? "mentor-grid" : "questionnaire");
      return;
    }

    setRecommendedMentor(mentor);
    setMentorExplanation(
      parseMentorExplanation(resumeData.explanation) ??
        generateMentorExplanation(mentor, Object.fromEntries(
          answers.map((answer) => [answer.questionId, answer.tags[0] || ""]),
        )),
    );
  }, [answers, mentorCatalogStatus, mentors, recommendedMentor, resumeData, stage]);

  const handlePrologueComplete = (name: string) => {
    setUserName(name);
    void persistStageBeforeAdvance("questionnaire", {
      userName: name,
      product_mode: "graceward",
    });
  };

  const persistQuestionnaireResponses = useCallback(async (questionAnswers: OnboardingAnswer[]) => {
    if (!user) return;

    const results = await Promise.all(
      questionAnswers.map((answer) =>
        supabase.from("questionnaire_responses").upsert({
          user_id: user.id,
          question_id: answer.questionId,
          answer_tags: answer.tags,
        }, { onConflict: "user_id,question_id" })
      ),
    );
    const failedWrites = results.filter((result) => result.error);
    if (failedWrites.length > 0) {
      throw failedWrites[0]?.error ?? new Error("Questionnaire response persistence failed");
    }
  }, [user]);

  const handleQuestionnaireComplete = async (questionAnswers: OnboardingAnswer[]) => {
    if (isSubmittingQuestionnaire) {
      return;
    }

    clearMentorRevealTimeout();
    setIsSubmittingQuestionnaire(true);
    setAnswers(questionAnswers);
    setStage(resolveQuestionnaireCompletionStage());
    trackOnboardingTutorialEvent("onboarding_questionnaire_submitted", {
      userId: user?.id ?? null,
      answerCount: questionAnswers.length,
      hasScheduleArchetype: Boolean(getOnboardingScheduleArchetypeFromAnswers(questionAnswers)),
    });

    try {
      const serializedAnswers = serializeOnboardingAnswers(questionAnswers);
      await persistOnboardingProgress("questionnaire", {
        faction,
        questionnaireAnswers: serializedAnswers,
      });
      await persistQuestionnaireResponses(questionAnswers);

      const mentorPool = await runWithTimeout(
        mentors.length > 0 ? Promise.resolve(mentors) : fetchActiveMentors(),
        QUESTIONNAIRE_PIPELINE_TIMEOUT_MS,
        "mentor_pipeline_timeout",
      );

      if (mentors.length === 0 && mentorPool.length > 0) {
        setMentors(mentorPool);
      }
      setMentorCatalogStatus(mentorPool.length > 0 ? "ready" : "unavailable");

      if (mentorPool.length === 0) {
        onboardingLog.error("Mentor recommendation aborted: no active mentors available");
        toast.error("Guide catalog is temporarily unavailable. Please try again in a moment.");
        setStage("questionnaire");
        return;
      }

      const energyPref = getEnergyPreferenceFromAnswers(questionAnswers);
      const { candidates: genderFilteredPool } = filterMentorsByEnergyPreference(mentorPool, energyPref);
      const assignment = resolveAssignedMentorFromActiveMentors(questionAnswers, genderFilteredPool);
      const bestMatch = assignment.mentor;

      if (bestMatch) {
        if (assignment.usedFallback) {
          onboardingLog.warn("Preassigned mentor unavailable; using same-energy fallback", {
            requestedSlug: assignment.requestedSlug,
            resolvedSlug: assignment.resolvedSlug,
            mentorPoolCount: mentorPool.length,
          });
        }

        setRecommendedMentor(bestMatch);
        setCompatibilityScore(null);

        // Convert answers to Record format for explanation generator
        const selectedAnswers: Record<string, string> = {};
        questionAnswers.forEach(answer => {
          selectedAnswers[answer.questionId] = answer.tags[0] || "";
        });

        // Generate explanation
        const explanation = generateMentorExplanation(bestMatch, selectedAnswers);
        setMentorExplanation(explanation);
        const scheduleArchetype = getOnboardingScheduleArchetypeFromAnswers(questionAnswers);
        const scheduleArchetypeProfile = getOnboardingScheduleArchetypeProfile(scheduleArchetype);
        trackOnboardingTutorialEvent("onboarding_mentor_matched", {
          userId: user?.id ?? null,
          mentorId: bestMatch.id,
          mentorSlug: bestMatch.slug,
          energyPreference: energyPref,
          usedFallback: assignment.usedFallback,
          scheduleArchetype,
        });
        await persistOnboardingProgress("mentor-result", {
          faction,
          questionnaireAnswers: serializedAnswers,
          mentorId: bestMatch.id,
          mentorName: bestMatch.name,
          mentorEnergyPreference: energyPref,
          ...(scheduleArchetype
            ? {
              scheduleArchetype,
              scheduleArchetypeLabel: scheduleArchetypeProfile?.label ?? null,
              scheduleArchetypePlanningHint: scheduleArchetypeProfile?.plannerHint ?? null,
            }
            : {}),
          explanation: {
            title: explanation.title,
            subtitle: explanation.subtitle,
            paragraph: explanation.paragraph,
            bullets: explanation.bullets,
          },
        });

        mentorRevealTimeoutRef.current = scheduleMentorRevealTransition(() => {
          setStage("mentor-result");
          mentorRevealTimeoutRef.current = null;
        });
        return;
      }

      onboardingLog.error("Preassigned mentor resolution failed with non-empty mentor pool", {
        requestedSlug: assignment.requestedSlug,
        mentorPoolCount: mentorPool.length,
      });
      trackOnboardingTutorialEvent("onboarding_mentor_match_fallback", {
        userId: user?.id ?? null,
        reason: "preassigned_resolution_failed",
        requestedSlug: assignment.requestedSlug,
        mentorPoolCount: mentorPool.length,
      });
      toast.error("We couldn't automatically match a guide. Please pick one from the grid.");
      setStage("mentor-grid");
      persistOnboardingProgressSafely("mentor-grid", {
        faction,
        questionnaireAnswers: serializeOnboardingAnswers(questionAnswers),
      });
    } catch (error) {
      onboardingLog.error("Questionnaire completion failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      trackOnboardingTutorialEvent("onboarding_mentor_match_failed", {
        userId: user?.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("We hit a temporary snag matching your guide. Please try again.");
      setStage("questionnaire");
    } finally {
      setIsSubmittingQuestionnaire(false);
    }
  };

  const handleMentorConfirm = async (mentor: Mentor, explanationOverride?: MentorExplanation | null) => {
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to load profile before mentor confirmation:", profileError);
        toast.error("We couldn't save your guide selection right now. Please try again.");
        return;
      }
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      const explanationToSave = explanationOverride ?? mentorExplanation;
      const energyPreference = getEnergyPreferenceFromAnswers(answers);
      const scheduleArchetype = getOnboardingScheduleArchetypeFromAnswers(answers);
      const scheduleArchetypeProfile = getOnboardingScheduleArchetypeProfile(scheduleArchetype);
      
      const { error: updateError } = await supabase.from("profiles").update({
        selected_mentor_id: mentor.id,
        onboarding_step: "story-tone",
        onboarding_data: {
          ...existingData,
          faction,
          questionnaireAnswers: serializeOnboardingAnswers(answers),
          mentorId: mentor.id,
          mentorName: mentor.name,
          mentorEnergyPreference: energyPreference,
          ...(scheduleArchetype
            ? {
              scheduleArchetype,
              scheduleArchetypeLabel: scheduleArchetypeProfile?.label ?? null,
              scheduleArchetypePlanningHint: scheduleArchetypeProfile?.plannerHint ?? null,
            }
            : {}),
          explanation: explanationToSave ? {
            title: explanationToSave.title,
            subtitle: explanationToSave.subtitle,
            paragraph: explanationToSave.paragraph,
            bullets: explanationToSave.bullets,
          } : null,
        },
      }).eq("id", user.id);

      if (updateError) {
        console.error("Failed to save mentor selection:", updateError);
        toast.error("We couldn't save your guide selection right now. Please try again.");
        return;
      }
      
      // Force immediate refetch to ensure fresh data
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
    }
    
    trackOnboardingTutorialEvent("onboarding_mentor_confirmed", {
      userId: user?.id ?? null,
      mentorId: mentor.id,
      mentorSlug: mentor.slug,
    });
    setStage("story-tone");
  };

  const handleSeeAllMentors = () => {
    setStage("mentor-grid");
    persistOnboardingProgressSafely("mentor-grid", {
      faction,
      questionnaireAnswers: serializeOnboardingAnswers(answers),
    });
  };

  const handleMentorSelectFromGrid = async (mentorId: string) => {
    const selectedMentor = mentors.find(m => m.id === mentorId);
    if (!selectedMentor) return;
    
    setRecommendedMentor(selectedMentor);
    
    // Generate explanation for the selected mentor
    const selectedAnswers: Record<string, string> = {};
    answers.forEach(answer => {
      selectedAnswers[answer.questionId] = answer.tags[0] || "";
    });
    const explanation = generateMentorExplanation(selectedMentor, selectedAnswers);
    setMentorExplanation(explanation);
    
    await handleMentorConfirm(selectedMentor, explanation);
  };

  const handleCompanionBack = useCallback(() => {
    void persistStageBeforeAdvance("story-tone", { story_tone: selectedStoryTone });
  }, [persistStageBeforeAdvance, selectedStoryTone]);

  const handleStoryToneComplete = useCallback((selection: OnboardingStoryToneSelectionValue) => {
    setSelectedStoryTone(selection.storyTone);
    void persistStageBeforeAdvance("egg-prelude", { story_tone: selection.storyTone });
  }, [persistStageBeforeAdvance]);

  const handleStoryToneBack = useCallback(() => {
    if (isResetMode) {
      return;
    }

    if (recommendedMentor && mentorExplanation) {
      setStage("mentor-result");
      return;
    }

    if (mentors.length > 0) {
      setStage("mentor-grid");
    }
  }, [isResetMode, mentorExplanation, mentors.length, recommendedMentor]);

  const handleEggPreludeComplete = useCallback(() => {
    void persistStageBeforeAdvance("companion", { story_tone: selectedStoryTone });
  }, [persistStageBeforeAdvance, selectedStoryTone]);

  const handleEggPreludeBack = useCallback(() => {
    void persistStageBeforeAdvance("story-tone", { story_tone: selectedStoryTone });
  }, [persistStageBeforeAdvance, selectedStoryTone]);

  const getCompanionSelectionDisplayName = useCallback((preferences: CompanionSelectionPreferences) => {
    if (preferences.companionName?.trim()) {
      return preferences.companionName.trim();
    }
    const eggDisplayName = getCompanionEggLabel(preferences.coreElement);
    return preferences.presetId ? preferences.spiritAnimal : eggDisplayName;
  }, []);

  const persistJourneyBeginsStep = useCallback(async () => {
    await persistOnboardingProgress("journey-begins", { story_tone: selectedStoryTone });
  }, [persistOnboardingProgress, selectedStoryTone]);

  const runCompanionSetup = useCallback(async (
    preferences: CompanionSelectionPreferences,
    options: { enterJourneyImmediately?: boolean } = {},
  ): Promise<boolean> => {
    if (!user || isCreatingCompanion) return false;

    const startedAt = Date.now();
    let onboardingFinalized = false;
    const enterJourneyImmediately = options.enterJourneyImmediately === true;
    const eggDisplayName = getCompanionEggLabel(preferences.coreElement);
    const colorLabel = getCompanionFavoriteColorLabel(preferences.favoriteColor);
    const selectionDisplayName = getCompanionSelectionDisplayName(preferences);

    setPendingCompanionSetup(preferences);
    setCompanionSetupStatus("pending");
    trackOnboardingTutorialEvent("onboarding_companion_setup_started", {
      userId: user.id,
      mode,
      creationMode: preferences.presetId ? "preset" : "ai",
      presetId: preferences.presetId,
      storyTone: preferences.storyTone,
      enterJourneyImmediately,
    });
    if (enterJourneyImmediately) {
      setCompanionAnimal(selectionDisplayName);
      try {
        await persistJourneyBeginsStep();
      } catch (error) {
        setCompanionSetupStatus("idle");
        setPendingCompanionSetup(null);
        setCompanionAnimal("");
        onboardingLog.warn("Failed to persist journey-begins before companion setup", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error("We couldn't save your progress right now. Please try again.");
        return false;
      }
      setStage("journey-begins");
    }
    setIsCreatingCompanion(true);

    const finalizeCompanionOnboarding = async (
      companionId: string,
      fallbackName: string,
      recoveredAfterTimeout: boolean,
    ) => {
      if (onboardingFinalized) return;
      onboardingFinalized = true;

      const memoryContext = {
        title: "Our First Meeting",
        description: preferences.presetId
          ? `The day we found your ${colorLabel.toLowerCase()} ${eggDisplayName.toLowerCase()}, already carrying the spirit of ${preferences.spiritAnimal}.`
          : `The day we found your ${colorLabel.toLowerCase()} ${eggDisplayName.toLowerCase()}, humming with possibility.`,
        emotion: "wonder",
        details: {
          spiritAnimal: preferences.spiritAnimal,
          coreElement: preferences.coreElement,
          favoriteColor: preferences.favoriteColor,
        },
      };

      const { error: completionError } = await (supabase.rpc as unknown as (
        functionName: "prepare_companion_onboarding_journey",
        args: {
          p_companion_id: string;
          p_story_tone: string;
          p_memory_context: Record<string, unknown>;
          p_complete_onboarding: boolean;
        },
      ) => Promise<{ error: { message?: string } | null }>)(
        "prepare_companion_onboarding_journey",
        {
          p_companion_id: companionId,
          p_story_tone: preferences.storyTone,
          p_memory_context: memoryContext,
          p_complete_onboarding: isResetMode,
        },
      );

      if (completionError) {
        throw completionError;
      }

      safeLocalStorage.removeItem(getGuidedTutorialLocalProgressKey(user.id));

      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["profile", user.id] }),
        queryClient.refetchQueries({ queryKey: ["companion", user.id] }),
      ]);

      setCompanionAnimal(fallbackName);
      setCompanionSetupStatus("ready");
      trackOnboardingTutorialEvent("onboarding_companion_setup_ready", {
        userId: user.id,
        companionId,
        recoveredAfterTimeout,
        elapsedMs: Date.now() - startedAt,
        mode,
      });

      if (isResetMode) {
        toast.success("Your companion has been reset and reselected.");
        safeNavigate(navigate, "/journeys");
        return;
      }

      logger.info("Companion onboarding prepared for journey cinematic", {
        userId: user.id,
        companionId,
        recoveredAfterTimeout,
        durationMs: Date.now() - startedAt,
      });
    };

    const tryFinalizeCompanionOnboarding = async (
      companionId: string,
      fallbackName: string,
      recoveredAfterTimeout: boolean,
    ) => {
      try {
        await finalizeCompanionOnboarding(companionId, fallbackName, recoveredAfterTimeout);
        return true;
      } catch (error) {
        setCompanionSetupStatus("failed");
        trackOnboardingTutorialEvent("onboarding_companion_setup_failed", {
          userId: user.id,
          companionId,
          recoveredAfterTimeout,
          elapsedMs: Date.now() - startedAt,
          stage: "finalization",
          error: getErrorMessage(error, "Unknown finalization error"),
        });
        logger.error("Companion onboarding finalization failed", {
          userId: user.id,
          companionId,
          recoveredAfterTimeout,
          elapsedMs: Date.now() - startedAt,
          error: getErrorMessage(error, "Unknown finalization error"),
        });
        toast.error(JOURNEY_FINALIZATION_FAILURE_TOAST);
        return false;
      }
    };

    try {
      const preset = preferences.presetId ? getCompanionPreset(preferences.presetId) : null;
      if ((isMigrationMode || preferences.presetId) && !preset) {
        throw new Error("Unknown companion preset");
      }

      if (isMigrationMode) {
        const latestCompanion = existingCompanion ?? (
          await supabase
            .from("user_companion")
            .select("id, current_xp, current_stage, preset_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data;

        if (!latestCompanion?.id) {
          throw new Error("No companion found to migrate.");
        }

        const normalizedElement = preferences.coreElement;
        const claimedStage = Math.max(latestCompanion.current_stage ?? 0, 0);
        const initialImageUrl = getUniversalEggAssetUrl(normalizedElement);
        const currentImageUrl = claimedStage <= 0
          ? initialImageUrl
          : getPresetCompanionAssetUrl({
            presetId: preset.id,
            stage: claimedStage,
            element: normalizedElement,
            state: "normal",
          }) ?? "/placeholder-companion.svg";

        const { error: companionUpdateError } = await supabase.rpc(
          "apply_companion_preset_selection",
          {
            p_companion_id: latestCompanion.id,
            p_preset_id: preset.id,
            p_spirit_animal: preset.displayName,
            p_favorite_color: getCompanionElementAnchorColor(normalizedElement),
            p_core_element: normalizedElement,
            p_story_tone: preferences.storyTone,
            p_current_stage: claimedStage,
            p_current_image_url: currentImageUrl,
            p_initial_image_url: initialImageUrl,
          },
        );

        if (companionUpdateError) {
          throw companionUpdateError;
        }

        await persistCompanionCustomName(latestCompanion.id, preferences.companionName);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_data")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({
            onboarding_data: {
              ...existingData,
              story_tone: preferences.storyTone,
            },
          })
          .eq("id", user.id);

        if (profileUpdateError) {
          throw profileUpdateError;
        }

        await Promise.all([
          queryClient.refetchQueries({ queryKey: ["profile", user.id] }),
          queryClient.refetchQueries({ queryKey: ["companion", user.id] }),
        ]);
        safeLocalStorage.removeItem(getGuidedTutorialLocalProgressKey(user.id));
        setCompanionSetupStatus("ready");
        trackOnboardingTutorialEvent("onboarding_companion_setup_ready", {
          userId: user.id,
          companionId: latestCompanion.id,
          recoveredAfterTimeout: false,
          elapsedMs: Date.now() - startedAt,
          mode,
        });
        toast.success(`${preset.displayName} is now your companion form.`);
        safeNavigate(navigate, "/journeys");
        return true;
      }

      logger.info("Companion creation started from onboarding", {
        userId: user.id,
        presetId: preset?.id ?? null,
        spiritAnimal: selectionDisplayName,
      });

      let companionData: Awaited<ReturnType<typeof createCompanion.mutateAsync>>;
      try {
        companionData = await createCompanion.mutateAsync(
          preferences.presetId
            ? {
              creationMode: "preset",
              presetId: preset?.id ?? null,
              favoriteColor: preferences.favoriteColor,
              spiritAnimal: preferences.spiritAnimal,
              coreElement: preferences.coreElement,
              storyTone: preferences.storyTone,
              companionName: preferences.companionName,
            }
            : {
              creationMode: "ai",
              favoriteColor: preferences.favoriteColor,
              spiritAnimal: preferences.spiritAnimal,
              coreElement: preferences.coreElement,
              storyTone: preferences.storyTone,
              companionName: preferences.companionName,
              deferInitialImageGeneration: true,
            },
        );

        if (!companionData?.id) {
          throw new Error("Companion record missing ID after creation.");
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error, "Something went wrong. Please try again.");

        if (isCompanionCreationTimeoutError(error)) {
          logger.warn("Companion creation timed out; starting recovery poll", {
            userId: user.id,
            reason: errorMessage,
            elapsedMs: Date.now() - startedAt,
          });

          const recoveredCompanion = await pollWithDeadline<{ id: string; spirit_animal: string | null }>({
            deadlineMs: COMPANION_RECOVERY_DEADLINE_MS,
            intervalMs: COMPANION_RECOVERY_INTERVAL_MS,
            task: async () => {
              const { data, error: fetchError } = await supabase
                .from("user_companion")
                .select("id, spirit_animal")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (fetchError) {
                throw fetchError;
              }

              if (!data?.id) {
                return null;
              }

              return {
                id: data.id,
                spirit_animal: data.spirit_animal ?? null,
              };
            },
            onPollError: (pollError) => {
              logger.warn("Companion recovery poll attempt failed", {
                userId: user.id,
                error: pollError instanceof Error ? pollError.message : String(pollError),
              });
            },
          });

          if (recoveredCompanion?.id) {
            logger.warn("Companion recovery succeeded after timeout", {
              userId: user.id,
              companionId: recoveredCompanion.id,
              elapsedMs: Date.now() - startedAt,
            });
            await persistCompanionCustomName(recoveredCompanion.id, preferences.companionName);
            toast.success("Your companion finished taking shape. Continuing your journey...");
            return await tryFinalizeCompanionOnboarding(
              recoveredCompanion.id,
              recoveredCompanion.spirit_animal === "Egg" || Boolean(preferences.companionName?.trim())
                ? selectionDisplayName
                : recoveredCompanion.spirit_animal || selectionDisplayName,
              true,
            );
          }

          setCompanionSetupStatus("failed");
          trackOnboardingTutorialEvent("onboarding_companion_setup_failed", {
            userId: user.id,
            elapsedMs: Date.now() - startedAt,
            stage: "timeout_recovery",
            error: "recovery_window_exhausted",
          });
          logger.error("Companion recovery failed after timeout", {
            userId: user.id,
            recoveryWindowMs: COMPANION_RECOVERY_DEADLINE_MS,
            elapsedMs: Date.now() - startedAt,
          });
          toast.error("This is taking longer than expected. Tap Begin Your Journey to try again.");
          return false;
        }

        setCompanionSetupStatus("failed");
        trackOnboardingTutorialEvent("onboarding_companion_setup_failed", {
          userId: user.id,
          elapsedMs: Date.now() - startedAt,
          stage: "creation",
          error: errorMessage,
        });
        logger.error("Companion creation failed during onboarding", {
          userId: user.id,
          elapsedMs: Date.now() - startedAt,
          error: errorMessage,
        });
        toast.error(errorMessage);
        return false;
      }

      return await tryFinalizeCompanionOnboarding(companionData.id, selectionDisplayName, false);
    } catch (error) {
      setCompanionSetupStatus("failed");
      const errorMessage = getErrorMessage(error, "Something went wrong. Please try again.");
      trackOnboardingTutorialEvent("onboarding_companion_setup_failed", {
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        stage: "flow",
        error: errorMessage,
      });
      logger.error("Error completing companion onboarding flow", {
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        error: errorMessage,
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setIsCreatingCompanion(false);
    }
  }, [
    createCompanion,
    existingCompanion,
    getCompanionSelectionDisplayName,
    isCreatingCompanion,
    isMigrationMode,
    isResetMode,
    loadExistingOnboardingData,
    mode,
    navigate,
    persistJourneyBeginsStep,
    queryClient,
    user,
  ]);

  const handleCompanionComplete = useCallback((preferences: CompanionSelectionPreferences) => {
    if (!user || isCreatingCompanion) return;

    void runCompanionSetup(preferences, {
      enterJourneyImmediately: !isMigrationMode && !isResetMode,
    });
  }, [isCreatingCompanion, isMigrationMode, isResetMode, runCompanionSetup, user]);

  const completeJourney = useCallback(async () => {
    if (!user) return false;

    try {
      const existingData = await loadExistingOnboardingData();
      const nowIso = new Date().toISOString();
      const initialGuidedTutorialProgress = createInitialGuidedTutorialProgress(nowIso);
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_step: "complete",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          onboarding_data: {
            ...existingData,
            product_mode: "graceward",
            graceward_onboarding_version: 1,
            // Retain the old version key for installed clients that still use
            // it to identify the faith-specific onboarding generation.
            christian_onboarding_version: 3,
            walkthrough_completed: true,
            story_tone:
              typeof existingData.story_tone === "string"
                ? existingData.story_tone
                : selectedStoryTone,
            progression_reset_required: false,
            guided_tutorial: initialGuidedTutorialProgress,
          } as any,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      safeLocalStorage.setItem(
        getGuidedTutorialLocalProgressKey(user.id),
        JSON.stringify(initialGuidedTutorialProgress),
      );
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["profile", user.id] }),
        queryClient.refetchQueries({ queryKey: ["companion", user.id] }),
      ]);

      onJourneyCinematicComplete?.();
      trackOnboardingTutorialEvent("onboarding_completed", {
        userId: user.id,
        mode,
      });
      toast.success("Welcome to Graceward. Your daily path is ready.");
      safeNavigate(navigate, "/mentor");
      return true;
    } catch (error) {
      logger.error("Journey completion finalization failed", {
        userId: user.id,
        error: getErrorMessage(error, "Unknown journey completion error"),
      });
      toast.error(JOURNEY_FINALIZATION_FAILURE_TOAST);
      return false;
    }
  }, [
    loadExistingOnboardingData,
    mode,
    navigate,
    onJourneyCinematicComplete,
    queryClient,
    selectedStoryTone,
    user,
  ]);

  const recoverOrCompleteJourney = useCallback(async () => {
    if (!user) return false;

    if (companionSetupStatus === "ready") {
      return await completeJourney();
    }

    if (companionSetupStatus === "failed") {
      if (!pendingCompanionSetup) {
        toast.error("We couldn't recover your companion setup. Please restart onboarding.");
        return false;
      }

      const setupReady = await runCompanionSetup(pendingCompanionSetup);
      if (!setupReady) {
        return false;
      }

      return await completeJourney();
    }

    return false;
  }, [
    companionSetupStatus,
    completeJourney,
    pendingCompanionSetup,
    runCompanionSetup,
    user,
  ]);

  const handleJourneyComplete = useCallback(() => {
    if (!user || isAwaitingJourneyCompletion) return;

    if (companionSetupStatus === "pending" || companionSetupStatus === "failed") {
      setIsAwaitingJourneyCompletion(true);
      return;
    }

    void recoverOrCompleteJourney();
  }, [
    companionSetupStatus,
    isAwaitingJourneyCompletion,
    recoverOrCompleteJourney,
    user,
  ]);

  useEffect(() => {
    if (!isAwaitingJourneyCompletion) return;
    if (companionSetupStatus !== "ready" && companionSetupStatus !== "failed") return;

    let cancelled = false;
    void recoverOrCompleteJourney().then(() => {
      if (!cancelled) {
        setIsAwaitingJourneyCompletion(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [companionSetupStatus, isAwaitingJourneyCompletion, recoverOrCompleteJourney]);

  const handleMentorResultRecovery = useCallback(() => {
    mentorResultRecoveryNotifiedRef.current = false;
    setMentorCatalogRecoveryTimedOut(false);
    const recoveryStage = mentorCatalogStatus === "ready" && mentors.length > 0 ? "mentor-grid" : "questionnaire";
    trackOnboardingTutorialEvent("onboarding_mentor_resume_manual_recovery", {
      userId: user?.id ?? null,
      mentorCatalogStatus,
      recoveryStage,
    });
    setStage(recoveryStage);
  }, [mentorCatalogStatus, mentors.length, user?.id]);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#09110d]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(196,168,92,0.18),transparent_34%),radial-gradient(circle_at_10%_70%,rgba(62,110,79,0.20),transparent_38%),linear-gradient(180deg,#0d1812_0%,#09110d_58%,#07100c_100%)]"
      />

      <AnimatePresence mode="wait">
        {stage === "prologue" && (
          <motion.div
            key="prologue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <StoryPrologue onComplete={handlePrologueComplete} />
          </motion.div>
        )}

        {stage === "questionnaire" && (
          <motion.div
            key="questionnaire"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <StoryQuestionnaire
              faction={faction}
              onComplete={handleQuestionnaireComplete}
              isSubmitting={isSubmittingQuestionnaire}
              initialAnswers={answers}
            />
          </motion.div>
        )}

        {stage === "calculating" && (
          <motion.div
            key="calculating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <MentorCalculating />
          </motion.div>
        )}

        {stage === "mentor-result" && recommendedMentor && mentorExplanation && (
          <motion.div
            key="mentor-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <MentorResult
              mentor={recommendedMentor}
              explanation={mentorExplanation}
              compatibilityScore={compatibilityScore}
              onConfirm={() => handleMentorConfirm(recommendedMentor)}
              onSeeAll={handleSeeAllMentors}
              seeAllLabel="See All Guides"
            />
          </motion.div>
        )}

        {stage === "mentor-result" && (!recommendedMentor || !mentorExplanation) && (
          <motion.div
            key="mentor-result-recovery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex min-h-screen items-center justify-center px-6"
          >
            <div className="max-w-md rounded-3xl border border-white/10 bg-black/35 p-6 text-center text-white shadow-2xl backdrop-blur-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
                Guide Match
              </p>
              <h1 className="mb-3 text-2xl font-bold">
                {mentorCatalogStatus === "loading" && !mentorCatalogRecoveryTimedOut
                  ? "Restoring your guide..."
                  : "Let's reconnect your guide"}
              </h1>
              <p className="text-sm leading-6 text-white/70">
                {mentorCatalogStatus === "loading" && !mentorCatalogRecoveryTimedOut
                  ? "We saved your progress. Give us a moment to reload the guide catalog."
                  : mentorCatalogStatus === "loading"
                    ? "The guide catalog is taking longer than expected. You can retry the match from your saved answers."
                    : "We couldn't restore that exact guide from your saved progress, so we'll help you pick or rematch safely."}
              </p>
              {mentorCatalogStatus !== "loading" || mentorCatalogRecoveryTimedOut ? (
                <button
                  type="button"
                  onClick={handleMentorResultRecovery}
                  className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                >
                  {mentorCatalogStatus === "ready" && mentors.length > 0 ? "Choose a Guide" : "Retry Guide Match"}
                </button>
              ) : null}
            </div>
          </motion.div>
        )}

        {stage === "mentor-grid" && (
          <motion.div
            key="mentor-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex flex-col p-6 pt-safe-lg"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Guide</h1>
              <p className="text-muted-foreground text-sm">Select the guide who resonates with you</p>
            </div>
            <MentorGrid
              mentors={mentors.map(m => ({
                ...m,
                archetype: m.mentor_type,
                style_description: m.tone_description,
                signature_line: m.description,
                themes: m.themes || [],
              }))}
              onSelectMentor={handleMentorSelectFromGrid}
              recommendedMentorId={recommendedMentor?.id}
            />
          </motion.div>
        )}

        {stage === "story-tone" && (
          <motion.div
            key="story-tone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            <OnboardingStoryToneSelection
              initialTone={selectedStoryTone}
              onComplete={handleStoryToneComplete}
              onBack={isResetMode ? undefined : handleStoryToneBack}
            />
          </motion.div>
        )}

        {stage === "egg-prelude" && (
          <motion.div
            key="egg-prelude"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            <EggSelectionPrelude
              storyTone={selectedStoryTone}
              speciesName="companion"
              onComplete={handleEggPreludeComplete}
              onBack={handleEggPreludeBack}
            />
          </motion.div>
        )}

        {stage === "companion" && (
          <motion.div
            key={isMigrationMode ? "companion-migration" : isResetMode ? "companion-reset" : "companion"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            {isMigrationMode ? (
              <CompanionPersonalization
                onComplete={handleCompanionComplete}
                isLoading={isCreatingCompanion}
                mode="migration"
                initialCompanionName={existingCompanion?.companion_name ?? null}
              />
            ) : (
              <AICompanionCreator
                onComplete={(data) => handleCompanionComplete({ presetId: null, ...data })}
                storyTone={selectedStoryTone}
                isLoading={isCreatingCompanion}
                title={isResetMode
                  ? "Shape Your New Companion"
                  : isCompanionCreationMode
                    ? "Choose Your Faith Companion"
                    : "Shape Your Companion"}
                description={
                  isResetMode
                    ? "Choose the color, nature, and symbolic creature that will carry your fresh start."
                    : isCompanionCreationMode
                      ? "Choose a Christian symbolic creature that will grow alongside your prayer, daily encouragement, and faithful actions."
                    : "Choose the color, nature, and symbolic creature that will grow beside your daily practice."
                }
                submitLabel={isCompanionCreationMode ? "Create My Companion" : "Continue"}
                onBack={isCompanionCreationMode ? undefined : handleCompanionBack}
              />
            )}
          </motion.div>
        )}

        {stage === "journey-begins" && isAwaitingJourneyCompletion && (
          <motion.div
            key="journey-companion-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            <CompanionCreationLoader />
          </motion.div>
        )}

        {stage === "journey-begins" && !isAwaitingJourneyCompletion && (
          <motion.div
            key="journey-begins"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            <JourneyBegins
              userName={userName}
              companionAnimal={companionAnimal}
              onComplete={handleJourneyComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {isPersistingOnboardingStep ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-safe z-50 flex justify-center px-6 pb-6"
        >
          <div className="rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-2xl backdrop-blur-xl">
            Saving...
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** @deprecated Use GracewardOnboarding. Kept as a source-compatible alias. */
export const StoryOnboarding = GracewardOnboarding;
