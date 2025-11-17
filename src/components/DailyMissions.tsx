import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Target } from "lucide-react";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { Progress } from "@/components/ui/progress";
import { EmptyMissions } from "@/components/EmptyMissions";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";

export const DailyMissions = () => {
  const { missions, completeMission, isCompleting, completedCount, totalCount, allComplete } = useDailyMissions();

  if (missions.length === 0) return <EmptyMissions />;

  const progress = (completedCount / totalCount) * 100;
  
  const handleComplete = async (id: string) => {
    haptics.medium();
    await completeMission(id);
    
    // Check if this completion makes all missions complete
    const updatedMissions = missions.map(m => 
      m.id === id ? { ...m, completed: true } : m
    );
    const allWillBeComplete = updatedMissions.every(m => m.completed);
    
    if (allWillBeComplete) {
      // Big celebration for completing all missions
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 120,
          origin: { y: 0.6 },
          colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700', '#FFA500'],
          ticks: 400,
          gravity: 0.6,
          scalar: 1.5,
        });
      }, 500);
    }
  };

  return (
    <Card className="p-5 md:p-6 bg-gradient-to-br from-accent/10 via-card to-primary/10 border-accent/30 hover:border-accent/50 transition-all duration-500 hover:shadow-glow shadow-medium relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative space-y-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg">Daily Missions</h3>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} complete
              </p>
            </div>
          </div>
          {allComplete && (
            <div className="text-xs font-bold text-green-500 animate-pulse">
              All Done! 🎉
            </div>
          )}
        </div>

        <Progress value={progress} className="h-2" />

        <div className="space-y-2">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                mission.completed
                  ? "bg-accent/5 border-accent/20 opacity-60"
                  : "bg-background border-border hover:border-accent/40"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {mission.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${mission.completed ? "line-through" : ""}`}>
                    {mission.mission_text}
                  </p>
                  <p className="text-xs text-muted-foreground">+{mission.xp_reward} XP</p>
                </div>
              </div>
              
              {!mission.completed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleComplete(mission.id)}
                  disabled={isCompleting}
                  className="transition-transform hover:scale-105 active:scale-95 hover:bg-accent/10 hover:border-accent/60"
                >
                  Complete
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
