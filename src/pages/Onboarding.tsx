import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Questionnaire } from "@/components/Questionnaire";
import { MentorReveal } from "@/components/MentorReveal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { findBestMentor } from "@/utils/mentorMatching";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [stage, setStage] = useState<"questionnaire" | "reveal">("questionnaire");
  const [matchedMentor, setMatchedMentor] = useState<any>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (userTags: string[]) => {
    try {
      // Fetch all mentors
      const { data: mentors, error: mentorsError } = await supabase
        .from("mentors")
        .select("*");

      if (mentorsError) throw mentorsError;

      // Find best match
      const bestMentor = findBestMentor(userTags, mentors || []);

      if (!bestMentor) {
        toast({
          title: "No mentor found",
          description: "Please try again or contact support",
          variant: "destructive",
        });
        return;
      }

      // Save selected mentor to profile
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ selected_mentor_id: bestMentor.id })
          .eq("id", user.id);

        if (profileError) throw profileError;
      }

      setMatchedMentor(bestMentor);
      setStage("reveal");
    } catch (error) {
      console.error("Error matching mentor:", error);
      toast({
        title: "Error",
        description: "Failed to match mentor. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEnterTraining = () => {
    navigate("/");
  };

  return (
    <>
      {stage === "questionnaire" && (
        <Questionnaire onComplete={handleQuestionnaireComplete} />
      )}
      {stage === "reveal" && matchedMentor && (
        <MentorReveal mentor={matchedMentor} onEnter={handleEnterTraining} />
      )}
    </>
  );
}
