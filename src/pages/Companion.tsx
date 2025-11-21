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


const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext } = useCompanion();

  return (
    <PageTransition>
      <CompanionErrorBoundary>
        <div className="min-h-screen bg-background pb-20">
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="font-heading font-black text-xl">Companion</h1>
              </div>
              {companion && (
                <CompanionBadge 
                  element={companion.core_element}
                  stage={companion.current_stage}
                  showStage={true}
                />
              )}
            </div>
          </header>

          <Tabs defaultValue="overview" className="container py-6">
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
              <CompanionDisplay />
              <NextEvolutionPreview 
                currentXP={companion?.current_xp || 0}
                nextEvolutionXP={nextEvolutionXP || 0}
                currentStage={companion?.current_stage || 0}
                progressPercent={progressToNext}
              />
              <XPBreakdown />
              <DailyMissions />
            </TabsContent>

            <TabsContent value="progress" className="space-y-6 mt-6">
              <HabitCalendar />
              <WeeklyInsights />
              <AchievementsPanel />
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>

            <TabsContent value="story" className="space-y-6 mt-6">
              <CompanionStoryJournal />
            </TabsContent>

            <TabsContent value="cards" className="space-y-6 mt-6">
              <EvolutionCardGallery />
            </TabsContent>
          </Tabs>
        </div>
      </CompanionErrorBoundary>
      <BottomNav />
      
    </PageTransition>
  );
};

export default Companion;
