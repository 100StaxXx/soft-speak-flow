import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { CompanionOnboarding } from "@/components/CompanionOnboarding";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { PageTransition } from "@/components/PageTransition";
import { CompanionBadge } from "@/components/CompanionBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, History, TrendingUp } from "lucide-react";
import { useCompanion } from "@/hooks/useCompanion";

const Companion = () => {
  const { companion, nextEvolutionXP, progressToNext } = useCompanion();

  if (!companion) {
    return <CompanionOnboarding />;
  }

  return (
    <PageTransition>
      <CompanionErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 md:h-16 items-center px-4">
            <h1 className="text-xl md:text-2xl font-heading font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Companion & Progress
            </h1>
          </div>
        </header>

        <div className="container px-3 md:px-4 py-5 md:py-7 space-y-6 md:space-y-8 max-w-4xl mx-auto">
          <div data-tour="companion-display" className="space-y-4">
            <CompanionDisplay />
            {companion && (
              <div className="flex justify-center">
                <CompanionBadge 
                  element={companion.core_element} 
                  stage={companion.current_stage}
                  showStage={true}
                />
              </div>
            )}
          </div>

          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="progress" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="progress-tab">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="achievements-tab">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Achievements</span>
              </TabsTrigger>
              <TabsTrigger value="evolution" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="evolution-tab">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Evolution</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="progress" className="space-y-6 mt-6">
              <HabitCalendar />
              <NextEvolutionPreview 
                currentStage={companion?.current_stage || 0}
                currentXP={companion?.current_xp || 0}
                nextEvolutionXP={companion ? nextEvolutionXP : 0}
                progressPercent={companion ? progressToNext : 0}
              />
              <div data-tour="xp-breakdown">
                <XPBreakdown />
              </div>
              <div data-tour="daily-missions">
                <DailyMissions />
              </div>
              <WeeklyInsights />
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6 mt-6">
              <AchievementsPanel />
            </TabsContent>

            <TabsContent value="evolution" className="space-y-6 mt-6">
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>
          </Tabs>
        </div>

        <BottomNav />
      </div>
      </CompanionErrorBoundary>
    </PageTransition>
  );
};

export default Companion;
