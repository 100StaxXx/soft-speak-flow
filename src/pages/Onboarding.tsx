import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Questionnaire } from "@/components/Questionnaire";
import { MentorSelection } from "@/components/MentorSelection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { findBestMentor } from "@/utils/mentorMatching";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [stage, setStage] = useState<"questionnaire" | "selection">("questionnaire");
  const [recommendedMentor, setRecommendedMentor] = useState<any>(null);
  const [userTags, setUserTags] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (collectedTags: string[]) => {
    try {
      // Save questionnaire responses
      if (user) {
        const { error: responseError } = await supabase
          .from("questionnaire_responses")
          .insert({
            user_id: user.id,
            question_id: "onboarding_flow",
            answer_tags: collectedTags,
          });

        if (responseError) throw responseError;
      }

      // Fetch all mentors
      const { data: mentors, error: mentorsError } = await supabase
        .from("mentors")
        .select("*");

      if (mentorsError) throw mentorsError;

      // Find best match
      const bestMentor = findBestMentor(collectedTags, mentors || []);

      if (!bestMentor) {
        toast({
          title: "No mentor found",
          description: "Please try again or contact support",
          variant: "destructive",
        });
        return;
      }

      setRecommendedMentor(bestMentor);
      setUserTags(collectedTags);
      setStage("selection");
    } catch (error) {
      console.error("Error processing questionnaire:", error);
      toast({
        title: "Error",
        description: "Failed to process questionnaire. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMentorSelected = async (mentorId: string) => {
    try {
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ selected_mentor_id: mentorId })
          .eq("id", user.id);

        if (profileError) throw profileError;

        toast({
          title: "Mentor Selected!",
          description: "Your training journey begins now.",
        });

        navigate("/");
      }
    } catch (error) {
      console.error("Error selecting mentor:", error);
      toast({
        title: "Error",
        description: "Failed to select mentor. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {stage === "questionnaire" && (
        <Questionnaire onComplete={handleQuestionnaireComplete} />
      )}
      {stage === "selection" && recommendedMentor && (
        <MentorSelection 
          recommendedMentor={recommendedMentor} 
          onMentorSelected={handleMentorSelected}
        />
      )}
    </>
  );
}
