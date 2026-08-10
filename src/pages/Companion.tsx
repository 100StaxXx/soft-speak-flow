import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BookOpen, Package, Sparkles, Timer, Settings } from "lucide-react";
import { MemoryWhisper } from "@/components/companion/MemoryWhisper";
import { useCompanion } from "@/hooks/useCompanion";
import { useAuth } from "@/hooks/useAuth";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import {
  fetchCompanionStoriesAll,
  getCompanionStoriesAllQueryKey,
} from "@/hooks/useCompanionStory";
import {
  fetchCompanionPostcards,
  getCompanionPostcardsQueryKey,
} from "@/hooks/useCompanionPostcards";
import { CinematicPageBackground } from "@/components/CinematicPageBackground";
import { Button } from "@/components/ui/button";
import {
  useState,
  memo,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ParallaxCard } from "@/components/ui/parallax-card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import type { Companion as CompanionData } from "@/hooks/useCompanion";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { outerShellCardClassName } from "@/components/ui/card";
import {
  useCompanionLayoutMode,
  type CompanionLayoutMode,
} from "@/hooks/useCompanionLayoutMode";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import { cn } from "@/lib/utils";

const LazyCompanionDisplay = lazy(() =>
  import("@/components/CompanionDisplay").then((module) => ({
    default: module.CompanionDisplay,
  })),
);
const LazyNextEvolutionPreview = lazy(() =>
  import("@/components/NextEvolutionPreview").then((module) => ({
    default: module.NextEvolutionPreview,
  })),
);
const LazyXPBreakdown = lazy(() =>
  import("@/components/XPBreakdown").then((module) => ({
    default: module.XPBreakdown,
  })),
);
const LazyDailyMissions = lazy(() =>
  import("@/components/DailyMissions").then((module) => ({
    default: module.DailyMissions,
  })),
);
const LazyFocusTab = lazy(() =>
  import("@/components/companion/FocusTab").then((module) => ({
    default: module.FocusTab,
  })),
);
const LazyCollectionTab = lazy(() =>
  import("@/components/companion/CollectionTab").then((module) => ({
    default: module.CollectionTab,
  })),
);

type CompanionTab = "overview" | "focus" | "stories" | "collection";

const COMPANION_TAB_KEYS: CompanionTab[] = [
  "overview",
  "focus",
  "stories",
  "collection",
];

const INITIAL_MOUNTED_TABS: Record<CompanionTab, boolean> = {
  overview: true,
  focus: false,
  stories: false,
  collection: false,
};

const COMPANION_GOLD_THEME_VARS: CSSProperties = {
  "--primary": "45 100% 65%",
  "--accent": "40 96% 57%",
  "--ring": "45 100% 65%",
  "--border": "43 78% 30%",
  "--primary-rgb": "255, 214, 102",
  "--shadow-glow": "0 0 24px hsl(45 100% 65% / 0.35)",
} as CSSProperties;

const isCompanionTab = (tab: string): tab is CompanionTab =>
  COMPANION_TAB_KEYS.includes(tab as CompanionTab);

