import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAllMentors } from "@/lib/firebase/mentors";
import { getProfile, updateProfile } from "@/lib/firebase/profiles";

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { StoryPrologue } from "./StoryPrologue";
import { DestinyReveal } from "./DestinyReveal";
import { FactionSelector, type FactionType } from "./FactionSelector";
import { CosmicBirthReveal } from "./CosmicBirthReveal";
import { StoryQuestionnaire, type OnboardingAnswer } from "./StoryQuestionnaire";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { JourneyBegins } from "./JourneyBegins";
import { MentorGrid } from "@/components/MentorGrid";
import { MentorResult } from "@/components/MentorResult";
import { type ZodiacSign } from "@/utils/zodiacCalculator";
import { generateMentorExplanation, type MentorExplanation } from "@/utils/mentorExplanation";
import { useCompanion } from "@/hooks/useCompanion";
import { canonicalizeTags, getCanonicalTag, MENTOR_FALLBACK_TAGS } from "@/config/mentorMatching";

/**
 * Wait for companion display name - checks companion document first, then evolution cards
 */
const waitForCompanionDisplayName = async (companionId: string): Promise<string | null> => {
  try {
    // First, check if companion document has display_name
    const { getDocument } = await import("@/lib/firebase/firestore");
    const companion = await getDocument<{ display_name?: string }>("user_companion", companionId);
    
    if (companion?.display_name) {
      return companion.display_name;
    }
    
    // Fallback: check evolution cards for creature_name
    const { getDocuments } = await import("@/lib/firebase/firestore");
    const existingCards = await getDocuments(
      "companion_evolution_cards",
      [["companion_id", "==", companionId]],
      "evolution_stage",
      "asc",
      1
    );
    
    if (existingCards.length > 0 && existingCards[0].creature_name) {
      // Store it in companion document for future use
      try {
        const { updateDocument } = await import("@/lib/firebase/firestore");
        await updateDocument("user_companion", companionId, {
          display_name: existingCards[0].creature_name,
        });
      } catch (updateError) {
        console.warn("Failed to store companion name from card (non-critical):", updateError);
      }
      return existingCards[0].creature_name;
    }
    
    return null;
  } catch (error) {
    console.error("Error getting companion display name:", error);
    return null;
  }
};

type OnboardingStage = 
  | "prologue" 
  | "destiny"
  | "faction" 
  | "cosmic-birth" 
  | "questionnaire" 
  | "mentor-result" 
  | "mentor-grid"
  | "companion"
  | "journey-begins";

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
}

const ENERGY_TO_INTENSITY: Record<string, "high" | "medium" | "gentle"> = {
  "Focused, intense energy": "high",
  "Calm, grounded presence": "gentle",
  "Warm, uplifting support": "medium",
  "Spiritual and intuitive guidance": "gentle",
};

const normalizeIntensityLevel = (value?: string | null): "high" | "medium" | "gentle" => {
  const normalized = value?.toLowerCase();
  if (!normalized) return "medium";
  if (["gentle", "soft", "low"].includes(normalized)) return "gentle";
  if (["high", "strong", "intense"].includes(normalized)) return "high";
  return "medium";
};


