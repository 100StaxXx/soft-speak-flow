import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { EnhancedQuestionnaire } from "@/components/EnhancedQuestionnaire";
import { MentorResult } from "@/components/MentorResult";
import { MentorGrid } from "@/components/MentorGrid";
import { CompanionPersonalization } from "@/components/CompanionPersonalization";
import { NameInput } from "@/components/NameInput";
import { LegalAcceptance } from "@/components/LegalAcceptance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { retryWithBackoff } from "@/utils/retry";
import { calculateMentorScores } from "@/utils/mentorScoring";
import { generateMentorExplanation } from "@/utils/mentorExplanation";
import { OnboardingData } from "@/types/profile";

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
  const [stage, setStage] = useState<'legal' | 'name' | 'questionnaire' | 'result' | 'browse' | 'companion'>('legal');
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
        .maybeSingle();
      
      if (profile?.onboarding_step && profile.onboarding_step !== 'complete') {
        const savedData = profile.onboarding_data as OnboardingData | null;
        
        if (profile.onboarding_step === 'mentor_reveal' && savedData?.mentorId) {
          // Fetch the mentor from database
          const { data: mentorData } = await supabase
            .from('mentors')
            .select('*')
            .eq('id', savedData.mentorId)
            .maybeSingle();
          
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
        } else if (profile.onboarding_step === 'questionnaire' && savedData?.userName) {
          setStage('questionnaire');
        }
      }
    };
    loadProgress();
  }, [user]);

  // Restore onboarding progress - check if legal was already accepted
  useEffect(() => {
    const legalAccepted = localStorage.getItem('legal_accepted_at');
    if (legalAccepted && stage === 'legal') {
      setStage('name');
    }
  }, []);

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

  const handleLegalAccept = () => {
    setStage('name');
  };

  const handleNameSubmit = async (name: string) => {
    if (!user) return;

    try {
      setSelecting(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      const existingData = (profile?.onboarding_data as OnboardingData) || {};

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_step: 'questionnaire',
          onboarding_data: {
            ...existingData,
            userName: name,
          },
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Welcome!",
        description: `Nice to meet you, ${name}!`,
      });

      setStage('questionnaire');
    } catch (error: unknown) {
      console.error("Error saving name:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save name";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSelecting(false);
    }
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

      // Fetch existing onboarding_data to preserve userName
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", currentUser.id)
        .maybeSingle();

      const existingData = (existingProfile?.onboarding_data as OnboardingData) || {};

      // Save progress - preserve existing data like userName
      await supabase
        .from("profiles")
        .update({
          onboarding_step: 'mentor_reveal',
          onboarding_data: {
            ...existingData,
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
    if (!user || !recommendedMentor) {
      toast({
        title: "Error",
        description: "User or mentor information is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      setSelecting(true);
      
      console.log("Selecting mentor:", {
        userId: user.id,
        mentorId: recommendedMentor.id,
        mentorName: recommendedMentor.name
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({
          selected_mentor_id: recommendedMentor.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("Supabase update error:", error);
        throw error;
      }
      
      if (!data) throw new Error("Failed to update profile");

      console.log("Profile updated successfully:", data);

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
      const { error: progressError } = await supabase
        .from("profiles")
        .update({ onboarding_step: 'companion' })
        .eq("id", user.id);
        
      if (progressError) {
        console.error("Error saving onboarding progress:", progressError);
      }
    } catch (error: unknown) {
      console.error("Error selecting mentor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to select mentor";
      toast({
        title: "Error",
        description: errorMessage,
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
    storyTone: string;
  }) => {
    try {
      console.log("Starting companion creation:", data);
      
      // Check if companion already exists
      const { data: existingCompanion } = await supabase
        .from("user_companion")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!existingCompanion) {
        console.log("Creating new companion...");
        // Create companion with retry logic for slow connections
        try {
          await retryWithBackoff(
            () => createCompanion.mutateAsync(data),
            {
              maxAttempts: 3,
              initialDelay: 1000,
              shouldRetry: (error: unknown) => {
                // Retry on network errors and timeouts
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isNetworkError = errorMessage.includes('fetch') ||
                                     errorMessage.includes('network') ||
                                     errorMessage.includes('timeout');
                return isNetworkError;
              }
            }
          );
          console.log("Companion created successfully");
        } catch (companionError: unknown) {
          console.error("Companion creation error after retries:", companionError);
          const errorMessage = companionError instanceof Error ? companionError.message : "Failed to create companion. Please check your connection.";
          throw new Error(errorMessage);
        }
      } else {
        console.log("Companion already exists, skipping creation");
      }
      
      console.log("Marking onboarding as complete...");
      // Use SQL function to atomically merge onboarding_data
      // This prevents race conditions from concurrent updates
      const { data: updatedProfile, error: completeError } = await supabase.rpc('update_profile_onboarding_complete', {
        profile_id: user!.id
      });
      
      // Fallback: If RPC function doesn't exist, use standard update
      // (accepting potential race condition as unlikely in this flow)
      if (completeError && completeError.message?.includes('function') && completeError.message?.includes('does not exist')) {
        console.warn('RPC function not found, using fallback update');
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('onboarding_data')
          .eq('id', user!.id)
          .maybeSingle();

        const currentOnboardingData = (currentProfile?.onboarding_data as OnboardingData) || {};

        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from('profiles')
          .update({
            onboarding_completed: true,
            onboarding_step: 'complete',
            onboarding_data: currentOnboardingData
          })
          .eq('id', user!.id)
          .select()
          .single();
        
        if (fallbackError) throw fallbackError;
        // Use fallbackProfile for updatedProfile
        if (!fallbackProfile) throw new Error('Failed to complete onboarding');
      }
      
      if (completeError && !(completeError.message?.includes('function') && completeError.message?.includes('does not exist'))) {
        console.error("Error completing onboarding:", completeError);
        throw completeError;
      }
      
      console.log("Onboarding marked complete");
      
      // CRITICAL: Invalidate profile cache to force refetch with new data
      await queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
      
      // Set flag in localStorage for immediate check
      localStorage.setItem('onboardingComplete', 'true');
      
      // Wait longer to ensure database update propagates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("Navigating to home...");
      // Dispatch event to trigger walkthrough
      window.dispatchEvent(new CustomEvent('onboarding-complete'));
      // Navigate directly to home
      navigate("/", { replace: true });
    } catch (error: unknown) {
      console.error("Error in onboarding:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create companion. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
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
      {stage === "legal" && (
        <LegalAcceptance onAccept={handleLegalAccept} />
      )}

      {stage === "name" && (
        <NameInput
          onComplete={handleNameSubmit}
          isLoading={selecting}
        />
      )}

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
