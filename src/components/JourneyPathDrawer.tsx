import { memo, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { differenceInDays } from "date-fns";
import { Target, Flame, Star, Map, Sparkles, Calendar } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConstellationTrail } from "@/components/ConstellationTrail";
import { JourneyDetailDrawer } from "@/components/JourneyDetailDrawer";
import { EpicCheckInDrawer } from "@/components/EpicCheckInDrawer";
import { useJourneyPathImage } from "@/hooks/useJourneyPathImage";
import { useMilestones } from "@/hooks/useMilestones";
import { useCompanion } from "@/hooks/useCompanion";

interface EpicHabit {
  habit_id: string;
  habits: {
    id: string;
    title: string;
    difficulty: string;
    description?: string;
    frequency?: string;
    estimated_minutes?: number;
    custom_days?: number[] | null;
  };
}

interface JourneyPathDrawerProps {
  epic: {
    id: string;
    title: string;
    description?: string;
    progress_percentage: number;
    target_days: number;
    start_date: string;
    end_date: string;
    epic_habits?: EpicHabit[];
  };
  children?: React.ReactNode;
}

export const JourneyPathDrawer = memo(function JourneyPathDrawer({
  epic,
  children,
}: JourneyPathDrawerProps) {
  const [open, setOpen] = useState(false);
  
  const { pathImageUrl, isLoading: isLoadingPath } = useJourneyPathImage(epic.id);
  const { milestones, totalCount } = useMilestones(epic.id);
  const { companion } = useCompanion();

  const daysRemaining = useMemo(() => {
    return Math.max(0, differenceInDays(new Date(epic.end_date), new Date()));
  }, [epic.end_date]);

  const ritualCount = epic.epic_habits?.filter(eh => eh.habits)?.length || 0;

  // Extract habits for check-in drawer
  const habits = useMemo(() => {
    if (!epic.epic_habits) return [];
    return epic.epic_habits
      .filter(eh => eh.habits)
      .map(eh => ({
        id: eh.habits.id,
        title: eh.habits.title,
        difficulty: eh.habits.difficulty,
        description: eh.habits.description || null,
        frequency: eh.habits.frequency,
        estimated_minutes: eh.habits.estimated_minutes || null,
        custom_days: eh.habits.custom_days || null,
      }));
  }, [epic.epic_habits]);

  // Count today's rituals
  const todayRitualCount = useMemo(() => {
    if (!epic.epic_habits) return 0;
    const today = new Date().getDay();
    return epic.epic_habits.filter(eh => {
      if (!eh.habits) return false;
      const freq = eh.habits.frequency;
      if (freq === 'daily') return true;
      if (freq === 'custom' && eh.habits.custom_days) {
        return eh.habits.custom_days.includes(today);
      }
      return true;
    }).length;
  }, [epic.epic_habits]);

  // Convert milestones to trail format
  const trailMilestones = useMemo(() => {
    return milestones.map(m => ({
      id: m.id,
      title: m.title,
      milestone_percent: m.milestone_percent,
      is_postcard_milestone: m.is_postcard_milestone,
      completed_at: m.completed_at,
      description: m.description,
      phase_name: m.phase_name,
      target_date: m.target_date,
      chapter_number: m.chapter_number,
    }));
  }, [milestones]);

  return (
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false} handleOnly={true}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {epic.title}
          </DrawerTitle>
          
          {/* Progress bar with stats */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-primary">
                {Math.round(epic.progress_percentage)}% Complete
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {daysRemaining}d left
              </span>
            </div>
            <Progress value={epic.progress_percentage} className="h-2" />
          </div>
        </DrawerHeader>

        <div 
          className="flex-1 px-4 pb-6 max-h-[60vh] overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          data-vaul-no-drag
        >
          {/* Journey Path Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className="rounded-xl overflow-hidden border border-border/30 bg-card/30 backdrop-blur-sm">
              {/* AI-Generated Path Image Background */}
              {pathImageUrl && (
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={pathImageUrl}
                    alt="Your journey path"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                </div>
              )}
              
              {/* Constellation Trail */}
              <div className={cn(
                "relative",
                pathImageUrl ? "-mt-20" : "mt-0"
              )}>
              <ConstellationTrail
                progress={epic.progress_percentage}
                targetDays={epic.target_days}
                companionImageUrl={companion?.current_image_url}
                companionMood={companion?.current_mood}
                showCompanion={true}
                milestones={trailMilestones}
                transparentBackground={!!pathImageUrl}
                className="h-40"
              />
              </div>

              {/* Loading state for path */}
              {isLoadingPath && !pathImageUrl && (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Sparkles className="w-8 h-8 text-primary/50 mx-auto animate-pulse" />
                    <p className="text-xs text-muted-foreground">Loading journey path...</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-6 mb-6 text-sm text-muted-foreground">
            {todayRitualCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>{todayRitualCount} rituals today</span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-purple-400" />
              <span>{totalCount} milestones</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>{epic.target_days}d journey</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <JourneyDetailDrawer
              epicId={epic.id}
              epicTitle={epic.title}
              epicGoal={epic.description}
              currentDeadline={epic.end_date}
            >
              <Button variant="outline" className="flex-1 gap-2">
                <Map className="w-4 h-4" />
                View Milestones
              </Button>
            </JourneyDetailDrawer>
            
            <EpicCheckInDrawer 
              epicId={epic.id}
              habits={habits}
              isActive={true}
              renderTrigger={() => (
                <Button variant="default" className="flex-1 gap-2">
                  <Sparkles className="w-4 h-4" />
                  Check-In
                </Button>
              )}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
});
