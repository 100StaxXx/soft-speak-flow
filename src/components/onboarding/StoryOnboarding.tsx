import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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


export const StoryOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [stage, setStage] = useState<OnboardingStage>("prologue");
  const [userName, setUserName] = useState("");

  // Auto scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  const [faction, setFaction] = useState<FactionType | null>(null);
  const [birthdate, setBirthdate] = useState("");
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [mentorExplanation, setMentorExplanation] = useState<MentorExplanation | null>(null);
  const [companionAnimal, setCompanionAnimal] = useState("");
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);

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
        .single();

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
    setFaction(selectedFaction);
    
    // Save faction to profile
    if (user) {
      await supabase.from("profiles").update({
        faction: selectedFaction,
      }).eq("id", user.id);
    }
    
    setStage("cosmic-birth");
  };

  const handleCosmicBirthComplete = async (bd: string, sign: ZodiacSign) => {
    setBirthdate(bd);
    setZodiacSign(sign);
    
    // Save to profile
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .single();
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      
      await supabase.from("profiles").update({
        birthdate: bd,
        zodiac_sign: sign,
        onboarding_data: {
          ...existingData,
          birthdate: bd,
          zodiacSign: sign,
        },
      }).eq("id", user.id);
    }
    
    setStage("questionnaire");
  };

  const handleQuestionnaireComplete = async (questionAnswers: OnboardingAnswer[]) => {
    setAnswers(questionAnswers);

    // Question weights: Q1=1.4, Q2=1.4, Q3=1.0, Q4=1.3, Q5=1.2
    const QUESTION_WEIGHTS = [1.4, 1.4, 1.0, 1.3, 1.2];

    // Build weighted tags - duplicate tags based on question weight
    const weightedUserTags: string[] = [];
    questionAnswers.forEach((answer, index) => {
      const weight = QUESTION_WEIGHTS[index] ?? 1.0;
      const repeats = Math.round(weight * 10); // Multiply by 10 for finer granularity
      for (let i = 0; i < repeats; i++) {
        weightedUserTags.push(...answer.tags.map(t => t.toLowerCase()));
      }
    });

    // Extract desired intensity from Q4 (energy_preference)
    const energyAnswer = questionAnswers.find(a => a.questionId === "energy_preference");
    let desiredIntensity = "medium"; // default
    if (energyAnswer) {
      const answerText = energyAnswer.answer;
      if (answerText === "Focused, intense energy") {
        desiredIntensity = "high";
      } else if (answerText === "Calm, grounded presence") {
        desiredIntensity = "medium";
      } else if (answerText === "Warm, uplifting support") {
        desiredIntensity = "medium";
      } else if (answerText === "Spiritual and intuitive guidance") {
        desiredIntensity = "medium";
      }
    }

    // Calculate scores for each mentor
    interface MentorScore {
      mentor: Mentor;
      score: number;
      exactMatches: number;
      partialMatches: number;
      intensityMatch: boolean;
    }

    const mentorScores: MentorScore[] = mentors.map(mentor => {
      const mentorAllTags = [...(mentor.tags || []), ...(mentor.themes || [])];
      let score = 0;
      let exactMatches = 0;
      let partialMatches = 0;

      // Count matches for each weighted user tag
      weightedUserTags.forEach(userTag => {
        mentorAllTags.forEach(mentorTag => {
          const userTagLower = userTag.toLowerCase();
          const mentorTagLower = mentorTag.toLowerCase();

          if (userTagLower === mentorTagLower) {
            // Exact match: +1.0
            score += 1.0;
            exactMatches += 1;
          } else if (
            userTagLower.includes(mentorTagLower) ||
            mentorTagLower.includes(userTagLower)
          ) {
            // Partial match: +0.5
            score += 0.5;
            partialMatches += 1;
          }
        });
      });

      // Intensity alignment bonus
      const intensityMatch = mentor.intensity_level?.toLowerCase() === desiredIntensity.toLowerCase();
      if (intensityMatch) {
        score += 1.0;
      }

      return {
        mentor,
        score,
        exactMatches,
        partialMatches,
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
        .single();
      
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
      let companionId: string;
      
      // Check if companion already exists
      const { data: existingCompanion } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existingCompanion) {
        console.log("Companion already exists, skipping creation");
        companionId = existingCompanion.id;
      } else {
        // Create companion with full personalization
        const { data: newCompanion, error } = await supabase
          .from("user_companion")
          .insert([{
            user_id: user.id,
            spirit_animal: preferences.spiritAnimal,
            current_stage: 0,
            current_xp: 0,
            core_element: preferences.coreElement,
            favorite_color: preferences.favoriteColor,
            story_tone: preferences.storyTone,
          }])
          .select("id")
          .single();
        
        if (error || !newCompanion) throw error || new Error("Failed to create companion");
        companionId = newCompanion.id;
        
        // Create stage 0 evolution record, generate image and card in background
        const generateStageZeroAssets = async () => {
          try {
            // Check if stage 0 evolution already exists
            const { data: existingEvolution } = await supabase
              .from("companion_evolutions")
              .select("id, image_url")
              .eq("companion_id", companionId)
              .eq("stage", 0)
              .maybeSingle();
            
            let evolutionId = existingEvolution?.id;
            
            if (!evolutionId) {
              // Create stage 0 evolution with placeholder image initially
              const { data: evolution, error: evolutionError } = await supabase
                .from("companion_evolutions")
                .insert({
                  companion_id: companionId,
                  stage: 0,
                  image_url: "/placeholder-egg.svg",
                  xp_at_evolution: 0,
                })
                .select("id")
                .single();
              
              if (evolutionError || !evolution) {
                console.error("Failed to create stage 0 evolution:", evolutionError);
                return;
              }
              evolutionId = evolution.id;
            }
            
            // Generate actual egg image if still placeholder
            if (!existingEvolution?.image_url || existingEvolution.image_url === "/placeholder-egg.svg") {
              try {
                const { data: imageResult } = await supabase.functions.invoke("generate-companion-image", {
                  body: {
                    spiritAnimal: preferences.spiritAnimal,
                    element: preferences.coreElement,
                    stage: 0,
                    favoriteColor: preferences.favoriteColor,
                  },
                });
                
                if (imageResult?.imageUrl) {
                  // Update evolution record with actual image
                  await supabase
                    .from("companion_evolutions")
                    .update({ image_url: imageResult.imageUrl })
                    .eq("id", evolutionId);
                  
                  // Update companion's current image
                  await supabase
                    .from("user_companion")
                    .update({ current_image_url: imageResult.imageUrl })
                    .eq("id", companionId);
                }
              } catch (imageError) {
                console.error("Stage 0 image generation failed (non-critical):", imageError);
              }
            }
            
            // Generate stage 0 card
            await supabase.functions.invoke("generate-evolution-card", {
              body: {
                companionId,
                evolutionId,
                stage: 0,
                species: preferences.spiritAnimal,
                element: preferences.coreElement,
                color: preferences.favoriteColor,
                userAttributes: { body: 50, mind: 50, soul: 50 },
              },
            });
          } catch (cardError) {
            console.error("Stage 0 asset generation failed (non-critical):", cardError);
          }
        };
        
        generateStageZeroAssets(); // Fire and forget - don't block onboarding
      }
      
      // Mark onboarding complete and save story tone
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .single();
      
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
      // Also refetch companion query to ensure it has the newly created companion
      await queryClient.refetchQueries({ queryKey: ["companion", user.id] });

      // Store companion animal and transition to journey begins
      setCompanionAnimal(preferences.spiritAnimal);
      setStage("journey-begins");
    } catch (error) {
      console.error("Error creating companion:", error);
      toast.error("Something went wrong. Please try again.");
      setIsCreatingCompanion(false);
    }
  };

  const handleJourneyComplete = () => {
    toast.success("Welcome to Cosmiq! Your journey begins.");
    navigate("/tasks");
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
