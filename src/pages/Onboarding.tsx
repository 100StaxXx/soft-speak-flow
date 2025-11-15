import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Questionnaire } from "@/components/Questionnaire";
import { MentorGrid } from "@/components/MentorGrid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { findBestMentor, OnboardingAnswer, getTopMentorMatches } from "@/utils/mentorMatching";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Onboarding() {
  const [stage, setStage] = useState<'questionnaire' | 'selection'>('questionnaire');
  const [mentors, setMentors] = useState<any[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<any>(null);
  const [compatibleMentors, setCompatibleMentors] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
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
      const { data: mentorsData } = await supabase
        .from('mentors')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (mentorsData && mentorsData.length > 0) {
        const bestMatch = findBestMentor(answers, mentorsData);
        const topMatches = getTopMentorMatches(answers, mentorsData);
        
        setMentors(mentorsData);
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
    if (!user) return;

    try {
      setSelecting(true);
      
      await supabase
        .from('profiles')
        .update({ 
          selected_mentor_id: mentorId,
          preferences: {
            compatible_mentor_ids: compatibleMentors
          }
        })
        .eq('id', user.id);

      const selectedMentor = mentors.find(m => m.id === mentorId);
      
      toast({
        title: "Mentor selected!",
        description: `${selectedMentor?.name} will guide your journey.`,
      });

      navigate("/");
    } catch (error) {
      console.error("Error selecting mentor:", error);
      toast({
        title: "Error",
        description: "Failed to select mentor",
        variant: "destructive",
      });
    } finally {
      setSelecting(false);
    }
  };

  return (
    <>
      {stage === "questionnaire" && (
        <Questionnaire onComplete={handleQuestionnaireComplete} />
      )}
      {stage === "selection" && mentors.length > 0 && (
        <div className="min-h-screen bg-obsidian py-16 px-4 md:px-8">
          <div className="max-w-7xl mx-auto space-y-16">
            {/* Header */}
            <div className="text-center space-y-6 animate-fade-in">
              <div className="h-1 w-24 bg-royal-gold mx-auto animate-scale-in" />
              <h1 className="text-5xl md:text-7xl font-black text-pure-white uppercase tracking-tight">
                Your Perfect Match
              </h1>
              {recommendedMentor && (
                <div className="space-y-2">
                  <p className="text-xl text-steel">
                    Based on your answers, we recommend
                  </p>
                  <p className="text-3xl font-bold text-royal-gold">
                    {recommendedMentor.name}
                  </p>
                  <p className="text-lg text-steel italic">
                    But feel free to explore all mentors below
                  </p>
                </div>
              )}
            </div>

            {/* Mentor Grid */}
            <MentorGrid 
              mentors={mentors}
              onSelectMentor={handleMentorSelected}
              currentMentorId={recommendedMentor?.id}
              isSelecting={selecting}
            />
          </div>
        </div>
      )}
    </>
  );
}
