import { memo, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Target, Flame, Calendar, Star } from "lucide-react";
import { differenceInDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JourneyDetailDrawer } from "@/components/JourneyDetailDrawer";
import { EpicCheckInDrawer } from "@/components/EpicCheckInDrawer";
import { useEpics } from "@/hooks/useEpics";
import { cn } from "@/lib/utils";

interface CampaignStripProps {
  onAddCampaign: () => void;
  className?: string;
}

export const CampaignStrip = memo(function CampaignStrip({ 
  onAddCampaign,
  className 
}: CampaignStripProps) {
  const { activeEpics, isLoading } = useEpics();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const canAddMore = activeEpics.length < 2;

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-12 bg-muted/20 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Don't render if no campaigns and can add (empty state handled elsewhere)
  if (activeEpics.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("mb-4", className)}
      >
        <button
          onClick={onAddCampaign}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl
            border-2 border-dashed border-primary/30 
            bg-gradient-to-br from-primary/5 to-primary/10
            hover:border-primary/50 hover:from-primary/10 hover:to-primary/15
            transition-all duration-200"
        >
          <Plus className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary">Start Your First Campaign</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mb-4", className)}
    >
      {/* Header */}
      <button 
        onClick={handleToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-xl
          bg-gradient-to-r from-sky-500/10 to-purple-500/10
          border border-b-0 border-border/30"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-semibold">Active Campaigns</span>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {activeEpics.length}/2
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {canAddMore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onAddCampaign();
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Campaign Cards */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border border-t-0 border-border/30 rounded-b-xl bg-card/30 backdrop-blur-sm"
          >
            <div className="p-3 space-y-3">
              {activeEpics.map((epic) => (
                <CampaignCard key={epic.id} epic={epic} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

interface CampaignCardProps {
  epic: {
    id: string;
    title: string;
    description?: string;
    progress_percentage: number;
    target_days: number;
    start_date: string;
    end_date: string;
    epic_habits?: Array<{
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
    }>;
  };
}

const CampaignCard = memo(function CampaignCard({ epic }: CampaignCardProps) {
  const daysRemaining = useMemo(() => {
    return Math.max(0, differenceInDays(new Date(epic.end_date), new Date()));
  }, [epic.end_date]);

  const ritualCount = epic.epic_habits?.filter(eh => eh.habits)?.length || 0;

  // Count today's rituals using same logic as JourneyCard
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

  return (
    <JourneyDetailDrawer
      epicId={epic.id}
      epicTitle={epic.title}
      epicGoal={epic.description}
      currentDeadline={epic.end_date}
    >
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="p-3 rounded-xl bg-background/50 border border-border/20 cursor-pointer
          hover:border-primary/30 hover:bg-background/70 transition-all"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">{epic.title}</span>
          </div>
          <span className="text-xs font-bold text-primary ml-2">
            {Math.round(epic.progress_percentage)}%
          </span>
        </div>

        <Progress 
          value={epic.progress_percentage} 
          className="h-1.5 mb-2" 
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              {daysRemaining}d left
            </span>
            {ritualCount > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-purple-400" />
                {todayRitualCount} today
              </span>
            )}
          </div>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {epic.target_days}d
          </span>
        </div>
      </motion.div>
    </JourneyDetailDrawer>
  );
});
