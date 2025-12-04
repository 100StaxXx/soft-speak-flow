import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { StoryPrologue } from "./StoryPrologue";
import { FactionSelector, type FactionType } from "./FactionSelector";
import { CosmicBirthReveal } from "./CosmicBirthReveal";
import { StoryQuestionnaire, type OnboardingAnswer } from "./StoryQuestionnaire";
import { QuickCompanionCreator } from "./QuickCompanionCreator";
import { MentorResult } from "@/components/MentorResult";
import { type ZodiacSign } from "@/utils/zodiacCalculator";
import { generateMentorExplanation } from "@/utils/mentorExplanation";

type OnboardingStage = 
  | "prologue" 
  | "faction" 
  | "cosmic-birth" 
  | "questionnaire" 
  | "mentor-result" 
  | "companion";

interface Mentor {
  id: string;
  name: string;
  description: string;
  tone_description: string;
  avatar_url?: string;
  tags: string[];
  mentor_type: string;
  target_user_type?: string;
  slug?: string;
  short_title?: string;
  primary_color?: string;
}

interface MentorExplanation {
  title: string;
  subtitle: string;
  paragraph: string;
  bullets: string[];
}

export const StoryOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [stage, setStage] = useState<OnboardingStage>("prologue");
  const [userName, setUserName] = useState("");
  const [faction, setFaction] = useState<FactionType | null>(null);
  const [birthdate, setBirthdate] = useState("");
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [mentorExplanation, setMentorExplanation] = useState<MentorExplanation | null>(null);
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);

  // Load mentors on mount
  useEffect(() => {
    const loadMentors = async () => {
      const { data } = await supabase
        .from("mentors")
        .select("*")
        .eq("is_active", true);
      if (data) {
        setMentors(data);
      }
    };
    loadMentors();
  }, []);

  // Faction-specific colors for theming
  const factionColors: Record<FactionType, { primary: string; gradient: string }> = {
    starfall: { primary: "hsl(24, 100%, 50%)", gradient: "from-orange-500 to-red-600" },
    void: { primary: "hsl(270, 70%, 50%)", gradient: "from-purple-600 to-indigo-700" },
    stellar: { primary: "hsl(200, 90%, 60%)", gradient: "from-cyan-400 to-blue-600" },
  };

  const handlePrologueComplete = async (name: string) => {
    setUserName(name);
    
    // Save name to profile
    if (user) {
      await supabase.from("profiles").update({
        onboarding_data: { userName: name },
      }).eq("id", user.id);
    }
    
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
    
    // Calculate best mentor using tag matching
    const allTags = questionAnswers.flatMap(a => a.tags);
    
    const mentorScores = mentors.map(mentor => {
      const matchingTags = mentor.tags.filter(tag => 
        allTags.some(userTag => tag.toLowerCase().includes(userTag.toLowerCase()) || userTag.toLowerCase().includes(tag.toLowerCase()))
      );
      return { mentor, score: matchingTags.length };
    });
    
    const bestMatch = mentorScores.sort((a, b) => b.score - a.score)[0]?.mentor;
    
    if (bestMatch) {
      setRecommendedMentor(bestMatch);
      
      // Generate explanation
      const explanation = generateMentorExplanation(bestMatch, allTags);
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
    }
    
    setStage("mentor-result");
  };

  const handleMentorConfirm = async (mentor: Mentor) => {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .single();
      
      const existingData = (profile?.onboarding_data as Record<string, unknown>) || {};
      
      await supabase.from("profiles").update({
        selected_mentor_id: mentor.id,
        onboarding_data: {
          ...existingData,
          mentorId: mentor.id,
          mentorName: mentor.name,
          explanation: mentorExplanation as unknown as Record<string, unknown>,
        },
      }).eq("id", user.id);
    }
    
    setStage("companion");
  };

  const handleCompanionComplete = async (animal: string, element: string, name: string) => {
    if (!user || isCreatingCompanion) return;
    
    setIsCreatingCompanion(true);
    
    try {
      // Check if companion already exists
      const { data: existingCompanion } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existingCompanion) {
        console.log("Companion already exists, skipping creation");
      } else {
        // Create companion
        const factionColorMap: Record<FactionType, string[]> = {
          starfall: ["#FF6B35", "#FF8C42", "#FFD93D"],
          void: ["#7B68EE", "#9370DB", "#4B0082"],
          stellar: ["#4ECDC4", "#45B7D1", "#96CEB4"],
        };
        
        const colors = faction ? factionColorMap[faction] : ["#7B68EE", "#9370DB", "#4B0082"];
        
        const { error } = await supabase.from("user_companion").insert([{
          user_id: user.id,
          species: animal,
          name: name,
          color_palette: colors,
          current_stage: 0,
          total_xp: 0,
          core_element: element,
          favorite_color: colors[0],
        }]);
        
        if (error) throw error;
      }
      
      // Mark onboarding complete
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
        },
      }).eq("id", user.id);
      
      toast.success("Welcome to Cosmiq! Your journey begins.");
      navigate("/tasks");
    } catch (error) {
      console.error("Error creating companion:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCreatingCompanion(false);
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
              mentor={{ ...recommendedMentor, short_title: recommendedMentor.short_title || "", primary_color: recommendedMentor.primary_color || "#7B68EE" }}
              explanation={mentorExplanation}
              onConfirm={() => handleMentorConfirm(recommendedMentor)}
              onSeeAll={() => {}}
            />
          </motion.div>
        )}

        {stage === "companion" && faction && (
          <motion.div
            key="companion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10"
          >
            <QuickCompanionCreator
              faction={faction}
              onComplete={handleCompanionComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