export const StoryOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { createCompanion } = useCompanion();
  
  // All useState hooks must be together
  const [stage, setStage] = useState<OnboardingStage>("prologue");
  const [userName, setUserName] = useState("");
  const [faction, setFaction] = useState<FactionType | null>(null);
  const [birthdate, setBirthdate] = useState("");
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [mentorExplanation, setMentorExplanation] = useState<MentorExplanation | null>(null);
  const [companionAnimal, setCompanionAnimal] = useState("");
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);

  // All useEffect hooks after all useState hooks
  // Auto scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  // Load mentors on mount from Firestore
  useEffect(() => {
    const loadMentors = async () => {
      try {
        console.log("[StoryOnboarding] Loading mentors from Firestore...");
        const mentorsData = await getAllMentors();
        
        if (mentorsData && mentorsData.length > 0) {
          console.log(`[StoryOnboarding] ✅ Loaded ${mentorsData.length} mentors from Firestore:`, mentorsData.map(m => m.name));
          const mappedMentors: Mentor[] = mentorsData.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description || "",
            tone_description: m.tone_description || "",
            avatar_url: m.avatar_url ?? undefined,
            tags: m.tags || [],
            mentor_type: m.mentor_type || "",
            target_user_type: m.target_user_type ?? undefined,
            slug: m.slug || "",
            short_title: m.short_title || "",
            primary_color: m.primary_color || "#7B68EE",
            target_user: m.target_user || "",
            themes: m.themes ?? undefined,
            intensity_level: m.intensity_level ?? undefined,
          }));
          setMentors(mappedMentors);
        } else {
          console.warn("[StoryOnboarding] ⚠️ No mentors found in Firestore");
        }
      } catch (error) {
        console.error("[StoryOnboarding] ❌ Exception loading mentors from Firestore:", error);
      }
    };
    loadMentors();
  }, []);

  const handlePrologueComplete = async (name: string) => {
    setUserName(name);
    
    // Save name to profile
    if (user) {
      try {
        const profile = await getProfile(user.uid);
        const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};

        await updateProfile(user.uid, {
          onboarding_data: {
            ...existingData,
            userName: name,
          },
        });
      } catch (error) {
        console.warn("Error updating profile (non-critical):", error);
      }
    }
    
    setStage("destiny");
  };

  const handleDestinyComplete = () => {
    setStage("faction");
  };

  const handleFactionComplete = async (selectedFaction: FactionType) => {
    setFaction(selectedFaction);
    
    // Save faction to profile
    if (user) {
      try {
        await updateProfile(user.uid, {
          faction: selectedFaction,
        });
      } catch (error) {
        console.warn("Error updating profile (non-critical):", error);
      }
    }
    
    setStage("cosmic-birth");
  };

  const handleCosmicBirthComplete = async (bd: string, sign: ZodiacSign) => {
    setBirthdate(bd);
    setZodiacSign(sign);
    
    // Save to profile
    if (user) {
      try {
        const profile = await getProfile(user.uid);
        const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
        
        await updateProfile(user.uid, {
          birthdate: bd,
          zodiac_sign: sign,
          onboarding_data: {
            ...existingData,
            birthdate: bd,
            zodiacSign: sign,
          },
        });
      } catch (error) {
        console.warn("Error updating profile (non-critical):", error);
      }
    }
    
    setStage("questionnaire");
  };

  const handleQuestionnaireComplete = async (questionAnswers: OnboardingAnswer[]) => {
    setAnswers(questionAnswers);

    // Question weights: Q1=1.4, Q2=1.4, Q3=1.0, Q4=1.3, Q5=1.2
    const QUESTION_WEIGHTS = [1.4, 1.4, 1.0, 1.3, 1.2];

    // Build canonical tag weight map instead of duplicating strings
    const canonicalTagWeights: Record<string, number> = {};
    questionAnswers.forEach((answer, index) => {
      const weight = QUESTION_WEIGHTS[index] ?? 1.0;
      answer.tags.forEach(tag => {
        const canonical = getCanonicalTag(tag);
        if (!canonical) return;
        canonicalTagWeights[canonical] = (canonicalTagWeights[canonical] ?? 0) + weight;
      });
    });

    // Extract desired intensity from Q4 (energy_preference)
    const energyAnswer = questionAnswers.find(a => a.questionId === "energy_preference");
    const desiredIntensity: "high" | "medium" | "gentle" = energyAnswer
      ? ENERGY_TO_INTENSITY[energyAnswer.answer] ?? "medium"
      : "medium";

    // Calculate scores for each mentor
    interface MentorScore {
      mentor: Mentor;
      score: number;
      exactMatches: number;
      intensityMatch: boolean;
    }
    const mentorScores: MentorScore[] = mentors.map(mentor => {
      const mentorCanonicalTags = (() => {
        const normalized = canonicalizeTags([...(mentor.tags || []), ...(mentor.themes || [])]);
        if (normalized.length > 0) {
          return normalized;
        }
        return MENTOR_FALLBACK_TAGS[mentor.slug] ?? [];
      })();

      let score = 0;
      let exactMatches = 0;

      mentorCanonicalTags.forEach(tag => {
        const tagWeight = canonicalTagWeights[tag];
        if (tagWeight) {
          score += tagWeight;
          exactMatches += 1;
        }
      });

      const mentorIntensity = normalizeIntensityLevel(mentor.intensity_level);
      const intensityMatch = mentorIntensity === desiredIntensity;
      if (intensityMatch) {
        score += 0.8;
      }

      return {
        mentor,
        score,
        exactMatches,
        intensityMatch,
      };
    });

    // Sort by score descending
    mentorScores.sort((a, b) => b.score - a.score);

    // Get top score
    const topScore = mentorScores[0]?.score ?? 0;

    // Find all mentors tied at the top
    const topMentors = mentorScores.filter(m => m.score === topScore);

    // Tie-breaking logic
    let bestMatch: Mentor | null = null;

    if (topMentors.length === 1) {
      bestMatch = topMentors[0].mentor;
    } else if (topMentors.length > 1) {
      // First tie-breaker: prefer intensity match
      const intensityMatches = topMentors.filter(m => m.intensityMatch);
      if (intensityMatches.length === 1) {
        bestMatch = intensityMatches[0].mentor;
      } else if (intensityMatches.length > 1) {
        // Second tie-breaker: prefer more exact matches
        intensityMatches.sort((a, b) => b.exactMatches - a.exactMatches);
        const topExactMatches = intensityMatches[0].exactMatches;
        const topExactMatchMentors = intensityMatches.filter(m => m.exactMatches === topExactMatches);

        if (topExactMatchMentors.length === 1) {
          bestMatch = topExactMatchMentors[0].mentor;
        } else {
          // Final tie-breaker: random selection
          const randomIndex = Math.floor(Math.random() * topExactMatchMentors.length);
          bestMatch = topExactMatchMentors[randomIndex].mentor;
        }
      } else {
        // No intensity matches, use exact match count
        topMentors.sort((a, b) => b.exactMatches - a.exactMatches);
        const topExactMatches = topMentors[0].exactMatches;
        const topExactMatchMentors = topMentors.filter(m => m.exactMatches === topExactMatches);

        if (topExactMatchMentors.length === 1) {
          bestMatch = topExactMatchMentors[0].mentor;
        } else {
          // Final tie-breaker: random selection
          const randomIndex = Math.floor(Math.random() * topExactMatchMentors.length);
          bestMatch = topExactMatchMentors[randomIndex].mentor;
        }
      }
    }

    // Fallback: if no match or score is 0, default to a reasonable mentor
    if (!bestMatch || topScore === 0) {
      // Try to find Atlas or Eli as fallbacks, or just pick the first mentor
      bestMatch = mentors.find(m => m.slug === "atlas")
        || mentors.find(m => m.slug === "eli")
        || mentors[0];
    }

    if (bestMatch) {
      setRecommendedMentor(bestMatch);

      // Convert answers to Record format for explanation generator
      const selectedAnswers: Record<string, string> = {};
      questionAnswers.forEach(answer => {
        selectedAnswers[answer.questionId] = answer.tags[0] || "";
      });

      // Generate explanation
      const explanation = generateMentorExplanation(bestMatch, selectedAnswers);
      setMentorExplanation(explanation);

      // Save questionnaire responses (TODO: Migrate questionnaire_responses to Firestore if needed)
      // For now, skip - questionnaire data is stored in onboarding_data

      setStage("mentor-result");
      return;
    }

    // Ultimate fallback if no mentors exist at all
    toast.error("We couldn't automatically match a mentor. Please pick one from the grid.");
    setStage("mentor-grid");
  };

  const handleMentorConfirm = async (mentor: Mentor, explanationOverride?: MentorExplanation | null) => {
    if (user) {
      try {
        const profile = await getProfile(user.uid);
        const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
        const explanationToSave = explanationOverride ?? mentorExplanation;
        
        await updateProfile(user.uid, {
          selected_mentor_id: mentor.id,
          onboarding_data: {
            ...existingData,
            mentorId: mentor.id,
            mentorName: mentor.name,
            explanation: explanationToSave ? {
              title: explanationToSave.title,
              subtitle: explanationToSave.subtitle,
              paragraph: explanationToSave.paragraph,
              bullets: explanationToSave.bullets,
            } : null,
          },
        });
        
        // Force immediate refetch to ensure fresh data
        await queryClient.refetchQueries({ queryKey: ["profile", user.uid] });
      } catch (error) {
        console.warn("Error updating profile (non-critical):", error);
      }
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

    setIsCreatingCompanion(true);

    try {
      const companionData = await createCompanion.mutateAsync({
        favoriteColor: preferences.favoriteColor,
        spiritAnimal: preferences.spiritAnimal,
        coreElement: preferences.coreElement,
        storyTone: preferences.storyTone,
      });

      if (!companionData?.id) {
        throw new Error("Companion record missing ID after creation.");
      }

      // Mark onboarding complete and save story tone
      try {
        const profile = await getProfile(user.uid);
        const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
        
        await updateProfile(user.uid, {
          onboarding_completed: true,
          onboarding_data: {
            ...existingData,
            walkthrough_completed: true,
            story_tone: preferences.storyTone,
          },
        });
      } catch (profileError) {
        console.warn("Error updating profile after companion creation (non-critical):", profileError);
      }

      // Force immediate refetch to ensure fresh data (invalidateQueries only marks stale)
      try {
        await queryClient.refetchQueries({ queryKey: ["profile", user.uid] });
      } catch (profileRefetchError) {
        console.warn("Error refetching profile (non-critical):", profileRefetchError);
      }
      
      // Wait for companion to be refetched before proceeding
      try {
        await queryClient.refetchQueries({ queryKey: ["companion", user.uid] });
      } catch (companionRefetchError) {
        console.warn("Error refetching companion (non-critical):", companionRefetchError);
      }
      
      // Small delay to ensure Firestore has propagated the data
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for companion display name (may have been generated during creation)
      const companionDisplayName = await waitForCompanionDisplayName(companionData.id);
      
      if (!companionDisplayName) {
        console.warn("Companion name was not ready in time; falling back to spirit animal.");
      }

      setCompanionAnimal(companionDisplayName || preferences.spiritAnimal);
      setStage("journey-begins");
    } catch (error) {
      console.error("Error creating companion:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Full error details:", { error, errorMessage, stack: error instanceof Error ? error.stack : undefined });
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsCreatingCompanion(false);
    }
  };

  const handleJourneyComplete = async () => {
    try {
      // Ensure companion is loaded before navigating
      if (user) {
        try {
          // Refetch companion (Firestore) - this might fail but that's okay
          await queryClient.refetchQueries({ queryKey: ["companion", user.uid] });
        } catch (companionError) {
          console.warn("Error refetching companion (non-critical):", companionError);
        }
        
        try {
          // Refetch profile (Firestore)
          await queryClient.refetchQueries({ queryKey: ["profile", user.uid] });
        } catch (profileError) {
          console.warn("Error refetching profile (non-critical):", profileError);
        }
        
        // Small delay to ensure data is available
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      toast.success("Welcome to Cosmiq! Your journey begins.");
      navigate("/tasks");
    } catch (error) {
      console.error("Error before navigation:", error);
      // Error already logged, just navigate
      // Navigate anyway - the tasks page will handle missing companion gracefully
      navigate("/tasks");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <StarfieldBackground />
      
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

        {stage === "cosmic-birth" && faction && (
          <motion.div
            key="cosmic-birth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <CosmicBirthReveal
              faction={faction}
              onComplete={handleCosmicBirthComplete}
            />
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
            />
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
              onConfirm={() => handleMentorConfirm(recommendedMentor)}
              onSeeAll={handleSeeAllMentors}
            />
          </motion.div>
        )}

        {stage === "mentor-grid" && (
          <motion.div
            key="mentor-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 min-h-screen flex flex-col p-6 pt-safe-top"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Mentor</h1>
              <p className="text-muted-foreground text-sm">Select the guide who resonates with you</p>
            </div>
            {mentors.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">Loading mentors...</p>
                  <p className="text-sm text-muted-foreground">If mentors don't appear, check the browser console for errors.</p>
                </div>
              </div>
            ) : (
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
            )}
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
