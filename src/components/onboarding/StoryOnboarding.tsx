import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { safeNavigate } from "@/utils/nativeNavigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { StoryPrologue } from "./StoryPrologue";
import { DestinyReveal } from "./DestinyReveal";
import { FactionSelector, type FactionType } from "./FactionSelector";
import { StoryQuestionnaire, type OnboardingAnswer } from "./StoryQuestionnaire";
import { MentorCalculating } from "./MentorCalculating";
import { OnboardingCosmicBackdrop, type OnboardingBackdropStage } from "./OnboardingCosmicBackdrop";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { JourneyBegins } from "./JourneyBegins";
import { MentorGrid } from "@/components/MentorGrid";
import { MentorResult } from "@/components/MentorResult";
import { generateMentorExplanation, type MentorExplanation } from "@/utils/mentorExplanation";
import { useCompanion } from "@/hooks/useCompanion";
import { pollWithDeadline } from "@/utils/asyncTimeout";
import { logger } from "@/utils/logger";
import {
  filterMentorsByEnergyPreference,
  type EnergyPreference,
  getDesiredIntensityFromGuidanceTone,
  getEnergyPreferenceFromAnswers,
} from "@/utils/onboardingMentorMatching";
import { resolveAssignedMentorFromActiveMentors } from "@/config/onboardingMentorAssignments";

// Removed duplicate outer function - using inner component method instead

type OnboardingStage = 
  | "prologue" 
  | "destiny"
  | "faction" 
  | "questionnaire" 
  | "calculating"
  | "mentor-result" 
  | "mentor-grid"
  | "companion"
  | "journey-begins";

export const resolveOnboardingBackdropStage = (
  stage: OnboardingStage,
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
  return null;
};

export const resolveQuestionnaireCompletionStage = (): OnboardingStage => "calculating";
export const CALCULATING_STAGE_DURATION_MS = 2_000;
export const QUESTIONNAIRE_PIPELINE_TIMEOUT_MS = 8_000;

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

const COMPANION_RECOVERY_DEADLINE_MS = 30_000;
const COMPANION_RECOVERY_INTERVAL_MS = 3_000;
const DISPLAY_NAME_INITIAL_DELAY_MS = 2_000;
const DISPLAY_NAME_DEADLINE_MS = 20_000;
const DISPLAY_NAME_INTERVAL_MS = 1_000;
const onboardingLog = logger.scope("StoryOnboarding");


