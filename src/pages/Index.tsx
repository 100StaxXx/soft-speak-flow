import { useEffect, useMemo, useCallback, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { resolveMentorImageSource } from "@/utils/mentorImageLoader";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
  hasWalkthroughCompleted,
} from "@/utils/profileOnboarding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { useMentorLayoutMode } from "@/hooks/useMentorLayoutMode";
import { MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { getEffectiveDailyDate } from "@/utils/timezone";
import { safeSessionStorage } from "@/utils/storage";
import { resolveMentorSlugAlias } from "@/lib/mentorRoster";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { useEveningReflection } from "@/hooks/useEveningReflection";
import {
  clearEveningReflectionOpenRequest,
  isEveningReflectionOpenRequest,
} from "@/utils/eveningReflectionNavigation";

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

const INITIAL_ROUTE_LOAD_STALL_MS = 12_000;

const GUIDE_TIFFANY_THEME_VARS: CSSProperties = {
  "--primary": "181 57% 56%",
  "--accent": "176 46% 64%",
  "--ring": "181 57% 56%",
  "--border": "184 34% 28%",
  "--primary-rgb": "88, 211, 205",
  "--shadow-glow": "0 0 24px hsl(181 57% 56% / 0.35)",
} as CSSProperties;

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
        ? "border-destructive/45 bg-card/22"
        : "border-primary/35 bg-card/18",
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
    <div className="rounded-[28px] border border-border/60 bg-card/18 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
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
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const layoutMode = useMentorLayoutMode();
  const isDesktop = layoutMode === "desktop";
  const { isActive: isTutorialActive, currentStep: tutorialStep } = usePostOnboardingMentorGuidance();
  const onboardingSelfHealAttemptedRef = useRef(false);
  const didAutoScrollTutorialMorningCheckinRef = useRef(false);
  const initialLoadTimeoutRef = useRef<number | null>(null);
  const [hasInitialLoadTimedOut, setHasInitialLoadTimedOut] = useState(false);
  const [initialLoadRetryNonce, setInitialLoadRetryNonce] = useState(0);
  const pepTalkDate = useMemo(
    () => getEffectiveDailyDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );
  const isTutorialMorningCheckinStep = !isDesktop && isTutorialActive && tutorialStep === "morning_checkin";
  const shouldUseGuideTiffanyTheme = location.pathname === "/mentor";
  const {
    shouldShowBanner: shouldShowEveningReflectionBanner,
    isDrawerOpen: isEveningReflectionDrawerOpen,
    setIsDrawerOpen: setEveningReflectionDrawerOpen,
    isLoading: isEveningReflectionLoading,
  } = useEveningReflection();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (location.pathname !== "/mentor") return;
    if (!isEveningReflectionOpenRequest(location.search)) return;
    if (isEveningReflectionLoading) return;

    if (shouldShowEveningReflectionBanner) {
      setEveningReflectionDrawerOpen(true);
    }

    navigate(
      {
        pathname: location.pathname,
        search: clearEveningReflectionOpenRequest(location.search),
      },
      { replace: true },
    );
  }, [
    isEveningReflectionLoading,
    location.pathname,
    location.search,
    navigate,
    setEveningReflectionDrawerOpen,
    shouldShowEveningReflectionBanner,
  ]);

  useEffect(() => {
    if (!isTutorialMorningCheckinStep) {
      didAutoScrollTutorialMorningCheckinRef.current = false;
      return;
    }

    if (didAutoScrollTutorialMorningCheckinRef.current) {
      return;
    }

    didAutoScrollTutorialMorningCheckinRef.current = true;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [isTutorialMorningCheckinStep]);

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
      const mentorSlug = resolveMentorSlugAlias(mentorData.slug) ?? mentorData.slug ?? "sage";

      // Dynamically load mentor image
      const imageUrl = await resolveMentorImageSource(mentorSlug, mentorData.avatar_url);

      // Get today's pep talk and quote in parallel
      const { data: dailyPepTalk, error: pepTalkError } = await supabase
        .from("daily_pep_talks")
        .select("topic_category")
        .eq("for_date", pepTalkDate)
        .eq("mentor_slug", mentorSlug)
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
  const onboardingGate = useMemo(
    () =>
      getOnboardingGateState({
        profile,
        hasCompanion: Boolean(companion),
        hasPresetCompanion: Boolean(companion?.preset_id),
        companionStage: companion?.current_stage ?? null,
        hasCompanionImages: Boolean(companion?.current_image_url || companion?.initial_image_url),
      }),
    [profile, companion],
  );
  const profileOnlyOnboardingGate = useMemo(
    () =>
      getOnboardingGateState({
        profile,
      }),
    [profile],
  );
  const hasProfileCompletionMarker =
    profile?.onboarding_step === "complete" ||
    hasWalkthroughCompleted(profile?.onboarding_data) ||
    profileOnlyOnboardingGate.reason === "legacy_resolved_mentor";
  const canResolveOnboardingWithoutCompanion =
    hasProfileCompletionMarker ||
    profileOnlyOnboardingGate.resumeStep !== null ||
    profileOnlyOnboardingGate.needsProgressionReset;
  const routingOnboardingGate =
    canResolveOnboardingWithoutCompanion ? profileOnlyOnboardingGate : onboardingGate;
  const canProceedAfterCompanionStall =
    hasInitialLoadTimedOut && Boolean(profile) && !profileLoading && companionLoading;
  const onboardingGateReady =
    Boolean(user) &&
    !profileLoading &&
    (
      !companionLoading ||
      canResolveOnboardingWithoutCompanion ||
      canProceedAfterCompanionStall
    );

  const isReady = useMemo(() => {
    if (!user) return false;
    if (profileLoading) return false;
    if (!enableOnboardingGuard) return true;

    return !companionLoading || canResolveOnboardingWithoutCompanion || canProceedAfterCompanionStall;
  }, [
    canProceedAfterCompanionStall,
    canResolveOnboardingWithoutCompanion,
    companionLoading,
    enableOnboardingGuard,
    profileLoading,
    user,
  ]);

  const unresolvedInitialLoad =
    Boolean(user) &&
    (
      profileLoading ||
      (
        enableOnboardingGuard &&
        companionLoading &&
        !canResolveOnboardingWithoutCompanion
      )
    );

  useEffect(() => {
    if (initialLoadTimeoutRef.current !== null) {
      window.clearTimeout(initialLoadTimeoutRef.current);
      initialLoadTimeoutRef.current = null;
    }

    if (!unresolvedInitialLoad) {
      setHasInitialLoadTimedOut(false);
      return undefined;
    }

    initialLoadTimeoutRef.current = window.setTimeout(() => {
      initialLoadTimeoutRef.current = null;
      setHasInitialLoadTimedOut(true);
    }, INITIAL_ROUTE_LOAD_STALL_MS);

    return () => {
      if (initialLoadTimeoutRef.current !== null) {
        window.clearTimeout(initialLoadTimeoutRef.current);
        initialLoadTimeoutRef.current = null;
      }
    };
  }, [initialLoadRetryNonce, unresolvedInitialLoad, user?.id]);

  const handleRetryInitialLoad = useCallback(() => {
    if (!user?.id) return;

    setHasInitialLoadTimedOut(false);
    setInitialLoadRetryNonce((nonce) => nonce + 1);
    void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    void queryClient.invalidateQueries({ queryKey: ["companion", user.id] });
  }, [queryClient, user?.id]);

  useEffect(() => {
    onboardingSelfHealAttemptedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!user || !onboardingGateReady || onboardingSelfHealAttemptedRef.current) return;

    const patch = buildEstablishedProfileSelfHealPatch({
      profile,
      hasCompanion: Boolean(companion),
      hasPresetCompanion: Boolean(companion?.preset_id),
      companionStage: companion?.current_stage ?? null,
      hasCompanionImages: Boolean(companion?.current_image_url || companion?.initial_image_url),
    });
    if (!patch) return;

    onboardingSelfHealAttemptedRef.current = true;

    void supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          onboardingSelfHealAttemptedRef.current = false;
          console.warn("Failed to self-heal established profile flags:", error);
        } else {
          void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        }
      });
  }, [user, onboardingGateReady, profile, companion, queryClient]);

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (!onboardingGateReady) return;
    if (!routingOnboardingGate.isEstablished) return;

    const hasRedirected = safeSessionStorage.getItem("initialRouteRedirected");
    if (!hasRedirected) {
      safeSessionStorage.setItem("initialRouteRedirected", "true");
      navigate("/journeys", { replace: true });
    }
  }, [location.pathname, navigate, routingOnboardingGate.isEstablished, onboardingGateReady]);

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

  // Redirect accounts that still need onboarding once profile and companion state are resolved.
  useEffect(() => {
    if (!enableOnboardingGuard) return;
    if (!user || !onboardingGateReady) return;

    if (routingOnboardingGate.needsOnboarding) {
      navigate("/onboarding");
    }
  }, [enableOnboardingGuard, user, onboardingGateReady, routingOnboardingGate.needsOnboarding, navigate]);

  // Show error state if critical data failed to load
  if (user && !profileLoading && !profile) {
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

  if (hasInitialLoadTimedOut && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div>
            <h2 className="text-xl font-bold mb-2">Still loading your setup</h2>
            <p className="text-muted-foreground mb-4">
              The connection is taking longer than expected. Retry the startup sync to keep going.
            </p>
            <Button onClick={handleRetryInitialLoad}>
              Retry loading
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state with skeleton while critical data loads.
  if (isTransitioning || !isReady) {
    return <IndexPageSkeleton />;
  }

  const mobileContent = (
    <div
      className={cn(
        "max-w-6xl mx-auto px-3 sm:px-4 sm:pt-24 md:pt-20 space-y-4 sm:space-y-6 md:space-y-8",
        isTutorialMorningCheckinStep ? "pt-16" : "pt-28"
      )}
      data-testid="mentor-mobile-layout"
    >
      {mentorConnectionIssue && (
        <div className="mx-4 sm:mx-6 rounded-2xl border border-destructive/45 bg-card/16 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
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
        <div className="mx-4 sm:mx-6 rounded-2xl border border-primary/35 bg-card/16 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
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
          <EveningReflectionBanner
            shouldShowBanner={shouldShowEveningReflectionBanner}
            isDrawerOpen={isEveningReflectionDrawerOpen}
            setIsDrawerOpen={setEveningReflectionDrawerOpen}
          />
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
          <div className="overflow-hidden rounded-[30px] border border-border/60 bg-card/18 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-background/38 via-background/12 to-transparent" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_55%)]" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.1),_transparent_35%),linear-gradient(180deg,rgba(24,24,35,0.16),rgba(12,12,18,0.08))]" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(147,197,253,0.08),transparent_32%)]" />
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
              <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/22 p-4">
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
            <EveningReflectionBanner
              shouldShowBanner={shouldShowEveningReflectionBanner}
              isDrawerOpen={isEveningReflectionDrawerOpen}
              setIsDrawerOpen={setEveningReflectionDrawerOpen}
            />
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
      <CinematicPageBackground preset="guide" />

      {/* Scrollable Content */}
      <div
        className="relative z-10 min-h-screen pb-nav-safe pt-safe"
        data-testid="guide-theme-shell"
        style={shouldUseGuideTiffanyTheme ? GUIDE_TIFFANY_THEME_VARS : undefined}
      >
        {isDesktop ? desktopContent : mobileContent}
      </div>
    </PageTransition>
  );
};

export default Index;
