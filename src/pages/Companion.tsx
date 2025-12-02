import { BottomNav } from "@/components/BottomNav";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, BookOpen, Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { CompanionBadge } from "@/components/CompanionBadge";
import { useState, lazy, Suspense } from "react";

// Lazy load heavy components to improve initial load time
const CompanionDisplay = lazy(() => import("@/components/CompanionDisplay").then(m => ({ default: m.CompanionDisplay })));
const NextEvolutionPreview = lazy(() => import("@/components/NextEvolutionPreview").then(m => ({ default: m.NextEvolutionPreview })));
const DailyMissions = lazy(() => import("@/components/DailyMissions").then(m => ({ default: m.DailyMissions })));
const XPBreakdown = lazy(() => import("@/components/XPBreakdown").then(m => ({ default: m.XPBreakdown })));
const StreakFreezeDisplay = lazy(() => import("@/components/StreakFreezeDisplay").then(m => ({ default: m.StreakFreezeDisplay })));
const HabitCalendar = lazy(() => import("@/components/HabitCalendar").then(m => ({ default: m.HabitCalendar })));
const WeeklyInsights = lazy(() => import("@/components/WeeklyInsights").then(m => ({ default: m.WeeklyInsights })));
const AchievementsPanel = lazy(() => import("@/components/AchievementsPanel").then(m => ({ default: m.AchievementsPanel })));
const CompanionEvolutionHistory = lazy(() => import("@/components/CompanionEvolutionHistory").then(m => ({ default: m.CompanionEvolutionHistory })));
const CompanionStoryJournal = lazy(() => import("@/components/CompanionStoryJournal").then(m => ({ default: m.CompanionStoryJournal })));
const EvolutionCardGallery = lazy(() => import("@/components/EvolutionCardGallery").then(m => ({ default: m.EvolutionCardGallery })));
const CompanionErrorBoundary = lazy(() => import("@/components/CompanionErrorBoundary").then(m => ({ default: m.CompanionErrorBoundary })));

const TabSkeleton = () => (
  <div className="space-y-4">
    <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />
    <div className="h-32 rounded-xl bg-muted/30 animate-pulse" />
  </div>
);

const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext, isLoading } = useCompanion();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Show loading state while companion is being fetched
  if (isLoading || !companion) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-muted-foreground">Loading your companion...</p>
          </div>
        </div>
        <BottomNav />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <Suspense fallback={<TabSkeleton />}>
        <CompanionErrorBoundary>
          <div className="min-h-screen pb-20 relative">
            <StarfieldBackground />
            
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex items-center justify-between py-4 safe-area-top">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h1 className="font-heading font-black text-xl">Companion</h1>
                </div>
                <div className="flex items-center gap-2">
                  <PageInfoButton onClick={() => setShowPageInfo(true)} />
                  <div data-tour="companion-tooltip-anchor">
                    <CompanionBadge 
                      element={companion.core_element}
                      stage={companion.current_stage}
                      showStage={true}
                    />
                  </div>
                </div>
              </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="container py-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="progress">
                  <Trophy className="h-4 w-4 mr-2" />
                  Progress
                </TabsTrigger>
                <TabsTrigger value="story">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Story
                </TabsTrigger>
                <TabsTrigger value="cards">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Cards
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {activeTab === "overview" && (
                  <Suspense fallback={<TabSkeleton />}>
                    <CompanionDisplay />
                    <NextEvolutionPreview 
                      currentXP={companion?.current_xp || 0}
                      nextEvolutionXP={nextEvolutionXP || 0}
                      currentStage={companion?.current_stage || 0}
                      progressPercent={progressToNext}
                    />
                    <DailyMissions />
                    <XPBreakdown />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="progress" className="space-y-6 mt-6">
                {activeTab === "progress" && (
                  <Suspense fallback={<TabSkeleton />}>
                    <StreakFreezeDisplay />
                    <HabitCalendar />
                    <WeeklyInsights />
                    <AchievementsPanel />
                    <CompanionEvolutionHistory companionId={companion.id} />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="story" className="space-y-6 mt-6">
                {activeTab === "story" && (
                  <Suspense fallback={<TabSkeleton />}>
                    <CompanionStoryJournal />
                  </Suspense>
                )}
              </TabsContent>

              <TabsContent value="cards" className="space-y-6 mt-6">
                {activeTab === "cards" && (
                  <Suspense fallback={<TabSkeleton />}>
                    <EvolutionCardGallery />
                  </Suspense>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CompanionErrorBoundary>
      </Suspense>
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
    </PageTransition>
  );
};

export default Companion;
