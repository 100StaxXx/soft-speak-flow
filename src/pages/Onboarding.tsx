import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();

  // Restore onboarding progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_step, onboarding_data")
        .eq("id", user.id)
        .single();
      
      if (profile?.onboarding_step && profile.onboarding_step !== 'complete') {
        const savedData = profile.onboarding_data as { 
          mentorId?: string;
          mentorName?: string;
          explanation?: MentorExplanation;
        } | null;
        
        if (profile.onboarding_step === 'mentor_reveal' && savedData?.mentorId) {
          // Fetch the mentor from database
          const { data: mentorData } = await supabase
            .from('mentors')
            .select('*')
            .eq('id', savedData.mentorId)
            .single();
          
          if (mentorData) {
            setStage('result');
            setRecommendedMentor(mentorData);
            if (savedData.explanation) {
              setExplanation(savedData.explanation);
            }
          }
        } else if (profile.onboarding_step === 'companion') {
          setStage('companion');
        } else if (profile.onboarding_step === 'browse') {
          setStage('browse');
        }
      }
    };
    loadProgress();
  }, [user]);

  // Scroll to top when stage changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage]);

  // No need to wait - profile updates are immediate
  const waitForProfileUpdate = async () => {
    // Small delay to ensure UI state updates
    await new Promise((r) => setTimeout(r, 100));
    return true;
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

      // Save progress
      await supabase
        .from("profiles")
        .update({
          onboarding_step: 'mentor_reveal',
          onboarding_data: {
            mentorId: bestMentor.id,
            mentorName: bestMentor.name,
            explanation: {
              title: mentorExplanation.title,
              subtitle: mentorExplanation.subtitle,
              paragraph: mentorExplanation.paragraph,
              bullets: mentorExplanation.bullets
            }
          }
        })
        .eq("id", currentUser.id);

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
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Invalidate profile cache
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });

      toast({
        title: "Mentor Selected!",
        description: `${recommendedMentor.name} is now your guide.`,
      });

      // Move to companion creation
      await waitForProfileUpdate();
      setStage('companion');
      
      // Save progress
      await supabase
        .from("profiles")
        .update({ onboarding_step: 'companion' })
        .eq("id", user.id);
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
        // Create companion
        await createCompanion.mutateAsync(data);
      }
      
      // Mark onboarding as complete
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          onboarding_step: 'complete',
          onboarding_data: {}
        })
        .eq('id', user!.id);
      
      // CRITICAL: Invalidate profile cache to force refetch with new data
      await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      
      // Set flag in localStorage for immediate check
      localStorage.setItem('onboardingComplete', 'true');
      
      // Small delay to ensure cache is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
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

  const handleSeeAllMentors = async () => {
    setStage('browse');
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_step: 'browse' })
        .eq("id", user.id);
    }
  };

  const handleMentorSelected = async (mentorId: string) => {
    if (!user) return;

    try {
      setSelecting(true);
      
      const chosenMentor = mentors.find(m => m.id === mentorId);

      const { error } = await supabase
        .from('profiles')
        .update({
          selected_mentor_id: mentorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      // Invalidate profile cache
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });

      toast({
        title: "Mentor Selected!",
        description: chosenMentor ? `${chosenMentor.name} is now your guide!` : "Your mentor has been selected!",
      });

      // Mark onboarding complete for walkthrough trigger
      localStorage.setItem('onboardingComplete', 'true');

      // Move to companion creation
      await waitForProfileUpdate();
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
