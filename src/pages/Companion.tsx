import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { PageTransition } from "@/components/PageTransition";
import { CompanionBadge } from "@/components/CompanionBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BookOpen, MapPin, Package, Sparkles, Timer } from "lucide-react";
import { CollectionTab } from "@/components/companion/CollectionTab";
import { FocusTab } from "@/components/companion/FocusTab";
import { useCompanion } from "@/hooks/useCompanion";

import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { CompanionTutorialModal } from "@/components/CompanionTutorialModal";
import { CompanionPageSkeleton } from "@/components/skeletons/CompanionPageSkeleton";
import { useState, memo, lazy, Suspense } from "react";
import { ParallaxCard } from "@/components/ui/parallax-card";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { Skeleton } from "@/components/ui/skeleton";

// Memoized tab content to prevent unnecessary re-renders
const OverviewTab = memo(({ 
  companion, 
  nextEvolutionXP, 
  progressToNext,
  canEvolve,
  onEvolve,
  isEvolving,
}: { 
  companion: any; 
  nextEvolutionXP: number; 
  progressToNext: number;
  canEvolve: boolean;
  onEvolve: () => void;
  isEvolving: boolean;
}) => (
  <div className="space-y-6 mt-6">
    <ParallaxCard offset={30}>
      <CompanionDisplay />
    </ParallaxCard>
    <ParallaxCard offset={22}>
      <NextEvolutionPreview 
        currentXP={companion?.current_xp || 0}
        nextEvolutionXP={nextEvolutionXP || 0}
        currentStage={companion?.current_stage || 0}
        progressPercent={progressToNext}
        canEvolve={canEvolve}
        onEvolve={onEvolve}
        isEvolving={isEvolving}
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

const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext, isLoading, error, canEvolve, triggerManualEvolution, evolveCompanion } = useCompanion();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal('companion');

  // Show error state if query failed
  if (error) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-background pb-nav-safe flex items-center justify-center">
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
        <BottomNav />
      </PageTransition>
    );
  }

  // Show loading state while companion is being fetched
  if (isLoading) {
    return (
      <PageTransition>
        <StarfieldBackground />
        <CompanionPageSkeleton />
        <BottomNav />
      </PageTransition>
    );
  }

  // If companion doesn't exist after loading, redirect to onboarding
  if (!companion) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-nav-safe flex items-center justify-center">
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
        <BottomNav />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <CompanionErrorBoundary>
        <StarfieldBackground />
        <div className="min-h-screen pb-nav-safe pt-safe relative z-10">
          
          <header className="sticky top-0 z-40 w-full cosmiq-glass-header safe-area-top">
            <div className="container flex items-center justify-between py-4">
              <h1 className="font-heading font-black text-2xl">Companion</h1>
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
          </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="container py-6">
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

            <TabsContent value="overview">
              {activeTab === "overview" && (
                <OverviewTab 
                  companion={companion} 
                  nextEvolutionXP={nextEvolutionXP} 
                  progressToNext={progressToNext}
                  canEvolve={canEvolve}
                  onEvolve={triggerManualEvolution}
                  isEvolving={evolveCompanion.isPending}
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
          </Tabs>
        </div>
      </CompanionErrorBoundary>
      <BottomNav />
      
      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title="About Your Companion"
        icon={Sparkles}
        description="Your companion evolves as you complete quests and build habits. Watch it grow through 21 stages!"
        features={[
          "Earn XP from quests and habits to level up",
          "Unlock trading cards at major evolution stages",
          "Read unique stories for each evolution",
          "Collect companion cards in your gallery"
        ]}
        tip="Your companion's element and personality are based on your zodiac sign and choices during onboarding."
      />
      
      <CompanionTutorialModal open={showTutorial} onClose={dismissTutorial} />
    </PageTransition>
  );
};

export default Companion;
