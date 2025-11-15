import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EnhancedQuestionnaire } from "@/components/EnhancedQuestionnaire";
import { MentorResult } from "@/components/MentorResult";
import { MentorGrid } from "@/components/MentorGrid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { calculateMentorScores } from "@/utils/mentorScoring";
import { generateMentorExplanation } from "@/utils/mentorExplanation";

export default function Onboarding() {
  const [stage, setStage] = useState<'questionnaire' | 'result' | 'browse'>('questionnaire');
  const [mentors, setMentors] = useState<any[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<any>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selecting, setSelecting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (completedAnswers: Record<string, string>) => {
    try {
      setAnswers(completedAnswers);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Fetch mentors
      const { data: mentorsData } = await supabase
        .from('mentors')
        .select('*')
        .eq('is_active', true)
        .order('created_at');

      if (!mentorsData || mentorsData.length === 0) {
        toast({
          title: "Error",
          description: "No mentors available",
          variant: "destructive",
        });
        return;
      }

      setMentors(mentorsData);

      // Calculate best mentor
      const result = calculateMentorScores(completedAnswers, mentorsData);
      const bestMentor = mentorsData.find(m => m.slug === result.winnerSlug);

      if (!bestMentor) {
        toast({
          title: "Error",
          description: "Could not determine best mentor",
          variant: "destructive",
        });
        return;
      }

      // Generate explanation
      const mentorExplanation = generateMentorExplanation(bestMentor, completedAnswers);

      setRecommendedMentor(bestMentor);
      setExplanation(mentorExplanation);
      setStage('result');

      // Save questionnaire responses
      const responses = Object.entries(completedAnswers).map(([questionId, optionId]) => ({
        user_id: currentUser.id,
        question_id: questionId,
        answer_tags: [optionId]
      }));

      await supabase.from('questionnaire_responses').insert(responses);
    } catch (error) {
      console.error('Error processing questionnaire:', error);
      toast({
        title: "Error",
        description: "Failed to process questionnaire",
        variant: "destructive",
      });
    }
  };

  const handleConfirmMentor = async () => {
    if (!user || !recommendedMentor) return;

    try {
      setSelecting(true);

      await supabase
        .from('profiles')
        .update({
          selected_mentor_id: recommendedMentor.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      toast({
        title: "Mentor selected!",
        description: `${recommendedMentor.name} will guide your journey.`,
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

  const handleSeeAllMentors = () => {
    setStage('browse');
  };

  const handleMentorSelected = async (mentorId: string) => {
    if (!user) return;

    try {
      setSelecting(true);

      await supabase
        .from('profiles')
        .update({
          selected_mentor_id: mentorId,
          updated_at: new Date().toISOString()
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
        <EnhancedQuestionnaire onComplete={handleQuestionnaireComplete} />
      )}

      {stage === "result" && recommendedMentor && explanation && (
        <MentorResult
          mentor={recommendedMentor}
          explanation={explanation}
          onConfirm={handleConfirmMentor}
          onSeeAll={handleSeeAllMentors}
          isConfirming={selecting}
        />
      )}

      {stage === "browse" && mentors.length > 0 && (
        <div className="min-h-screen bg-obsidian py-16 px-4 md:px-8">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-6 animate-fade-in">
              <div className="h-1 w-24 bg-royal-purple mx-auto animate-scale-in" />
              <h1 className="text-5xl md:text-7xl font-black text-pure-white uppercase tracking-tight">
                Choose Your Mentor
              </h1>
              <p className="text-xl text-steel">
                We recommended {recommendedMentor?.name}, but feel free to explore all options
              </p>
            </div>

            <MentorGrid
              mentors={mentors}
              onSelectMentor={handleMentorSelected}
              currentMentorId={recommendedMentor?.id}
              recommendedMentorId={recommendedMentor?.id}
              isSelecting={selecting}
            />
          </div>
        </div>
      )}
    </>
  );
}
