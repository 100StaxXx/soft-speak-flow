import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EnhancedQuestionnaire } from "@/components/EnhancedQuestionnaire";
import { MentorResult } from "@/components/MentorResult";
import { MentorGrid } from "@/components/MentorGrid";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { calculateMentorScores } from "@/utils/mentorScoring";
import { generateMentorExplanation } from "@/utils/mentorExplanation";

interface Mentor {
  id: string;
  name: string;
  description: string;
  slug: string;
  avatar_url: string | null;
  short_title: string;
  primary_color: string;
  archetype: string;
  tone_description: string;
  style_description: string;
  tags: string[];
  target_user: string;
  signature_line: string;
  themes: string[];
}

interface MentorExplanation {
  title: string;
  subtitle: string;
  paragraph: string;
  bullets: string[];
}

export default function Onboarding() {
  const [stage, setStage] = useState<'questionnaire' | 'result' | 'browse' | 'companion'>('questionnaire');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recommendedMentor, setRecommendedMentor] = useState<Mentor | null>(null);
  const [explanation, setExplanation] = useState<MentorExplanation | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selecting, setSelecting] = useState(false);
  const { user } = useAuth();
  const { createCompanion } = useCompanion();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage]);

  const waitForProfileUpdate = async (userId: string, tries = 8) => {
    for (let i = 0; i < tries; i++) {
      const { data } = await supabase
        .from('profiles')
        .select('selected_mentor_id')
        .eq('id', userId)
        .maybeSingle();
      if (data?.selected_mentor_id) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

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

      const { error } = await supabase
        .from('profiles')
        .update({
          selected_mentor_id: recommendedMentor.id,
          // DON'T mark onboarding as complete yet - need to create companion first
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Mentor Selected!",
        description: `${recommendedMentor.name} is now your guide.`,
      });

      // Wait for the profile to reflect the update
      await waitForProfileUpdate(user.id);

      // Move to companion creation
      setStage('companion');
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

  const handleCompanionCreated = async (data: {
    favoriteColor: string;
    spiritAnimal: string;
    coreElement: string;
  }) => {
    try {
      // Check if companion already exists
      const { data: existingCompanion } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!existingCompanion) {
        // Create companion only if it doesn't exist
        await createCompanion.mutateAsync(data);
      }
      
      // Don't mark onboarding as complete - let the tour handle it
      // Navigate directly to home
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error in onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to create companion. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSeeAllMentors = () => {
    setStage('browse');
  };

  const handleMentorSelected = async (mentorId: string) => {
    if (!user) return;

    try {
      setSelecting(true);
      
      const chosenMentor = mentors.find(m => m.id === mentorId);
      // Selecting mentor

      const { error } = await supabase
        .from('profiles')
        .update({
          selected_mentor_id: mentorId,
          // DON'T mark onboarding as complete yet - need to create companion first
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Mentor Selected!",
        description: chosenMentor ? `${chosenMentor.name} is now your guide!` : "Your mentor has been selected!",
      });

      // Wait for the profile to reflect the update
      await waitForProfileUpdate(user.id);

      // Mark onboarding complete for walkthrough trigger
      localStorage.setItem('onboardingComplete', 'true');

      // Move to companion creation instead of navigating away
      setStage('companion');
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

      {stage === "companion" && (
        <CompanionPersonalization
          onComplete={handleCompanionCreated}
          isLoading={createCompanion.isPending}
        />
      )}
    </>
  );
}
