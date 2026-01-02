import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { PageTransition } from "@/components/PageTransition";
import { CompanionBadge } from "@/components/CompanionBadge";
import { FactionBadge } from "@/components/FactionBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BookOpen, MapPin, Package, Sparkles, Timer } from "lucide-react";
import { CompanionStoryJournal } from "@/components/CompanionStoryJournal";
import { CompanionPostcards } from "@/components/companion/CompanionPostcards";
import { CollectionTab } from "@/components/companion/CollectionTab";
import { FocusTab } from "@/components/companion/FocusTab";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { useUnreadGuildStories } from "@/hooks/useUnreadGuildStories";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { CompanionTutorialModal } from "@/components/CompanionTutorialModal";
import { useState, memo } from "react";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";

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

const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext, isLoading, error } = useCompanion();
  const { profile } = useProfile();
  const { data: unreadStoryCount = 0 } = useUnreadGuildStories();
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
        <div className="min-h-screen bg-background pb-nav-safe flex items-center justify-center">
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
        <div className="min-h-screen pb-nav-safe relative">
          <StarfieldBackground />
          
          <header className="sticky top-0 z-40 w-full cosmiq-glass-header safe-area-top">
            <div className="container flex items-center justify-between py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="font-heading font-black text-xl">Companion</h1>
              </div>
              <div className="flex items-center gap-2">
                {profile?.faction && (
                  <FactionBadge faction={profile.faction} variant="icon-only" />
                )}
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
            <TabsList className="grid w-full grid-cols-5 cosmiq-glass-subtle border border-cosmiq-glow/20">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="focus" className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span className="hidden sm:inline">Focus</span>
              </TabsTrigger>
              <TabsTrigger value="stories" className="flex items-center gap-2 relative">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Stories</span>
                {unreadStoryCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                    {unreadStoryCount > 9 ? '9+' : unreadStoryCount}
                  </span>
                )}
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
                />
              )}
            </TabsContent>

            <TabsContent value="focus">
              {activeTab === "focus" && <FocusTab />}
            </TabsContent>

            <TabsContent value="stories">
              {activeTab === "stories" && <CompanionStoryJournal />}
            </TabsContent>

            <TabsContent value="postcards">
              {activeTab === "postcards" && <CompanionPostcards />}
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
