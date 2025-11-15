import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Questionnaire } from "@/components/Questionnaire";
import { MentorSelection } from "@/components/MentorSelection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { findBestMentor, OnboardingAnswer, getTopMentorMatches } from "@/utils/mentorMatching";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const [stage, setStage] = useState<'questionnaire' | 'selection'>('questionnaire');
  const [recommendedMentor, setRecommendedMentor] = useState<any>(null);
  const [compatibleMentors, setCompatibleMentors] = useState<string[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (answers: OnboardingAnswer[]) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Save questionnaire responses
      const responses = answers.map(answer => ({
        user_id: currentUser.id,
        question_id: answer.questionId,
        answer_tags: answer.mentorTags
      }));

      await supabase.from('questionnaire_responses').insert(responses);

      // Fetch mentors and find best matches
      const { data: mentors } = await supabase
        .from('mentors')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (mentors && mentors.length > 0) {
        const bestMatch = findBestMentor(answers, mentors);
        const topMatches = getTopMentorMatches(answers, mentors);
        
        setRecommendedMentor(bestMatch);
        setCompatibleMentors(topMatches.map(m => m.id));
        setStage('selection');
      }
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to process questionnaire",
        variant: "destructive",
      });
    }
  };

  const handleMentorSelected = async (mentorId: string) => {
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            selected_mentor_id: mentorId,
            preferences: {
              compatible_mentor_ids: compatibleMentors
            }
          })
          .eq('id', user.id);

        toast({
          title: "Mentor Selected!",
          description: "Your journey begins now.",
        });

        navigate("/");
      }
    } catch (error) {
      console.error("Error selecting mentor:", error);
      toast({
        title: "Error",
        description: "Failed to select mentor",
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
