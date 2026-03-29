import { useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCompanion } from "@/hooks/useCompanion";
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
import { ParallaxCard } from "@/components/ui/parallax-card";
import { Button } from "@/components/ui/button";
import { loadMentorImage } from "@/utils/mentorImageLoader";
import { isReturningProfile } from "@/utils/profileOnboarding";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { useMentorLayoutMode } from "@/hooks/useMentorLayoutMode";
import { MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { getEffectiveDailyDate } from "@/utils/timezone";

type IndexProps = {
  enableOnboardingGuard?: boolean;
};

type MentorPageData = {
  mentorImage: string;
  mentorName: string | null;
  todaysQuote: {
    text: string;
    author?: string;
  } | null;
};

const DesktopMentorStateCard = ({
  title,
  description,
  actionLabel,
  onAction,
  variant,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant: "default" | "destructive";
}) => (
  <div
    className={cn(
      "rounded-2xl border p-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl",
      variant === "destructive"
        ? "border-destructive/45 bg-card/65"
        : "border-primary/35 bg-card/60",
    )}
  >
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        onClick={onAction}
        variant={variant === "destructive" ? "outline" : "default"}
        className="w-full"
      >
        {actionLabel}
      </Button>
    </div>
  </div>
);

const DesktopMentorQuoteCard = ({
  quote,
}: {
  quote: MentorPageData["todaysQuote"];
}) => {
  if (!quote) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-border/60 bg-card/45 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
        <Sparkles className="h-4 w-4 text-primary" />
        Quote of the day
      </div>
      <blockquote>
        <p className="font-serif text-lg italic leading-relaxed text-foreground/95">
          "{quote.text}"
        </p>
        {quote.author && (
          <footer className="mt-3 font-serif text-sm italic text-muted-foreground">
            — {quote.author}
          </footer>
        )}
      </blockquote>
    </div>
  );
};

