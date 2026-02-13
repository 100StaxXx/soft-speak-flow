import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BookOpen, Package, Sparkles, Heart, House, Settings } from "lucide-react";
import { CollectionTab } from "@/components/companion/CollectionTab";

import { MemoryWhisper } from "@/components/companion/MemoryWhisper";
import { useCompanion } from "@/hooks/useCompanion";

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import { CompanionTutorialModal } from "@/components/CompanionTutorialModal";
import { useState, memo, lazy, Suspense, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ParallaxCard } from "@/components/ui/parallax-card";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Companion as CompanionData } from "@/hooks/useCompanion";
import { MOTION_DURATION } from "@/lib/motionTokens";
import { logger } from "@/utils/logger";
import { useMotionProfile } from "@/hooks/useMotionProfile";

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
      <NextEvolutionPreview 
        currentXP={companion?.current_xp || 0}
        nextEvolutionXP={nextEvolutionXP || 0}
        currentStage={companion?.current_stage || 0}
        progressPercent={progressToNext}
      />
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
const LazyLifeTab = lazy(() => import("@/components/companion/LifeTab").then(m => ({ default: m.LifeTab })));
const LazyStoryTab = lazy(() => import("@/components/companion/StoryTab").then(m => ({ default: m.StoryTab })));
const LazyHomeTab = lazy(() => import("@/components/companion/HomeTab").then(m => ({ default: m.HomeTab })));

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

const TAB_ORDER = ["overview", "life", "story", "home", "collection"] as const;
type CompanionTab = (typeof TAB_ORDER)[number];

const Companion = () => {
  const prefersReducedMotion = useReducedMotion();
  const { profile: motionProfile } = useMotionProfile();
  const { companion, nextEvolutionXP, progressToNext, isLoading, error, refetch } = useCompanion();
  const [activeTab, setActiveTab] = useState<CompanionTab>("overview");
  const [tabDirection, setTabDirection] = useState<"forward" | "backward" | "none">("none");
  const activeTabRef = useRef<CompanionTab>("overview");
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('companion');
  const navigate = useNavigate();
  const useLiteTabTransitions = prefersReducedMotion || motionProfile === "reduced";

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const timer = logger.time("companion_mount", "Companion");
    const frame = window.requestAnimationFrame(() => {
      timer.end({ screen: "companion" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const previousTab = activeTabRef.current;
    if (previousTab === activeTab) return;

    const previousIndex = TAB_ORDER.indexOf(previousTab);
    const nextIndex = TAB_ORDER.indexOf(activeTab);
    if (previousIndex === -1 || nextIndex === -1) {
      setTabDirection("none");
    } else {
      setTabDirection(nextIndex > previousIndex ? "forward" : "backward");
    }
    activeTabRef.current = activeTab;
  }, [activeTab]);

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

    const renderActiveTab = () => {
      if (activeTab === "overview") {
        return (
          <OverviewTab
            companion={companion}
            nextEvolutionXP={nextEvolutionXP}
            progressToNext={progressToNext}
          />
        );
      }

      if (activeTab === "life") {
        return (
          <Suspense fallback={<TabLoadingFallback />}>
            <LazyLifeTab />
          </Suspense>
        );
      }

      if (activeTab === "story") {
        return (
          <Suspense fallback={<TabLoadingFallback />}>
            <LazyStoryTab />
          </Suspense>
        );
      }

      if (activeTab === "home") {
        return (
          <Suspense fallback={<TabLoadingFallback />}>
            <LazyHomeTab />
          </Suspense>
        );
      }

      return <CollectionTab />;
    };

    // Loading or loaded content with tabs
    return (
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (TAB_ORDER.includes(value as CompanionTab)) {
            setActiveTab(value as CompanionTab);
          }
        }}
        className="container pb-6"
      >
        <TabsList className="grid w-full grid-cols-5 bg-card/80 backdrop-blur-md border border-border/60">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="life" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Life</span>
          </TabsTrigger>
          <TabsTrigger value="story" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Story</span>
          </TabsTrigger>
          <TabsTrigger value="home" className="flex items-center gap-2">
            <House className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
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
              transition={{ duration: useLiteTabTransitions ? 0 : MOTION_DURATION.quick }}
            >
              <OverviewSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key={`tab-${activeTab}`}
              initial={useLiteTabTransitions ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: useLiteTabTransitions ? 0 : MOTION_DURATION.medium }}
            >
              <TabsContent value={activeTab} forceMount>
                <PageTransition mode="tab-swap" direction={tabDirection}>
                  {renderActiveTab()}
                </PageTransition>
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
        <StarfieldBackground palette="cool-night" quality="auto" intensity="medium" parallax="pointer" />
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
      
      <CompanionTutorialModal open={showTutorial} onClose={dismissTutorial} />
    </PageTransition>
  );
};

export default Companion;
