import { useEffect, useMemo, useCallback, memo } from "react";
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
import { ParallaxCard } from "@/components/ui/parallax-card";
import { Button } from "@/components/ui/button";
import { loadMentorImage } from "@/utils/mentorImageLoader";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "@/utils/mentor";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const { showModal, dismissModal } = useFirstTimeModal("mentor");

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Combined initialization effect for better performance
  const resolvedMentorId = useMemo(() => getResolvedMentorId(profile), [profile]);

  // Backfill mentor selection for users who completed onboarding but never persisted the mentor ID
  useEffect(() => {
    const syncMentorSelection = async () => {
      if (!user || !profile) return;

      const onboardingMentorId = getOnboardingMentorId(profile);
      const needsBackfill = profile.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId;

      if (!needsBackfill) return;

      const { error } = await supabase
        .from("profiles")
        .update({ selected_mentor_id: onboardingMentorId })
        .eq("id", user.id);

      if (error) {
        console.error("Failed to backfill mentor selection:", error);
        if (isInvalidMentorReferenceError(error)) {
          const sanitizedOnboardingData = stripOnboardingMentorId(profile.onboarding_data);
          const { error: cleanupError } = await supabase
            .from("profiles")
            .update({ onboarding_data: sanitizedOnboardingData })
            .eq("id", user.id);

          if (cleanupError) {
            console.error("Failed to clear stale onboarding mentor ID:", cleanupError);
          } else {
            await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
          }
        }
        return;
      }

      await queryClient.refetchQueries({ queryKey: ["profile", user.id] });
    };

    void syncMentorSelection();
  }, [profile, queryClient, user]);

  // Use React Query for mentor data with proper caching
  const {
    data: mentorPageData,
    isLoading: mentorPageDataLoading,
    isError: mentorPageDataError,
  } = useQuery({
    queryKey: ['mentor-page-data', resolvedMentorId],
    queryFn: async () => {
      if (!resolvedMentorId) return null;

      const { data: mentorData, error: mentorError } = await supabase
        .from("mentors")
        .select("avatar_url, slug")
        .eq("id", resolvedMentorId)
        .maybeSingle();

      if (mentorError) throw mentorError;
      if (!mentorData) return null;

      // Dynamically load mentor image
      const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'atlas');

      // Get today's pep talk and quote in parallel
      const today = new Date().toLocaleDateString("en-CA");
      const { data: dailyPepTalk, error: pepTalkError } = await supabase
        .from("daily_pep_talks")
        .select("topic_category")
        .eq("for_date", today)
        .eq("mentor_slug", mentorData.slug)
        .maybeSingle();

      if (pepTalkError) throw pepTalkError;

      let quote = null;
      if (dailyPepTalk?.topic_category) {
        // Try category match first
        const { data: categoryQuotes, error: categoryQuotesError } = await supabase
          .from("quotes")
          .select("text, author")
          .eq("category", dailyPepTalk.topic_category)
          .limit(10);

        if (categoryQuotesError) throw categoryQuotesError;
        let quotes = categoryQuotes;

        if (!quotes || quotes.length === 0) {
          const { data: allQuotes, error: allQuotesError } = await supabase
            .from("quotes")
            .select("text, author")
            .limit(20);
          if (allQuotesError) throw allQuotesError;
          quotes = allQuotes;
        }

        if (quotes && quotes.length > 0) {
          quote = quotes[Math.floor(Math.random() * quotes.length)];
        }
      }

      return { mentorImage: imageUrl, todaysQuote: quote };
    },
    enabled: !!resolvedMentorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData, // Keep showing cached data during refetch
  });

  const mentorImage = mentorPageData?.mentorImage || "";
  const todaysQuote = mentorPageData?.todaysQuote || null;

  const isReady = useMemo(() => {
    if (!user) return false;

    // Wait for both profile and companion to finish loading
    const loadingComplete = !profileLoading && !companionLoading;

    const hasMentor = !!resolvedMentorId;

    // Mentor is ready if: no mentor needed, OR we have cached data, OR initial load complete
    const mentorDataReady = !hasMentor || !!mentorPageData || !mentorPageDataLoading;

    return loadingComplete && mentorDataReady;
  }, [
    user,
    profileLoading,
    companionLoading,
    resolvedMentorId,
    mentorPageData,
    mentorPageDataLoading,
  ]);

  const mentorConnectionMissing =
    !enableOnboardingGuard &&
    (!resolvedMentorId || (Boolean(resolvedMentorId) && !mentorPageDataLoading && !mentorPageData && !mentorPageDataError));
  const mentorConnectionIssue =
    !enableOnboardingGuard &&
    Boolean(resolvedMentorId) &&
    !mentorPageDataLoading &&
    !mentorPageData &&
    mentorPageDataError;

  // Memoized insight action handler - MUST be before early returns
  const onInsightAction = useCallback((insight: { actionType?: string }) => {
    switch (insight.actionType) {
      case 'reschedule':
      case 'add_break':
      case 'simplify':
      case 'celebrate':
      default:
        navigate('/journeys');
    }
  }, [navigate]);

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

  return (
    <PageTransition mode={enableOnboardingGuard ? "animated" : "instant"}>
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
      <div className="relative z-10 min-h-screen pb-nav-safe pt-safe">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-28 sm:pt-24 md:pt-20 space-y-4 sm:space-y-6 md:space-y-8">
          {mentorConnectionIssue && (
            <div className="mx-4 sm:mx-6 rounded-2xl border border-destructive/45 bg-card/40 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold">Mentor temporarily unavailable</h2>
                  <p className="text-sm text-muted-foreground">
                    We could not refresh your mentor data right now. Try again in a moment.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    void queryClient.refetchQueries({ queryKey: ["mentor-page-data"] });
                    void queryClient.refetchQueries({ queryKey: ["mentor-personality"] });
                  }}
                  className="sm:self-start"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {mentorConnectionMissing && (
            <div className="mx-4 sm:mx-6 rounded-2xl border border-primary/35 bg-card/40 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold">Mentor connection lost</h2>
                  <p className="text-sm text-muted-foreground">
                    Reconnect a mentor to restore personalized briefings, pep talks, and chat.
                  </p>
                </div>
                <Button onClick={() => navigate("/mentor-selection")} className="sm:self-start">
                  Reconnect Mentor
                </Button>
              </div>
            </div>
          )}

          {/* Quote of the Day */}
          {todaysQuote && (
            <div className="text-right px-4 sm:px-6">
              <blockquote className="max-w-2xl ml-auto">
                <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-foreground/90 leading-relaxed">
                  "{todaysQuote.text}"
                </p>
                {todaysQuote.author && (
                  <footer className="mt-2 font-serif italic text-sm sm:text-base text-muted-foreground">
                    — {todaysQuote.author}
                  </footer>
                )}
              </blockquote>
            </div>
          )}
          
          <ParallaxCard offset={14}>
            <ErrorBoundary>
              <MorningCheckIn />
            </ErrorBoundary>
          </ParallaxCard>

          <ParallaxCard offset={12}>
            <ErrorBoundary>
              <MorningBriefing />
            </ErrorBoundary>
          </ParallaxCard>

          <ParallaxCard offset={10}>
            <ErrorBoundary>
              <EveningReflectionBanner />
            </ErrorBoundary>
          </ParallaxCard>

          <ParallaxCard offset={10}>
            <ErrorBoundary>
              <WeeklyRecapCard />
            </ErrorBoundary>
          </ParallaxCard>

          {/* Daily Coach Panel - AI-powered insights */}
          <ParallaxCard offset={9}>
            <ErrorBoundary>
              <DailyCoachPanel 
                maxInsights={3} 
                onInsightAction={onInsightAction}
              />
            </ErrorBoundary>
          </ParallaxCard>
        
          <ParallaxCard offset={8}>
            <ErrorBoundary>
              <TodaysPepTalk />
            </ErrorBoundary>
          </ParallaxCard>

          {/* Ask Mentor Section */}
          <ParallaxCard offset={8}>
            <CompanionErrorBoundary>
              <ErrorBoundary>
                <div className="cosmiq-glass-ultra rounded-2xl">
                  <MentorQuickChat />
                </div>
              </ErrorBoundary>
            </CompanionErrorBoundary>
          </ParallaxCard>

        </div>
      </div>
      
      <ErrorBoundary>
        <BottomNav />
      </ErrorBoundary>
      <MentorTutorialModal open={showModal} onClose={dismissModal} />
    </PageTransition>
  );
};

export default Index;
