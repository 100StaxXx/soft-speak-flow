import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { CompanionStoryJournal } from "@/components/CompanionStoryJournal";
import { EvolutionCardGallery } from "@/components/EvolutionCardGallery";
import { PageTransition } from "@/components/PageTransition";
import { CompanionBadge } from "@/components/CompanionBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, BookOpen, Sparkles } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { StreakFreezeDisplay } from "@/components/StreakFreezeDisplay";
import { useState, memo } from "react";

// Memoized tab content to prevent unnecessary re-renders
const OverviewTab = memo(({ companion, nextEvolutionXP, progressToNext }: { 
  companion: any; 
  nextEvolutionXP: number; 
  progressToNext: number;
}) => (
  <div className="space-y-6 mt-6">
    <CompanionDisplay />
    <NextEvolutionPreview 
      currentXP={companion?.current_xp || 0}
      nextEvolutionXP={nextEvolutionXP || 0}
      currentStage={companion?.current_stage || 0}
      progressPercent={progressToNext}
    />
    <DailyMissions />
    <XPBreakdown />
  </div>
));
OverviewTab.displayName = 'OverviewTab';

const ProgressTab = memo(({ companionId }: { companionId: string }) => (
  <div className="space-y-6 mt-6">
    <StreakFreezeDisplay />
    <HabitCalendar />
    <WeeklyInsights />
    <AchievementsPanel />
    <CompanionEvolutionHistory companionId={companionId} />
  </div>
));
ProgressTab.displayName = 'ProgressTab';

const StoryTab = memo(() => (
  <div className="space-y-6 mt-6">
    <CompanionStoryJournal />
  </div>
));
StoryTab.displayName = 'StoryTab';

const CardsTab = memo(() => (
  <div className="space-y-6 mt-6">
    <EvolutionCardGallery />
  </div>
));
CardsTab.displayName = 'CardsTab';

const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext, isLoading, error } = useCompanion();
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Show error state if query failed
  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
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

  // If companion doesn't exist after loading, redirect to onboarding
  if (!companion) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
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
        <div className="min-h-screen pb-20 relative">
          <StarfieldBackground />
          
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
            <div className="container flex items-center justify-between py-4">
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

            <TabsContent value="overview">
              {activeTab === "overview" && (
                <OverviewTab 
                  companion={companion} 
                  nextEvolutionXP={nextEvolutionXP} 
                  progressToNext={progressToNext} 
                />
              )}
            </TabsContent>

            <TabsContent value="progress">
              {activeTab === "progress" && <ProgressTab companionId={companion.id} />}
            </TabsContent>

            <TabsContent value="story">
              {activeTab === "story" && <StoryTab />}
            </TabsContent>

            <TabsContent value="cards">
              {activeTab === "cards" && <CardsTab />}
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
    </PageTransition>
  );
};

export default Companion;