// Memoized tab content to prevent unnecessary re-renders
const OverviewTab = memo(({
  companion,
  nextEvolutionXP,
  progressToNext,
  layoutMode,
  isActive,
}: {
  companion: CompanionData | null;
  nextEvolutionXP: number;
  progressToNext: number;
  layoutMode: CompanionLayoutMode;
  isActive: boolean;
}) => {
  const isDesktop = layoutMode === "desktop";

  if (isDesktop) {
    return (
      <div className="space-y-6 pt-1">
        <div className={cn("rounded-2xl border p-4", outerShellCardClassName)}>
          <MemoryWhisper chance={0.2} className="px-0" />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div data-tour="companion-progress-area">
            <LazyNextEvolutionPreview
              currentXP={companion?.current_xp || 0}
              nextEvolutionXP={nextEvolutionXP || 0}
              currentStage={companion?.current_stage || 0}
              progressPercent={progressToNext}
            />
          </div>
          <LazyXPBreakdown />
        </div>

        <LazyDailyMissions />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <MemoryWhisper chance={0.2} className="px-2" />

      <ParallaxCard offset={30}>
        <LazyCompanionDisplay isVisible={isActive} />
      </ParallaxCard>
      <ParallaxCard offset={22}>
        <div data-tour="companion-progress-area">
          <LazyNextEvolutionPreview
            currentXP={companion?.current_xp || 0}
            nextEvolutionXP={nextEvolutionXP || 0}
            currentStage={companion?.current_stage || 0}
            progressPercent={progressToNext}
          />
        </div>
      </ParallaxCard>
      <ParallaxCard offset={16}>
        <LazyDailyMissions />
      </ParallaxCard>
      <ParallaxCard offset={12}>
        <LazyXPBreakdown />
      </ParallaxCard>
    </div>
  );
});
OverviewTab.displayName = 'OverviewTab';

// Lazy load heavy tab content
const loadCompanionStoryJournal = () =>
  import("@/components/CompanionStoryJournal").then((module) => ({
    default: module.CompanionStoryJournal,
  }));

const LazyCompanionStoryJournal = lazy(loadCompanionStoryJournal);

// Tab content loading fallback
const TabLoadingFallback = () => (
  <div className="space-y-4 mt-6">
    <Skeleton className="h-48 w-full rounded-xl" />
    <Skeleton className="h-32 w-full rounded-xl" />
  </div>
);

// Inline skeleton for overview tab - matches layout to prevent shift
const OverviewSkeleton = () => (
  <div className="space-y-6 mt-6">
    <div className="rounded-xl border border-cosmiq-glow/10 p-6">
      <Skeleton className="h-48 w-48 rounded-full mx-auto" />
      <Skeleton className="h-6 w-32 mx-auto mt-4" />
    </div>
    <Skeleton className="h-32 w-full rounded-xl" />
    <Skeleton className="h-40 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
  </div>
);

const CompanionTabBar = ({
  layoutMode,
  onStoriesPrefetch,
  onCollectionPrefetch,
}: {
  layoutMode: CompanionLayoutMode;
  onStoriesPrefetch: () => void;
  onCollectionPrefetch: () => void;
}) => {
  const isDesktop = layoutMode === "desktop";

  return (
      <TabsList
        data-testid="companion-tab-list"
        className={cn(
          "border-stardust-gold/16 bg-[linear-gradient(180deg,rgba(34,28,15,0.56),rgba(20,16,8,0.6))] text-stardust-gold/78 backdrop-blur-md shadow-[0_16px_34px_rgba(0,0,0,0.16)]",
          isDesktop
            ? "inline-grid h-auto w-auto min-w-[460px] grid-cols-4 justify-start p-1.5"
            : "grid w-full grid-cols-4",
      )}
    >
      <TabsTrigger
        value="overview"
        className="flex items-center gap-2 data-[state=active]:border-stardust-gold/35 data-[state=active]:bg-stardust-gold/12 data-[state=active]:text-stardust-gold"
      >
        <TrendingUp className="h-4 w-4" />
        <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Overview</span>
      </TabsTrigger>
      <TabsTrigger
        value="focus"
        className="flex items-center gap-2 data-[state=active]:border-stardust-gold/35 data-[state=active]:bg-stardust-gold/12 data-[state=active]:text-stardust-gold"
      >
        <Timer className="h-4 w-4" />
        <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Focus</span>
      </TabsTrigger>
      <TabsTrigger
        value="stories"
        className="flex items-center gap-2 data-[state=active]:border-stardust-gold/35 data-[state=active]:bg-stardust-gold/12 data-[state=active]:text-stardust-gold"
        onPointerDown={onStoriesPrefetch}
        onFocus={onStoriesPrefetch}
      >
        <BookOpen className="h-4 w-4" />
        <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Stories</span>
      </TabsTrigger>
      <TabsTrigger
        value="collection"
        className="flex items-center gap-2 data-[state=active]:border-stardust-gold/35 data-[state=active]:bg-stardust-gold/12 data-[state=active]:text-stardust-gold"
        onPointerDown={onCollectionPrefetch}
        onFocus={onCollectionPrefetch}
      >
        <Package className="h-4 w-4" />
        <span className={cn(isDesktop ? "inline" : "hidden sm:inline")}>Collection</span>
      </TabsTrigger>
    </TabsList>
  );
};

const Companion = () => {
  const prefersReducedMotion = useReducedMotion();
  const layoutMode = useCompanionLayoutMode();
  const isDesktop = layoutMode === "desktop";
  const { isTabActive } = useMainTabVisibility();
  const {
    companion,
    nextEvolutionXP,
    progressToNext,
    canEvolve,
    isLoading,
    error,
    refetch,
  } = useCompanion({ enabled: isTabActive });
  const {
    currentStep: tutorialStep,
    isPreHatchCompanionStep,
  } = usePostOnboardingMentorGuidance();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CompanionTab>("overview");
  const [mountedTabs, setMountedTabs] = useState<Record<CompanionTab, boolean>>(() => INITIAL_MOUNTED_TABS);
  const prefetchedResourceKeyRef = useRef<string | null>(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const tutorialRefetchStepRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const {
    displayCompanion,
    displayNextEvolutionXP,
    displayProgressToNext,
  } = useMemo(
    () =>
      deriveCompanionDisplayState({
        companion,
        nextEvolutionXP: nextEvolutionXP ?? 0,
        progressToNext,
        canEvolve,
        forcePreHatchDisplay: isPreHatchCompanionStep,
      }),
    [canEvolve, companion, isPreHatchCompanionStep, nextEvolutionXP, progressToNext],
  );

  const markTabMounted = useCallback((tab: CompanionTab) => {
    setMountedTabs((previous) => (previous[tab] ? previous : { ...previous, [tab]: true }));
  }, []);

  const prefetchStories = useCallback(() => {
    if (!isTabActive) {
      return Promise.resolve([]);
    }
    const tasks: Promise<unknown>[] = [loadCompanionStoryJournal()];

    if (companion?.id) {
      tasks.push(
        queryClient.prefetchQuery({
          queryKey: getCompanionStoriesAllQueryKey(companion.id),
          queryFn: () => fetchCompanionStoriesAll(companion.id),
        }),
      );
    }

    return Promise.allSettled(tasks);
  }, [companion?.id, isTabActive, queryClient]);

  const prefetchPostcards = useCallback(() => {
    if (!isTabActive) {
      return Promise.resolve([]);
    }
    const tasks: Promise<unknown>[] = [];

    if (user?.id) {
      tasks.push(
        queryClient.prefetchQuery({
          queryKey: getCompanionPostcardsQueryKey(user.id),
          queryFn: () => fetchCompanionPostcards(user.id),
        }),
      );
    }

    return Promise.allSettled(tasks);
  }, [isTabActive, queryClient, user?.id]);

  const prefetchJourneyTabs = useCallback(() => {
    void prefetchStories();
    void prefetchPostcards();
  }, [prefetchPostcards, prefetchStories]);

  const handleStoriesTriggerPrefetch = useCallback(() => {
    if (!isTabActive) return;
    void prefetchStories();
  }, [isTabActive, prefetchStories]);

  const handleCollectionTriggerPrefetch = useCallback(() => {
    if (!isTabActive) return;
    void prefetchPostcards();
  }, [isTabActive, prefetchPostcards]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isCompanionTab(value)) {
        return;
      }

      setActiveTab(value);
      markTabMounted(value);

      if (!isTabActive) {
        return;
      }

      if (value === "stories") {
        void prefetchStories();
      } else if (value === "collection") {
        void prefetchPostcards();
      }
    },
    [isTabActive, markTabMounted, prefetchPostcards, prefetchStories],
  );

  useEffect(() => {
    if (location.pathname === "/companion" && previousPathRef.current !== "/companion") {
      setActiveTab("overview");
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const shouldRefreshForTutorial =
      tutorialStep === "companion_tab_intro" || tutorialStep === "evolve_companion";

    if (!shouldRefreshForTutorial) {
      tutorialRefetchStepRef.current = null;
      return;
    }

    if (!isTabActive || location.pathname !== "/companion") return;
    if (tutorialRefetchStepRef.current === tutorialStep) return;

    tutorialRefetchStepRef.current = tutorialStep;
    void refetch();
  }, [isTabActive, location.pathname, refetch, tutorialStep]);

  useEffect(() => {
    if (!isTabActive) return;
    if (!companion?.id || !user?.id) return;

    const prefetchKey = `${user.id}:${companion.id}`;
    if (prefetchedResourceKeyRef.current === prefetchKey) {
      return;
    }
    prefetchedResourceKeyRef.current = prefetchKey;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let timeoutId: number | null = null;
    let idleHandle: number | null = null;

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => {
        prefetchJourneyTabs();
      }, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(() => {
        prefetchJourneyTabs();
      }, 500);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [companion?.id, isTabActive, prefetchJourneyTabs, user?.id]);

  const renderTabPanels = (contentClassName?: string) => (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
        >
          <OverviewSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          <TabsContent
            value="overview"
            forceMount
            className={cn("data-[state=inactive]:hidden", contentClassName)}
          >
            {mountedTabs.overview && (
              <Suspense fallback={<OverviewSkeleton />}>
                <OverviewTab
                  companion={displayCompanion}
                  nextEvolutionXP={displayNextEvolutionXP}
                  progressToNext={displayProgressToNext}
                  layoutMode={layoutMode}
                  isActive={activeTab === "overview"}
                />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent
            value="focus"
            forceMount
            className={cn("data-[state=inactive]:hidden", contentClassName)}
          >
            {mountedTabs.focus && (
              <Suspense fallback={<TabLoadingFallback />}>
                <LazyFocusTab layoutMode={layoutMode} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent
            value="stories"
            forceMount
            className={cn("data-[state=inactive]:hidden", contentClassName)}
          >
            {mountedTabs.stories && (
              <Suspense fallback={<TabLoadingFallback />}>
                <LazyCompanionStoryJournal layoutMode={layoutMode} />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent
            value="collection"
            forceMount
            className={cn("data-[state=inactive]:hidden", contentClassName)}
          >
            {mountedTabs.collection && (
              <Suspense fallback={<TabLoadingFallback />}>
                <LazyCollectionTab layoutMode={layoutMode} />
              </Suspense>
            )}
          </TabsContent>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 p-6">
            <Sparkles className="h-16 w-16 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">Error Loading Companion</h2>
            <p className="text-muted-foreground max-w-md">
              {error instanceof Error ? error.message : 'Unable to load your companion data. Please try refreshing the page.'}
            </p>
            <Button
              variant="default"
              onClick={() => {
                void refetch();
              }}
              className="mt-4 h-11 px-6"
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (!isLoading && !companion) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 p-6">
            <Sparkles className="h-16 w-16 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">No Companion Found</h2>
            <p className="text-muted-foreground max-w-md">
              It looks like you haven't created your companion yet. Please complete the onboarding process to get started.
            </p>
            <Button
              variant="default"
              onClick={() => navigate('/onboarding')}
              className="mt-4 h-11 px-6"
            >
              Start Onboarding
            </Button>
          </div>
        </div>
      );
    }

    if (isDesktop) {
      return (
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6"
          data-testid="companion-desktop-layout"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
            <aside data-testid="companion-desktop-rail">
              <div
                className="space-y-4 lg:sticky"
                style={{ top: "calc(env(safe-area-inset-top, 0px) + 96px)" }}
              >
                <div className="space-y-1 px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                    Living Companion
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Your companion, anchored
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Keep the creature visible while you track growth, stories, and rewards.
                  </p>
                </div>
                <Suspense fallback={<OverviewSkeleton />}>
                  <LazyCompanionDisplay layoutMode={layoutMode} />
                </Suspense>
              </div>
            </aside>

            <div className="min-w-0 space-y-6" data-testid="companion-desktop-workspace">
              <div className="space-y-3">
                <div className="space-y-1 px-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Companion spaces
                  </p>
                  <p className="text-2xl font-semibold tracking-tight">
                    Switch between growth, focus, story, and collection
                  </p>
                </div>
                <CompanionTabBar
                  layoutMode={layoutMode}
                  onStoriesPrefetch={handleStoriesTriggerPrefetch}
                  onCollectionPrefetch={handleCollectionTriggerPrefetch}
                />
              </div>

              {renderTabPanels("mt-0")}
            </div>
          </div>
        </Tabs>
      );
    }

    return (
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="container pb-6"
        data-testid="companion-mobile-layout"
      >
        <CompanionTabBar
          layoutMode={layoutMode}
          onStoriesPrefetch={handleStoriesTriggerPrefetch}
          onCollectionPrefetch={handleCollectionTriggerPrefetch}
        />

        {renderTabPanels()}
      </Tabs>
    );
  };

  return (
    <PageTransition mode="instant">
      <CompanionErrorBoundary>
        <CinematicPageBackground preset="companion" />
        <div
          className="min-h-screen pb-nav-safe relative z-10"
          data-testid="companion-theme-shell"
          data-tour="companion-page"
          style={COMPANION_GOLD_THEME_VARS}
        >
          {/* Fixed header - won't move on iOS overscroll */}
          <header
            className="fixed top-0 left-0 right-0 z-40 w-full cosmiq-glass-header cosmiq-glass-header--companion safe-area-top"
            data-tour="companion-header"
          >
            <div
              className={cn(
                "flex items-center justify-between py-4",
                isDesktop ? "mx-auto w-full max-w-7xl px-4 sm:px-6" : "container",
              )}
            >
              <h1 className="text-2xl font-semibold tracking-tight">Companion</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </header>
          
          {/* Spacer for fixed header */}
          <div className="pt-safe" style={{ height: 'calc(env(safe-area-inset-top, 0px) + 72px)' }} />

          {renderContent()}
        </div>
      </CompanionErrorBoundary>
    </PageTransition>
  );
};

export default Companion;
