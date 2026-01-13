import { useState, useEffect } from "react";
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
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { JourneyBegins } from "./JourneyBegins";
import { MentorGrid } from "@/components/MentorGrid";
import { MentorResult } from "@/components/MentorResult";
import { type ZodiacSign } from "@/utils/zodiacCalculator";
import { generateMentorExplanation, type MentorExplanation } from "@/utils/mentorExplanation";
import { useCompanion } from "@/hooks/useCompanion";
import { canonicalizeTags, getCanonicalTag, MENTOR_FALLBACK_TAGS } from "@/config/mentorMatching";

const waitForCompanionDisplayName = async (companionId: string) => {
  const MAX_ATTEMPTS = 10;
  const DELAY_MS = 1500;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("companion_evolution_cards")
      .select("creature_name")
      .eq("companion_id", companionId)
      .eq("evolution_stage", 0)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch companion display name:", error);
    }

    const name = data?.creature_name?.trim();
    if (name) {
      return name;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return null;
};

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
  "Intense and no-excuses": "high",
  "Steady and empowering": "medium",
  "Gentle and nurturing": "gentle",
  "Ethereal and transcendent": "gentle",
  // New intensity_preference question mappings
  "Push me hard — I need direct, no-excuses accountability": "high",
  "Challenge me, but with encouragement and compassion": "medium",
  "Guide me gently — I'm working through something tender": "gentle",
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

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForCompanionDisplayName = async (companionId: string) => {
    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await supabase
        .from("companion_evolution_cards")
        .select("creature_name")
        .eq("companion_id", companionId)
        .order("evolution_stage", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching companion name:", error);
        return null;
      }

      if (data?.creature_name) {
        return data.creature_name as string;
      }

      if (attempt < maxAttempts) {
        await wait(delayMs);
      }
    }

    return null;
  };

  // Load mentors on mount
  useEffect(() => {
    const loadMentors = async () => {
      const { data } = await supabase
        .from("mentors")
        .select("*")
        .eq("is_active", true);
      if (data) {
        // Map to our Mentor interface with defaults for required fields
        const mappedMentors: Mentor[] = data.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          tone_description: m.tone_description,
          avatar_url: m.avatar_url ?? undefined,
          tags: m.tags || [],
          mentor_type: m.mentor_type,
          target_user_type: m.target_user_type ?? undefined,
          slug: m.slug || "",
          short_title: m.short_title || "",
          primary_color: m.primary_color || "#7B68EE",
          target_user: m.target_user || "",
          themes: m.themes ?? undefined,
          intensity_level: m.intensity_level ?? undefined,
        }));
        setMentors(mappedMentors);
      }
    };
    loadMentors();
  }, []);

  const handlePrologueComplete = async (name: string) => {
    setUserName(name);
    
    // Save name to profile
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};

      await supabase.from("profiles").update({
        onboarding_data: {
          ...existingData,
          userName: name,
        },
      }).eq("id", user.id);
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
    setAnswers(questionAnswers);
    
    // Show loading screen immediately
    setStage("calculating");

    // Question weights: Q1=1.5, Q2=1.4, Q3=1.3, Q4=1.2, Q5=1.1
    const QUESTION_WEIGHTS = [1.5, 1.4, 1.3, 1.2, 1.1];

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

    // Extract desired intensity from Q3 (energy_level)
    const energyAnswer = questionAnswers.find(a => a.questionId === "mentor_energy");
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

      // Save questionnaire responses
      if (user) {
        for (const answer of questionAnswers) {
          await supabase.from("questionnaire_responses").upsert({
            user_id: user.id,
            question_id: answer.questionId,
            answer_tags: answer.tags,
          }, { onConflict: "user_id,question_id" });
        }
      }

      setStage("mentor-result");
      return;
    }

    // Ultimate fallback if no mentors exist at all
    toast.error("We couldn't automatically match a mentor. Please pick one from the grid.");
    setStage("mentor-grid");
  };

  const handleMentorConfirm = async (mentor: Mentor, explanationOverride?: MentorExplanation | null) => {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      const explanationToSave = explanationOverride ?? mentorExplanation;
      
      await supabase.from("profiles").update({
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
      }).eq("id", user.id);
      
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      
      await supabase.from("profiles").update({
        onboarding_completed: true,
        onboarding_data: {
          ...existingData,
          walkthrough_completed: true,
          story_tone: preferences.storyTone,
        },
      }).eq("id", user.id);

      // Force immediate refetch to ensure fresh data (invalidateQueries only marks stale)
      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
      await queryClient.refetchQueries({ queryKey: ["companion", user.id] });

      // Create first meeting memory (non-blocking)
      const today = new Date().toISOString().split('T')[0];
      supabase.from('companion_memories').insert({
        user_id: user.id,
        companion_id: companionData.id,
        memory_type: 'first_meeting',
        memory_date: today,
        memory_context: {
          title: 'Our First Meeting',
          description: `The day we met - a ${preferences.spiritAnimal} appeared and our journey began.`,
          emotion: 'wonder',
          details: { 
            spiritAnimal: preferences.spiritAnimal,
            coreElement: preferences.coreElement,
          },
        },
        referenced_count: 0,
      }).then(({ error }) => {
        if (error) console.error('Failed to create first meeting memory:', error);
      });

      const companionDisplayName = await waitForCompanionDisplayName(companionData.id);
      if (!companionDisplayName) {
        console.warn("Companion name was not ready in time; falling back to spirit animal.");
      }

      setCompanionAnimal(companionDisplayName || preferences.spiritAnimal);
      setStage("journey-begins");
    } catch (error) {
      console.error("Error creating companion:", error);
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
