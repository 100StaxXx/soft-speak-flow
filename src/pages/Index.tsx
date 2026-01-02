import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
import { BottomNav } from "@/components/BottomNav";
import { useTheme } from "@/contexts/ThemeContext";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MentorQuickChat } from "@/components/MentorQuickChat";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { TodaysPepTalk } from "@/components/TodaysPepTalk";
import { MorningCheckIn } from "@/components/MorningCheckIn";
import { MorningBriefing } from "@/components/MorningBriefing";
import { EveningReflectionBanner } from "@/components/EveningReflectionBanner";
import { WeeklyRecapCard } from "@/components/WeeklyRecapCard";
import { DailyCoachPanel } from "@/components/DailyCoachPanel";
import { IndexPageSkeleton } from "@/components/skeletons";
import { MentorTutorialModal } from "@/components/MentorTutorialModal";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";

import { loadMentorImage } from "@/utils/mentorImageLoader";
import { getResolvedMentorId } from "@/utils/mentor";
import { Sparkles } from "lucide-react";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type IndexProps = {
  enableOnboardingGuard?: boolean;
};

const Index = ({ enableOnboardingGuard = false }: IndexProps) => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hasActiveHabits, setHasActiveHabits] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mentorImage, setMentorImage] = useState<string>("");
  const [todaysQuote, setTodaysQuote] = useState<{
    text: string;
    author: string | null;
  } | null>(null);
  const { showModal, dismissModal } = useFirstTimeModal("mentor");

  // Combined initialization effect for better performance
  const resolvedMentorId = useMemo(() => getResolvedMentorId(profile), [profile]);

  // Backfill mentor selection for users who completed onboarding but never persisted the mentor ID
  useEffect(() => {
    const syncMentorSelection = async () => {
      if (!user || !profile) return;

      const onboardingMentorId = (profile.onboarding_data as { mentorId?: string | null } | null)?.mentorId;
      const needsBackfill = profile.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId;

      if (!needsBackfill) return;

      const { error } = await supabase
        .from("profiles")
        .update({ selected_mentor_id: onboardingMentorId })
        .eq("id", user.id);

      if (error) {
        console.error("Failed to backfill mentor selection:", error);
        return;
      }

      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
    };

    void syncMentorSelection();
  }, [profile, queryClient, user]);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    let isMounted = true;

    const fetchMentorData = async () => {
      if (!resolvedMentorId) return;

      try {
        const { data: mentorData } = await supabase
          .from("mentors")
          .select("avatar_url, slug")
          .eq("id", resolvedMentorId)
          .maybeSingle();

        if (!isMounted || !mentorData) return;

        // Dynamically load only the mentor image we need (saves ~20MB!)
        const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'darius');
        if (isMounted) {
          setMentorImage(imageUrl);
        }

        // Get today's pep talk to find related quote
        const today = new Date().toLocaleDateString("en-CA");
        const { data: dailyPepTalk } = await supabase
          .from("daily_pep_talks")
          .select("emotional_triggers, topic_category")
          .eq("for_date", today)
          .eq("mentor_slug", mentorData.slug)
          .maybeSingle();

        if (!isMounted || !dailyPepTalk) return;

        // Try to fetch a quote that matches category first, then fall back to any quote
        let { data: quotes } = await supabase
          .from("quotes")
          .select("text, author")
          .eq("category", dailyPepTalk.topic_category)
          .limit(10);

        // If no category match, get any quotes
        if (!quotes || quotes.length === 0) {
          const { data: allQuotes } = await supabase
            .from("quotes")
            .select("text, author")
            .limit(20);
          quotes = allQuotes;
        }

        // Pick a random quote
        if (isMounted && quotes && quotes.length > 0) {
          const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
          setTodaysQuote(randomQuote);
        }
      } catch (error) {
        console.error('Error fetching mentor data:', error);
        // Non-critical error - continue without quote
      }
    };

    const checkHabits = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("habits")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);
        if (isMounted) {
          setHasActiveHabits(!!data && data.length > 0);
        }
      } catch (error) {
        console.error('Error checking habits:', error);
      }
    };

    // Run both async operations in parallel
    Promise.all([
      fetchMentorData(),
      checkHabits()
    ]).catch(error => {
      console.error('Error in initialization:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [resolvedMentorId, user]);

  // Wait for all critical data to load before marking ready
  useEffect(() => {
    if (!user) {
      setIsReady(false);
      return;
    }
    
    // Wait for both profile and companion to finish loading
    const loadingComplete = !profileLoading && !companionLoading;
    
    // If user completed onboarding, require mentor to be resolved before ready
    const hasCompletedOnboarding = profile?.onboarding_completed === true;
    const hasMentor = !!resolvedMentorId;
    
    // Ready = loading done AND (not completed onboarding OR has mentor)
    const ready = loadingComplete && (!hasCompletedOnboarding || hasMentor);
    setIsReady(ready);
  }, [user, profileLoading, companionLoading, profile?.onboarding_completed, resolvedMentorId]);

  // Check for incomplete onboarding pieces and redirect (only after data is ready)
  useEffect(() => {
    if (!enableOnboardingGuard) return;
    if (!user || !isReady || !profile) return;

    // If onboarding is explicitly completed, don't force users back into the flow
    if (profile.onboarding_completed === true) return;

    const missingMentor = !resolvedMentorId;
    const explicitlyIncomplete = profile.onboarding_completed === false;
    const missingCompanion = !companion && !companionLoading;

    if (missingMentor || explicitlyIncomplete || missingCompanion) {
      navigate("/onboarding");
    }
  }, [enableOnboardingGuard, user, isReady, profile, companion, companionLoading, navigate, resolvedMentorId]);

  // Show loading state with skeleton while critical data loads
  if (isTransitioning || !isReady) {
    return <IndexPageSkeleton />;
  }

  // Show error state if critical data failed to load
  if (!profileLoading && !companionLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Unable to Load Profile</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't load your profile data. Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!enableOnboardingGuard && isReady && !resolvedMentorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-accent/10 px-4 py-12">
        <div className="max-w-lg mx-auto text-center space-y-6 bg-card/70 backdrop-blur-sm border border-border/50 rounded-3xl p-8 shadow-soft">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary shadow-glow">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Choose your mentor to get started</h1>
            <p className="text-muted-foreground">
              Pick a mentor to unlock personalized guidance. You can always change your mentor later.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/mentor-selection")} className="flex-1 min-w-[180px]">
              Select Mentor
            </Button>
            <Button variant="ghost" onClick={() => navigate("/journeys")} className="flex-1 min-w-[180px]">
              View Quests
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Simple loading fallback
  const ComponentLoader = () => <div className="h-20" />;

  return (
    <>
      <PageTransition>
        {/* Cosmiq Starfield Background */}
        <StarfieldBackground />
        
        {/* Fixed Background Image */}
        {mentorImage && (
          <div className="fixed inset-0 z-0 pointer-events-none">
            <img
              src={mentorImage}
              alt="Mentor background"
              className="w-full h-full object-cover object-center"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-background/85" />
          </div>
        )}

        {/* Scrollable Content */}
        <div className="relative z-10 min-h-screen pb-24 sm:pb-24">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-48 sm:pt-32 md:pt-24 space-y-4 sm:space-y-6 md:space-y-8">

            {/* Quote of the Day */}
            {todaysQuote && (
              <div className="text-right px-4 sm:px-6">
                <blockquote className="max-w-2xl ml-auto">
                  <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-orange-400 leading-relaxed">
                    "{todaysQuote.text}"
                  </p>
                  {todaysQuote.author && (
                    <footer className="mt-2 font-serif italic text-sm sm:text-base text-orange-300/70">
                      — {todaysQuote.author}
                    </footer>
                  )}
                </blockquote>
              </div>
            )}
            
            <ErrorBoundary>
              <MorningCheckIn />
            </ErrorBoundary>

            <ErrorBoundary>
              <MorningBriefing className="animate-scale-in" />
            </ErrorBoundary>

            <ErrorBoundary>
              <EveningReflectionBanner />
            </ErrorBoundary>

            <ErrorBoundary>
              <WeeklyRecapCard />
            </ErrorBoundary>

            {/* Daily Coach Panel - AI-powered insights */}
            <ErrorBoundary>
              <DailyCoachPanel 
                maxInsights={3} 
                onInsightAction={(insight) => {
                  // Route actions to appropriate behavior based on actionType
                  switch (insight.actionType) {
                    case 'reschedule':
                    case 'add_break':
                    case 'simplify':
                      navigate('/journeys');
                      break;
                    case 'celebrate':
                      // Could show celebration modal, for now navigate to journeys
                      navigate('/journeys');
                      break;
                    default:
                      navigate('/journeys');
                  }
                }}
              />
            </ErrorBoundary>
          
            <ErrorBoundary>
              <TodaysPepTalk />
            </ErrorBoundary>

            {/* Ask Mentor Section */}
            <CompanionErrorBoundary>
              <ErrorBoundary>
                <div className="cosmiq-glass-ultra rounded-2xl">
                  <MentorQuickChat />
                </div>
              </ErrorBoundary>
            </CompanionErrorBoundary>

          </div>
        </div>
      </PageTransition>
      <ErrorBoundary>
        <BottomNav />
      </ErrorBoundary>
      <MentorTutorialModal open={showModal} onClose={dismissModal} />
    </>
  );
};

export default Index;
