import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BookOpen, MapPin, Package, Sparkles, Timer, Settings } from "lucide-react";
import { CollectionTab } from "@/components/companion/CollectionTab";
import { FocusTab } from "@/components/companion/FocusTab";
import { MemoryWhisper } from "@/components/companion/MemoryWhisper";
import { useCompanion } from "@/hooks/useCompanion";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCompanionStoriesAll,
  getCompanionStoriesAllQueryKey,
} from "@/hooks/useCompanionStory";
import {
  fetchCompanionPostcards,
  getCompanionPostcardsQueryKey,
} from "@/hooks/useCompanionPostcards";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import {
  useState,
  memo,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ParallaxCard } from "@/components/ui/parallax-card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import type { Companion as CompanionData } from "@/hooks/useCompanion";

type CompanionTab = "overview" | "focus" | "stories" | "postcards" | "collection";

const COMPANION_TAB_KEYS: CompanionTab[] = [
  "overview",
  "focus",
  "stories",
  "postcards",
  "collection",
];

const INITIAL_MOUNTED_TABS: Record<CompanionTab, boolean> = {
  overview: true,
  focus: false,
  stories: false,
  postcards: false,
  collection: false,
};

const isCompanionTab = (tab: string): tab is CompanionTab =>
  COMPANION_TAB_KEYS.includes(tab as CompanionTab);

// Memoized tab content to prevent unnecessary re-renders
const OverviewTab = memo(({ 
  companion, 
  nextEvolutionXP, 
  progressToNext,
}: { 
  companion: CompanionData | null;
  nextEvolutionXP: number; 
  progressToNext: number;
}) => (
  <div className="space-y-6 mt-6">
    {/* Memory whisper - occasional floating "remember when" message */}
    <MemoryWhisper chance={0.2} className="px-2" />
    
    <ParallaxCard offset={30}>
      <CompanionDisplay />
    </ParallaxCard>
    <ParallaxCard offset={22}>
      <div data-tour="companion-progress-area">
        <NextEvolutionPreview 
          currentXP={companion?.current_xp || 0}
          nextEvolutionXP={nextEvolutionXP || 0}
          currentStage={companion?.current_stage || 0}
          progressPercent={progressToNext}
        />
      </div>
    </ParallaxCard>
    <ParallaxCard offset={16}>
      <DailyMissions />
    </ParallaxCard>
    <ParallaxCard offset={12}>
      <XPBreakdown />
    </ParallaxCard>
  </div>
));
OverviewTab.displayName = 'OverviewTab';

// Lazy load heavy tab content
const loadCompanionStoryJournal = () =>
  import("@/components/CompanionStoryJournal").then((module) => ({
    default: module.CompanionStoryJournal,
  }));
const loadCompanionPostcards = () =>
  import("@/components/companion/CompanionPostcards").then((module) => ({
    default: module.CompanionPostcards,
  }));

const LazyCompanionStoryJournal = lazy(loadCompanionStoryJournal);
const LazyCompanionPostcards = lazy(loadCompanionPostcards);

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

const Companion = () => {
  const prefersReducedMotion = useReducedMotion();
  const {
    companion,
    nextEvolutionXP,
    progressToNext,
    isLoading,
    error,
    refetch,
  } = useCompanion();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CompanionTab>("overview");
  const [mountedTabs, setMountedTabs] = useState<Record<CompanionTab, boolean>>(() => INITIAL_MOUNTED_TABS);
  const prefetchedResourceKeyRef = useRef<string | null>(null);
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);
  const navigate = useNavigate();

  const markTabMounted = useCallback((tab: CompanionTab) => {
    setMountedTabs((previous) => (previous[tab] ? previous : { ...previous, [tab]: true }));
  }, []);

  const prefetchStories = useCallback(() => {
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
  }, [companion?.id, queryClient]);

  const prefetchPostcards = useCallback(() => {
    const tasks: Promise<unknown>[] = [loadCompanionPostcards()];

    if (user?.id) {
      tasks.push(
        queryClient.prefetchQuery({
          queryKey: getCompanionPostcardsQueryKey(user.id),
          queryFn: () => fetchCompanionPostcards(user.id),
        }),
      );
    }

    return Promise.allSettled(tasks);
  }, [queryClient, user?.id]);

  const prefetchJourneyTabs = useCallback(() => {
    void prefetchStories();
    void prefetchPostcards();
  }, [prefetchPostcards, prefetchStories]);

  const handleStoriesTriggerPrefetch = useCallback(() => {
    void prefetchStories();
  }, [prefetchStories]);

  const handlePostcardsTriggerPrefetch = useCallback(() => {
    void prefetchPostcards();
  }, [prefetchPostcards]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isCompanionTab(value)) {
        return;
      }

      setActiveTab(value);
      markTabMounted(value);

      if (value === "stories") {
        void prefetchStories();
      } else if (value === "postcards") {
        void prefetchPostcards();
      }
    },
    [markTabMounted, prefetchPostcards, prefetchStories],
  );

  useEffect(() => {
    if (location.pathname === "/companion" && previousPathRef.current !== "/companion") {
      setActiveTab("overview");
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
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
  }, [companion?.id, prefetchJourneyTabs, user?.id]);

  // Render persistent layout - header/nav always visible, content swaps smoothly
  const renderContent = () => {
    // Error state
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

    // No companion state
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

    // Loading or loaded content with tabs
    return (
      <Tabs value={activeTab} onValueChange={handleTabChange} className="container pb-6">
        <TabsList className="grid w-full grid-cols-5 bg-card/80 backdrop-blur-md border border-border/60">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="focus" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span className="hidden sm:inline">Focus</span>
          </TabsTrigger>
          <TabsTrigger
            value="stories"
            className="flex items-center gap-2"
            onPointerDown={handleStoriesTriggerPrefetch}
            onFocus={handleStoriesTriggerPrefetch}
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Stories</span>
          </TabsTrigger>
          <TabsTrigger
            value="postcards"
            className="flex items-center gap-2"
            onPointerDown={handlePostcardsTriggerPrefetch}
            onFocus={handlePostcardsTriggerPrefetch}
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Postcards</span>
          </TabsTrigger>
          <TabsTrigger value="collection" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Collection</span>
          </TabsTrigger>
        </TabsList>

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
                className="data-[state=inactive]:hidden"
              >
                {mountedTabs.overview && (
                  <OverviewTab 
                    companion={companion} 
                    nextEvolutionXP={nextEvolutionXP} 
                    progressToNext={progressToNext}
                  />
                )}
              </TabsContent>

              <TabsContent value="focus" forceMount className="data-[state=inactive]:hidden">
                {mountedTabs.focus && <FocusTab />}
              </TabsContent>

              <TabsContent value="stories" forceMount className="data-[state=inactive]:hidden">
                {mountedTabs.stories && (
                  <Suspense fallback={<TabLoadingFallback />}>
                    <LazyCompanionStoryJournal />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="postcards" forceMount className="data-[state=inactive]:hidden">
                {mountedTabs.postcards && (
                  <Suspense fallback={<TabLoadingFallback />}>
                    <LazyCompanionPostcards />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="collection" forceMount className="data-[state=inactive]:hidden">
                {mountedTabs.collection && <CollectionTab />}
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    );
  };

  return (
    <PageTransition mode="instant">
      <CompanionErrorBoundary>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe relative z-10" data-tour="companion-page">
          {/* Fixed header - won't move on iOS overscroll */}
          <header className="fixed top-0 left-0 right-0 z-40 w-full cosmiq-glass-header safe-area-top">
            <div className="container flex items-center justify-between py-4">
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
