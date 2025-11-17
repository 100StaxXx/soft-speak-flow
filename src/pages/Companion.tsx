import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Calendar, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";

const Companion = () => {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-4">
            <h1 className="text-2xl font-heading font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Companion & Progress
            </h1>
          </div>
        </header>

        <div className="container px-4 py-6 space-y-6 max-w-4xl mx-auto">
          <CompanionDisplay />

          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="progress">
                <Sparkles className="h-4 w-4 mr-2" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="evolution">
                <History className="h-4 w-4 mr-2" />
                Evolution
              </TabsTrigger>
              <TabsTrigger value="habits">
                <Calendar className="h-4 w-4 mr-2" />
                Habits
              </TabsTrigger>
              <TabsTrigger value="achievements">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="progress" className="space-y-6 mt-6">
              <XPBreakdown />
              <DailyMissions />
              <WeeklyInsights />
            </TabsContent>

            <TabsContent value="evolution" className="space-y-6 mt-6">
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>

            <TabsContent value="habits" className="space-y-6 mt-6">
              <HabitCalendar />
              <WeeklyInsights />
              <Button variant="outline" onClick={() => navigate('/habits')} className="w-full">Manage Habits</Button>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6 mt-6">
              <AchievementsPanel />
            </TabsContent>

          </Tabs>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Companion;