const Index = ({ enableOnboardingGuard = false }: IndexProps) => {
  const { user } = useAuth();
  const { isTabActive } = useMainTabVisibility();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion({ enabled: isTabActive });
  const { isTransitioning } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const layoutMode = useMentorLayoutMode();
  const isDesktop = layoutMode === "desktop";
  const pepTalkDate = useMemo(
    () => getEffectiveDailyDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const {
    mentorId: effectiveMentorId,
    status: mentorConnectionStatus,
    refreshConnection,
  } = useMentorConnection();

  // Use React Query for mentor data with proper caching
  const {
    data: mentorPageData,
    isLoading: mentorPageDataLoading,
    isError: mentorPageDataError,
  } = useQuery({
    queryKey: ['mentor-page-data', effectiveMentorId, pepTalkDate],
    queryFn: async () => {
      if (!effectiveMentorId) return null;

      const { data: mentorData, error: mentorError } = await supabase
        .from("mentors")
        .select("avatar_url, name, slug")
        .eq("id", effectiveMentorId)
        .maybeSingle();

      if (mentorError) throw mentorError;
      if (!mentorData) return null;

      // Dynamically load mentor image
      const imageUrl = mentorData.avatar_url || await loadMentorImage(mentorData.slug || 'atlas');

      // Get today's pep talk and quote in parallel
      const { data: dailyPepTalk, error: pepTalkError } = await supabase
        .from("daily_pep_talks")
        .select("topic_category")
        .eq("for_date", pepTalkDate)
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

      return {
        mentorImage: imageUrl,
        mentorName: mentorData.name ?? null,
        todaysQuote: quote,
      } satisfies MentorPageData;
    },
    enabled: isTabActive && !!effectiveMentorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData, // Keep showing cached data during refetch
  });

  const mentorImage = effectiveMentorId ? mentorPageData?.mentorImage || "" : "";
  const mentorName = effectiveMentorId ? mentorPageData?.mentorName || null : null;
  const todaysQuote = effectiveMentorId ? mentorPageData?.todaysQuote || null : null;
  const askMentorLabel = mentorName ? `Ask ${mentorName}` : "Ask your guide";

  const isReady = useMemo(() => {
    if (!user) return false;

    // Wait for both profile and companion to finish loading
    const loadingComplete = !profileLoading && !companionLoading;

    const hasMentor = !!effectiveMentorId;

    // Mentor is ready if: no mentor needed, OR we have cached data, OR initial load complete
    const mentorDataReady = !hasMentor || !!mentorPageData || !mentorPageDataLoading;

    return loadingComplete && mentorDataReady;
  }, [
    user,
    profileLoading,
    companionLoading,
    effectiveMentorId,
    mentorPageData,
    mentorPageDataLoading,
  ]);

  const mentorConnectionMissing = !enableOnboardingGuard && mentorConnectionStatus === "missing";
  const mentorConnectionIssue =
    !enableOnboardingGuard &&
    Boolean(effectiveMentorId) &&
    !mentorPageDataLoading &&
    !mentorPageData &&
    mentorPageDataError;

  const handleMentorRetry = useCallback(() => {
    void refreshConnection();
    void queryClient.refetchQueries({ queryKey: ["mentor-page-data"] });
    void queryClient.refetchQueries({ queryKey: ["mentor-personality"] });
  }, [queryClient, refreshConnection]);

  const handleMentorReconnect = useCallback(() => {
    navigate("/mentor-selection");
  }, [navigate]);

  const handleAskMentor = useCallback(() => {
    navigate("/mentor-chat");
  }, [navigate]);

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

    // Existing accounts should stay in the app even if legacy onboarding flags are incomplete.
    if (isReturningProfile(profile)) return;

    const missingMentor = !effectiveMentorId;
    const explicitlyIncomplete = profile.onboarding_completed === false;
    const missingCompanion = !companion && !companionLoading;

    if (missingMentor || explicitlyIncomplete || missingCompanion) {
      navigate("/onboarding");
    }
  }, [enableOnboardingGuard, user, isReady, profile, companion, companionLoading, navigate, effectiveMentorId]);

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

  const mobileContent = (
    <div
      className="max-w-6xl mx-auto px-3 sm:px-4 pt-28 sm:pt-24 md:pt-20 space-y-4 sm:space-y-6 md:space-y-8"
      data-testid="mentor-mobile-layout"
    >
      {mentorConnectionIssue && (
        <div className="mx-4 sm:mx-6 rounded-2xl border border-destructive/45 bg-card/40 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold">Guide temporarily unavailable</h2>
              <p className="text-sm text-muted-foreground">
                We could not refresh your guide data right now. Try again in a moment.
              </p>
            </div>
            <Button
              onClick={handleMentorRetry}
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
              <h2 className="text-base sm:text-lg font-bold">Guide connection lost</h2>
              <p className="text-sm text-muted-foreground">
                Reconnect a guide to restore personalized briefings, pep talks, and chat.
              </p>
            </div>
            <Button onClick={handleMentorReconnect} className="sm:self-start">
              Reconnect Guide
            </Button>
          </div>
        </div>
      )}

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

      <ParallaxCard offset={8}>
        <CompanionErrorBoundary>
          <ErrorBoundary>
            <MentorQuickChat />
          </ErrorBoundary>
        </CompanionErrorBoundary>
      </ParallaxCard>
    </div>
  );

  const desktopContent = (
    <div
      className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-8 pt-24 sm:px-6 lg:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]"
      data-testid="mentor-desktop-layout"
    >
      <aside data-testid="mentor-desktop-rail">
        <div
          className="space-y-6 lg:sticky"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 96px)" }}
        >
          <div className="overflow-hidden rounded-[30px] border border-border/60 bg-card/45 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="relative aspect-[4/5] overflow-hidden border-b border-border/40">
              {mentorImage ? (
                <>
                  <img
                    src={mentorImage}
                    alt={mentorName ? `${mentorName} portrait` : "Guide portrait"}
                    className="h-full w-full object-cover object-center"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_55%)]" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.28),_transparent_35%),linear-gradient(180deg,rgba(24,24,35,0.9),rgba(12,12,18,0.98))]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(147,197,253,0.18),transparent_32%)]" />
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
                  Guide tab
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {mentorName || "Guide"}
                </h1>
                <p className="mt-2 max-w-xs text-sm text-white/80">
                  Check in, get guidance, and keep your momentum steady.
                </p>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/55 p-4">
                <div className="rounded-full bg-primary/12 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Everything from your guide</p>
                  <p className="text-sm text-muted-foreground">
                    Check-ins, briefings, coach guidance, and daily pep talks follow your primary guide. You can still consult other voices whenever you need another perspective.
                  </p>
                </div>
              </div>

              {mentorConnectionIssue ? (
                <DesktopMentorStateCard
                  title="Guide temporarily unavailable"
                  description="We could not refresh your guide data right now. Try again in a moment."
                  actionLabel="Retry"
                  onAction={handleMentorRetry}
                  variant="destructive"
                />
              ) : mentorConnectionMissing ? (
                <DesktopMentorStateCard
                  title="Guide connection lost"
                  description="Reconnect a guide to restore personalized briefings, pep talks, and chat."
                  actionLabel="Reconnect Guide"
                  onAction={handleMentorReconnect}
                  variant="default"
                />
              ) : (
                <Button
                  onClick={handleAskMentor}
                  size="lg"
                  className="h-12 w-full justify-between rounded-2xl px-5"
                >
                  <span>{askMentorLabel}</span>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <DesktopMentorQuoteCard quote={todaysQuote} />
        </div>
      </aside>

      <div className="min-w-0 space-y-6" data-testid="mentor-desktop-workspace">
        <div className="space-y-1 px-1">
          <p className="text-sm font-medium text-muted-foreground">Guide workspace</p>
          <p className="text-2xl font-semibold tracking-tight">
            Your daily guidance
          </p>
        </div>

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
            <DailyCoachPanel
              maxInsights={3}
              onInsightAction={onInsightAction}
            />
          </ErrorBoundary>
        </ParallaxCard>

        <ParallaxCard offset={9}>
          <ErrorBoundary>
            <TodaysPepTalk />
          </ErrorBoundary>
        </ParallaxCard>

        <ParallaxCard offset={8}>
          <ErrorBoundary>
            <EveningReflectionBanner />
          </ErrorBoundary>
        </ParallaxCard>

        <ParallaxCard offset={8}>
          <ErrorBoundary>
            <WeeklyRecapCard />
          </ErrorBoundary>
        </ParallaxCard>

        <ParallaxCard offset={7}>
          <CompanionErrorBoundary>
            <ErrorBoundary>
              <MentorQuickChat />
            </ErrorBoundary>
          </CompanionErrorBoundary>
        </ParallaxCard>
      </div>
    </div>
  );

  return (
    <PageTransition mode={enableOnboardingGuard ? "animated" : "instant"}>
      {/* Cosmiq Starfield Background */}
      <StarfieldBackground />
      
      {/* Fixed Background Image */}
      {mentorImage && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img
            src={mentorImage}
            alt="Guide background"
            className="w-full h-full object-cover object-center"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-background/85" />
        </div>
      )}

      {/* Scrollable Content */}
      <div className="relative z-10 min-h-screen pb-nav-safe pt-safe">
        {isDesktop ? desktopContent : mobileContent}
      </div>
      
      <ErrorBoundary>
      </ErrorBoundary>
    </PageTransition>
  );
};

export default Index;
