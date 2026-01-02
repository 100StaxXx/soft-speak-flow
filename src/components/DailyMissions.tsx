import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Target, Zap, TrendingUp, Sparkles } from "lucide-react";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { useMissionAutoComplete } from "@/hooks/useMissionAutoComplete";
import { Progress } from "@/components/ui/progress";
import { EmptyMissions } from "@/components/EmptyMissions";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MissionErrorFallback } from "@/components/ErrorFallback";
import { DailyMissionsInfoTooltip } from "@/components/DailyMissionsInfoTooltip";
import { MissionCardSkeleton } from "@/components/SkeletonLoader";
import { getTodaysTheme } from "@/config/missionTemplates";

const DailyMissionsContent = () => {
  const { 
    missions, 
    isLoading,
    completeMission, 
    isCompleting, 
    completedCount, 
    totalCount, 
    allComplete,
    regenerateMissions,
    isRegenerating,
    generationErrorMessage,
    missionTheme,
  } = useDailyMissions();
  
  // Enable auto-completion detection
  useMissionAutoComplete();
  
  // Use theme from backend if available, fallback to client-side calculation for cached missions
  const todaysTheme = missionTheme || getTodaysTheme();

  if (isLoading) {
    return <MissionCardSkeleton />;
  }

  if (missions.length === 0) {
    return (
      <EmptyMissions
        onRetry={regenerateMissions}
        isRetrying={isRegenerating}
        errorMessage={generationErrorMessage}
      />
    );
  }

  const progress = (completedCount / totalCount) * 100;
  
  // Separate base missions and bonus missions
  const baseMissions = missions.filter(m => !m.is_bonus);
  const bonusMissions = missions.filter(m => m.is_bonus);
  
  const handleComplete = async (id: string) => {
    haptics.medium();
    
    try {
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
    } catch (error) {
      console.error('Failed to complete mission:', error);
      haptics.light();
    }
  };

  const renderMission = (mission: typeof missions[0]) => {
    const hasProgress = mission.progress_target > 1;
    const progressPercent = hasProgress 
      ? (mission.progress_current / mission.progress_target) * 100 
      : 0;
    const isAutoComplete = mission.auto_complete;
    
    return (
      <div
        key={mission.id}
        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-all ${
          mission.completed
            ? "bg-accent/5 border-accent/20 opacity-60"
            : "bg-background border-border hover:border-accent/40"
        } ${mission.is_bonus ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-orange-500/5" : ""}`}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {mission.completed && (
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className={`text-sm font-medium ${mission.completed ? "line-through" : ""}`}>
                {mission.mission_text}
              </p>
              {isAutoComplete && !mission.completed && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  <Zap className="h-2.5 w-2.5 mr-1" />
                  Auto
                </Badge>
              )}
              {mission.is_bonus && (
                <Badge variant="gold" className="text-xs px-1.5 py-0">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  Bonus
                </Badge>
              )}
              {mission.difficulty === 'hard' && !mission.completed && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-red-500/50 text-red-600">
                  <TrendingUp className="h-2.5 w-2.5 mr-1" />
                  Hard
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">+{mission.xp_reward} XP</p>
              {hasProgress && !mission.completed && (
                <span className="text-xs text-muted-foreground">
                  • {mission.progress_current}/{mission.progress_target}
                </span>
              )}
            </div>
            {hasProgress && !mission.completed && (
              <Progress value={progressPercent} className="h-1 mt-1.5" />
            )}
          </div>
        </div>
        
        {!mission.completed && !isAutoComplete && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleComplete(mission.id)}
            disabled={isCompleting}
            className="transition-transform hover:scale-105 active:scale-95 hover:bg-accent/10 hover:border-accent/60 min-w-[90px]"
          >
            {isCompleting ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              "Complete"
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="p-4 sm:p-5 md:p-6 cosmiq-glass-ultra border-accent/30 hover:border-accent/50 transition-all duration-500 hover:shadow-glow shadow-medium relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-primary/10 pointer-events-none" />
      <div className="relative space-y-3 sm:space-y-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h3 className="font-heading font-black text-base sm:text-lg">Daily Missions</h3>
                <DailyMissionsInfoTooltip />
              </div>
              {/* Theme Day Badge */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm">{todaysTheme.emoji}</span>
                <span className="text-xs text-muted-foreground font-medium">{todaysTheme.name}</span>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground ml-auto">
              {completedCount}/{totalCount} complete
            </p>
          </div>
          {allComplete && (
            <div className="text-[10px] sm:text-xs font-bold text-stardust-gold animate-pulse">
              All Done! 🎉
            </div>
          )}
        </div>

        <Progress value={progress} className="h-2" />

        {/* Base Missions */}
        <div className="space-y-2">
          {baseMissions.map(renderMission)}
        </div>
        
        {/* Bonus Missions Section */}
        {bonusMissions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <Sparkles className="h-3.5 w-3.5 text-stardust-gold" />
              <span className="text-xs font-semibold text-stardust-gold">Streak Bonus</span>
            </div>
            {bonusMissions.map(renderMission)}
          </div>
        )}
      </div>
    </Card>
  );
};

export const DailyMissions = () => (
  <ErrorBoundary fallback={<MissionErrorFallback />}>
    <DailyMissionsContent />
  </ErrorBoundary>
);