export const StoryOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createCompanion } = useCompanion();
  
  const [stage, setStage] = useState<OnboardingStage>("prologue");
  const [userName, setUserName] = useState("");

  // Auto scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  const [faction, setFaction] = useState<FactionType | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [mentorExplanation, setMentorExplanation] = useState<MentorExplanation | null>(null);
  const [companionAnimal, setCompanionAnimal] = useState("");
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);
  const [isSubmittingQuestionnaire, setIsSubmittingQuestionnaire] = useState(false);
  const [compatibilityScore, setCompatibilityScore] = useState<number | null>(null);
  const mentorRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropStage = resolveOnboardingBackdropStage(stage);

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

  const fetchActiveMentors = useCallback(async (): Promise<Mentor[]> => {
    const { data, error } = await supabase
      .from("mentors")
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

  const waitForCompanionDisplayName = async (companionId: string) => {
    await new Promise((resolve) => setTimeout(resolve, DISPLAY_NAME_INITIAL_DELAY_MS));

    return pollWithDeadline<string>({
      deadlineMs: DISPLAY_NAME_DEADLINE_MS,
      intervalMs: DISPLAY_NAME_INTERVAL_MS,
      task: async () => {
        const { data, error } = await supabase
          .from("companion_evolution_cards")
          .select("creature_name")
          .eq("companion_id", companionId)
          .order("evolution_stage", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data?.creature_name ?? null;
      },
      onPollError: (error) => {
        logger.warn("Companion display name poll failed", {
          companionId,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
  };

  // Load mentors on mount
  useEffect(() => {
    let cancelled = false;
    const loadMentors = async () => {
      const activeMentors = await fetchActiveMentors();
      if (cancelled) return;
      setMentors(activeMentors);
    };
    void loadMentors();
    return () => {
      cancelled = true;
    };
  }, [fetchActiveMentors]);

  const handlePrologueComplete = async (name: string) => {
    setUserName(name);
    
    // Save name to profile
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to load profile before saving onboarding name:", profileError);
        toast.error("We couldn't save your name right now. Please try again.");
        return;
      }

      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};

      const { error: updateError } = await supabase.from("profiles").update({
        onboarding_data: {
          ...existingData,
          userName: name,
        },
      }).eq("id", user.id);

      if (updateError) {
        console.error("Failed to save onboarding name:", updateError);
        toast.error("We couldn't save your name right now. Please try again.");
        return;
      }
    }
    
    setStage("destiny");
  };

  const handleDestinyComplete = () => {
    setStage("faction");
  };

const handleFactionComplete = async (selectedFaction: FactionType) => {
  // Set faction in local state FIRST
  setFaction(selectedFaction);
  
  // Save faction to profile
  if (user) {
    await supabase.from("profiles").update({
      faction: selectedFaction,
    }).eq("id", user.id);
  }
  
  setStage("questionnaire");
};

  const handleQuestionnaireComplete = async (questionAnswers: OnboardingAnswer[]) => {
    if (isSubmittingQuestionnaire) {
      return;
    }

    clearMentorRevealTimeout();
    setIsSubmittingQuestionnaire(true);
    setAnswers(questionAnswers);
    setStage(resolveQuestionnaireCompletionStage());

    try {
      const mentorPool = await runWithTimeout(
        mentors.length > 0 ? Promise.resolve(mentors) : fetchActiveMentors(),
        QUESTIONNAIRE_PIPELINE_TIMEOUT_MS,
        "mentor_pipeline_timeout",
      );

      if (mentors.length === 0 && mentorPool.length > 0) {
        setMentors(mentorPool);
      }

      if (mentorPool.length === 0) {
        onboardingLog.error("Mentor recommendation aborted: no active mentors available");
        toast.error("Mentor catalog is temporarily unavailable. Please try again in a moment.");
        setStage("questionnaire");
        return;
      }

      const assignment = resolveAssignedMentorFromActiveMentors(questionAnswers, mentorPool);
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

        // Persist questionnaire responses without blocking mentor reveal.
        if (user) {
          void Promise.all(
            questionAnswers.map((answer) =>
              supabase.from("questionnaire_responses").upsert({
                user_id: user.id,
                question_id: answer.questionId,
                answer_tags: answer.tags,
              }, { onConflict: "user_id,question_id" })
            ),
          )
            .then((results) => {
              const failedWrites = results.filter((result) => result.error);
              if (failedWrites.length > 0) {
                onboardingLog.warn("Some questionnaire responses failed to persist", {
                  failedCount: failedWrites.length,
                  userId: user.id,
                });
              }
            })
            .catch((error: unknown) => {
              onboardingLog.warn("Questionnaire response persistence failed", {
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              });
            });
        }

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
      toast.error("We couldn't automatically match a mentor. Please pick one from the grid.");
      setStage("mentor-grid");
    } catch (error) {
      onboardingLog.error("Questionnaire completion failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("We hit a temporary snag matching your mentor. Please try again.");
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
        toast.error("We couldn't save your mentor selection right now. Please try again.");
        return;
      }
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      const explanationToSave = explanationOverride ?? mentorExplanation;
      const energyPreference = getEnergyPreferenceFromAnswers(answers);
      
      const { error: updateError } = await supabase.from("profiles").update({
        selected_mentor_id: mentor.id,
        onboarding_data: {
          ...existingData,
          mentorId: mentor.id,
          mentorName: mentor.name,
          mentorEnergyPreference: energyPreference,
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
        toast.error("We couldn't save your mentor selection right now. Please try again.");
        return;
      }
      
      // Force immediate refetch to ensure fresh data
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
    }
    
    setStage("companion");
  };

  const handleSeeAllMentors = () => {
    setStage("mentor-grid");
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

  const handleCompanionComplete = async (preferences: {
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
    storyTone: string;
  }) => {
    if (!user || isCreatingCompanion) return;

    const startedAt = Date.now();
    let onboardingFinalized = false;
    setIsCreatingCompanion(true);

    const finalizeCompanionOnboarding = async (
      companionId: string,
      fallbackName: string,
      recoveredAfterTimeout: boolean,
    ) => {
      if (onboardingFinalized) return;
      onboardingFinalized = true;

      // Mark onboarding complete and save story tone
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      const nowIso = new Date().toISOString();
      const { error: completionError } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_data: {
            ...existingData,
            walkthrough_completed: true,
            story_tone: preferences.storyTone,
            guided_tutorial: {
              version: 2,
              flowVersion: 3,
              eligible: true,
              completedSteps: [],
              xpAwardedSteps: [],
              dismissed: false,
              completed: false,
              lastUpdatedAt: nowIso,
            },
          },
        })
        .eq("id", user.id);

      if (completionError) {
        throw completionError;
      }

      // Force immediate refetch to ensure fresh data (invalidateQueries only marks stale)
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
      await queryClient.refetchQueries({ queryKey: ["companion", user.id] });

      // Create first meeting memory (non-blocking)
      const today = new Date().toISOString().split("T")[0];
      supabase
        .from("companion_memories")
        .insert({
          user_id: user.id,
          companion_id: companionId,
          memory_type: "first_meeting",
          memory_date: today,
          memory_context: {
            title: "Our First Meeting",
            description: `The day we met - a ${preferences.spiritAnimal} appeared and our journey began.`,
            emotion: "wonder",
            details: {
              spiritAnimal: preferences.spiritAnimal,
              coreElement: preferences.coreElement,
            },
          },
          referenced_count: 0,
        })
        .then(({ error }) => {
          if (error) {
            logger.warn("Failed to create first meeting memory", {
              companionId,
              error: error.message,
            });
          }
        });

      setCompanionAnimal(fallbackName);
      setStage("journey-begins");

      logger.info("Companion onboarding finalized", {
        userId: user.id,
        companionId,
        recoveredAfterTimeout,
        durationMs: Date.now() - startedAt,
      });

      // Non-blocking display name hydration.
      void waitForCompanionDisplayName(companionId)
        .then((displayName) => {
          if (!displayName) {
            logger.warn("Companion display name not ready before deadline", {
              userId: user.id,
              companionId,
            });
            return;
          }
          setCompanionAnimal(displayName);
          void supabase
            .from("user_companion")
            .update({ cached_creature_name: displayName })
            .eq("id", companionId)
            .then(({ error: cacheError }) => {
              if (cacheError) {
                logger.warn("Failed to cache companion display name", {
                  userId: user.id,
                  companionId,
                  error: cacheError.message,
                });
              }
            });
          logger.info("Companion display name hydrated", {
            userId: user.id,
            companionId,
          });
        })
        .catch((displayNameError) => {
          logger.warn("Companion display name hydration failed", {
            userId: user.id,
            companionId,
            error:
              displayNameError instanceof Error
                ? displayNameError.message
                : String(displayNameError),
          });
        });
    };

    try {
      logger.info("Companion creation started from onboarding", {
        userId: user.id,
        spiritAnimal: preferences.spiritAnimal,
      });

      const companionData = await createCompanion.mutateAsync({
        favoriteColor: preferences.favoriteColor,
        spiritAnimal: preferences.spiritAnimal,
        coreElement: preferences.coreElement,
        storyTone: preferences.storyTone,
      });

      if (!companionData?.id) {
        throw new Error("Companion record missing ID after creation.");
      }

      await finalizeCompanionOnboarding(companionData.id, preferences.spiritAnimal, false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const normalizedErrorMessage = errorMessage.toUpperCase();
      const isTimeout =
        normalizedErrorMessage.includes("GENERATION_TIMEOUT") ||
        normalizedErrorMessage.includes("AI_TIMEOUT") ||
        normalizedErrorMessage.includes("TIMED OUT");

      if (isTimeout) {
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
          toast.success("Your companion finished taking shape. Continuing your journey...");
          await finalizeCompanionOnboarding(
            recoveredCompanion.id,
            recoveredCompanion.spirit_animal || preferences.spiritAnimal,
            true,
          );
          return;
        }

        logger.error("Companion recovery failed after timeout", {
          userId: user.id,
          recoveryWindowMs: COMPANION_RECOVERY_DEADLINE_MS,
          elapsedMs: Date.now() - startedAt,
        });
        toast.error("This is taking longer than expected. Tap Begin Your Journey to try again.");
        return;
      }

      logger.error("Error creating companion during onboarding", {
        userId: user.id,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCreatingCompanion(false);
    }
  };

  const handleJourneyComplete = () => {
    toast.success("Welcome to Cosmiq! Your journey begins.");
    safeNavigate(navigate, "/journeys");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <StarfieldBackground />
      {backdropStage && <OnboardingCosmicBackdrop stage={backdropStage} faction={faction} motionLevel="balanced" />}
      
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

        {stage === "destiny" && (
          <motion.div
            key="destiny"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <DestinyReveal userName={userName} onComplete={handleDestinyComplete} />
          </motion.div>
        )}

        {stage === "faction" && (
          <motion.div
            key="faction"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <FactionSelector onComplete={handleFactionComplete} />
          </motion.div>
        )}


        {stage === "questionnaire" && faction && (
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
              seeAllLabel="See All Mentors"
            />
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
              <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Mentor</h1>
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

        {stage === "companion" && faction && (
          <motion.div
            key="companion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full"
          >
            <CompanionPersonalization
              onComplete={handleCompanionComplete}
              isLoading={isCreatingCompanion}
            />
          </motion.div>
        )}

        {stage === "journey-begins" && (
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
    </div>
  );
};
