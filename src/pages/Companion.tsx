import { BottomNav } from "@/components/BottomNav";
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

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { Button } from "@/components/ui/button";
import { CompanionTutorialModal } from "@/components/CompanionTutorialModal";
import { CompanionPageSkeleton } from "@/components/skeletons/CompanionPageSkeleton";
import { useState, memo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { ParallaxCard } from "@/components/ui/parallax-card";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

// Memoized tab content to prevent unnecessary re-renders
const OverviewTab = memo(({ 
  companion, 
  nextEvolutionXP, 
  progressToNext,
}: { 
  companion: any; 
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
const LazyCompanionStoryJournal = lazy(() => import("@/components/CompanionStoryJournal").then(m => ({ default: m.CompanionStoryJournal })));
const LazyCompanionPostcards = lazy(() => import("@/components/companion/CompanionPostcards").then(m => ({ default: m.CompanionPostcards })));

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
  const { companion, nextEvolutionXP, progressToNext, isLoading, error } = useCompanion();
  const [activeTab, setActiveTab] = useState("overview");
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('companion');
  const navigate = useNavigate();

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
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Refresh Page
            </button>
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
            <button
              onClick={() => window.location.href = '/onboarding'}
              className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Start Onboarding
            </button>
          </div>
        </div>
      );
    }

    // Loading or loaded content with tabs
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="container pb-6">
        <TabsList className="grid w-full grid-cols-5 cosmiq-glass-subtle border border-cosmiq-glow/20">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="focus" className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span className="hidden sm:inline">Focus</span>
          </TabsTrigger>
          <TabsTrigger value="stories" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Stories</span>
          </TabsTrigger>
          <TabsTrigger value="postcards" className="flex items-center gap-2">
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
              transition={{ duration: 0.15 }}
            >
              <OverviewSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="overview">
                {activeTab === "overview" && (
                  <OverviewTab 
                    companion={companion} 
                    nextEvolutionXP={nextEvolutionXP} 
                    progressToNext={progressToNext}
                  />
                )}
              </TabsContent>


              <TabsContent value="focus">
                {activeTab === "focus" && <FocusTab />}
              </TabsContent>

              <TabsContent value="stories">
                {activeTab === "stories" && (
                  <Suspense fallback={<TabLoadingFallback />}>
                    <LazyCompanionStoryJournal />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="postcards">
                {activeTab === "postcards" && (
                  <Suspense fallback={<TabLoadingFallback />}>
                    <LazyCompanionPostcards />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="collection">
                {activeTab === "collection" && <CollectionTab />}
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    );
  };

  return (
    <PageTransition>
      <CompanionErrorBoundary>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe relative z-10">
          {/* Fixed header - won't move on iOS overscroll */}
          <header className="fixed top-0 left-0 right-0 z-40 w-full cosmiq-glass-header safe-area-top">
            <div className="container flex items-center justify-between py-4">
              <h1 className="font-heading font-black text-2xl">Companion</h1>
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
      <BottomNav />
      
      <CompanionTutorialModal open={showTutorial} onClose={dismissTutorial} />
    </PageTransition>
  );
};

export default Companion;
