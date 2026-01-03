import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { 
  Flame, 
  Trophy, 
  Plus,
  Check,
  Circle,
  Clock,
  Pencil,
  Repeat,
  ChevronDown,
  ChevronUp,
  Rocket,
  CheckCircle2,
  Target,
  Sparkles
} from "lucide-react";
import { MonthViewModal } from "@/components/calendar/MonthViewModal";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isOnboardingTask } from "@/hooks/useOnboardingSchedule";

import { DraggableSectionList, type TimeSection } from "./DraggableSectionList";
import { type DragHandleProps } from "./DraggableTaskList";

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  sort_order?: number | null;
}

interface Journey {
  id: string;
  title: string;
  progress_percentage: number;
}

interface TodaysAgendaProps {
  tasks: Task[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
  completedCount: number;
  totalCount: number;
  currentStreak?: number;
  activeJourneys?: Journey[];
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: Task) => void;
  onReorderTasks?: (tasks: Task[]) => void;
  onMoveTaskToSection?: (taskId: string, targetSection: TimeSection) => void;
  hideIndicator?: boolean;
  calendarTasks?: CalendarTask[];
  calendarMilestones?: CalendarMilestone[];
  onDateSelect?: (date: Date) => void;
}

// Helper to format time in 12-hour format
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function TodaysAgenda({
  tasks,
  selectedDate,
  onToggle,
  onAddQuest,
  completedCount,
  totalCount,
  currentStreak = 0,
  activeJourneys = [],
  onUndoToggle,
  onEditQuest,
  onReorderTasks,
  onMoveTaskToSection,
  hideIndicator = false,
  calendarTasks = [],
  calendarMilestones = [],
  onDateSelect,
}: TodaysAgendaProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showRitualsTooltip, setShowRitualsTooltip] = useState(false);
  const [showMonthView, setShowMonthView] = useState(false);
  
  // Track if we've already shown the tooltip this session
  const tooltipShownRef = useRef(false);
  
  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  // Find onboarding tasks
  const onboardingTasks = useMemo(() => 
    tasks.filter(t => isOnboardingTask(t.task_text)),
    [tasks]
  );
  
  const hasOnboardingTasks = onboardingTasks.length > 0;
  const onboardingComplete = onboardingTasks.filter(t => t.completed).length;
  const onboardingTotal = onboardingTasks.length;
  
// Display limits
  const QUEST_LIMIT_WITH_RITUALS = 6;
  const QUEST_LIMIT_SOLO = 6;
  const RITUAL_LIMIT = 6;

  // Separate ritual tasks (from campaigns) and regular quests
  const { ritualTasks, questTasks } = useMemo(() => {
    const rituals = tasks.filter(t => !!t.habit_source_id);
    const quests = tasks.filter(t => !t.habit_source_id);
    
    // Sort each group: incomplete first, then by scheduled time
    const sortGroup = (group: Task[]) => [...group].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.scheduled_time && b.scheduled_time) {
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      return 0;
    });
    
    return {
      ritualTasks: sortGroup(rituals),
      questTasks: sortGroup(quests),
    };
  }, [tasks]);

  // Show first-time tooltip for rituals grouping feature
  useEffect(() => {
    if (tooltipShownRef.current) return;
    const seen = localStorage.getItem('rituals_grouping_seen');
    if (!seen && ritualTasks.length > 0) {
      tooltipShownRef.current = true;
      setShowRitualsTooltip(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setShowRitualsTooltip(false);
        localStorage.setItem('rituals_grouping_seen', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [ritualTasks.length]);

  // Group ritual tasks by campaign
  const ritualsByCampaign = useMemo(() => {
    const groups = new Map<string, { 
      title: string; 
      tasks: Task[];
      completedCount: number;
      totalCount: number;
    }>();
    
    ritualTasks.forEach(task => {
      const key = task.epic_id || 'standalone';
      const title = task.epic_title || 'Standalone Rituals';
      
      if (!groups.has(key)) {
        groups.set(key, { title, tasks: [], completedCount: 0, totalCount: 0 });
      }
      const group = groups.get(key)!;
      group.tasks.push(task);
      group.totalCount++;
      if (task.completed) group.completedCount++;
    });
    
    return groups;
  }, [ritualTasks]);

  const questLimit = ritualTasks.length > 0 ? QUEST_LIMIT_WITH_RITUALS : QUEST_LIMIT_SOLO;

  const totalXP = tasks.reduce((sum, t) => (t.completed ? sum + t.xp_reward : sum), 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const triggerHaptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Haptics not available on web
    }
  };

  const renderTaskItem = useCallback((task: Task, dragProps?: DragHandleProps) => {
    const isComplete = !!task.completed;
    const isOnboarding = isOnboardingTask(task.task_text);
    const isRitual = !!task.habit_source_id;
    const isDragging = dragProps?.isDragging ?? false;
    const isPressed = dragProps?.isPressed ?? false;
    const isActivated = dragProps?.isActivated ?? false;
    
    const handleClick = (e: React.MouseEvent) => {
      // Don't allow clicks while dragging or during long press
      if (isDragging || isActivated || isPressed) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      
      if (isComplete && onUndoToggle) {
        triggerHaptic(ImpactStyle.Light);
        onUndoToggle(task.id, task.xp_reward);
      } else {
        triggerHaptic(ImpactStyle.Medium);
        onToggle(task.id, !isComplete, task.xp_reward);
      }
    };

    const taskContent = (
      <div
        className={cn(
          "flex items-center gap-3 py-2 transition-all relative group",
          "select-none",
          isComplete && "opacity-60",
          isDragging && "cursor-grabbing",
          isActivated && !isDragging && "bg-muted/30 rounded-lg -mx-1 px-1",
          isOnboarding && !isComplete && "bg-primary/5 -mx-2 px-2 rounded-lg"
        )}
        onClick={handleClick}
      >
        <div className="relative">
          <motion.div 
            className={cn(
              "flex-shrink-0 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all",
              isComplete 
                ? "bg-primary border-primary" 
                : isOnboarding
                  ? "border-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                  : "border-muted-foreground/30"
            )}
            whileTap={!isDragging && !isPressed ? { scale: 0.9 } : {}}
          >
            {isComplete && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check className="w-3 h-3 text-primary-foreground" />
              </motion.div>
            )}
          </motion.div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isRitual && (
              <Repeat className="w-4 h-4 text-accent flex-shrink-0" />
            )}
            <p className={cn(
              "text-base truncate",
              isComplete && "line-through text-muted-foreground"
            )}>
              {task.task_text}
            </p>
          </div>
          {task.scheduled_time && (
            <span className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-4 h-4" />
              {formatTime(task.scheduled_time)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Edit button - shows on hover for incomplete quests */}
          {onEditQuest && !isComplete && !isDragging && !isActivated && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 -m-1.5 opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
              onClick={(e) => {
                e.stopPropagation();
                onEditQuest(task);
              }}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {task.is_main_quest && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 bg-primary/10 border-primary/30">
              Main
            </Badge>
          )}
          <span className="text-sm font-bold text-stardust-gold/80">+{task.xp_reward}</span>
        </div>
      </div>
    );

    return taskContent;
  }, [onToggle, onUndoToggle, onEditQuest]);

  // Handle reordering of quest tasks
  const handleQuestReorder = useCallback((reorderedTasks: Task[]) => {
    if (onReorderTasks) {
      // Merge reordered quests with ritual tasks
      onReorderTasks(reorderedTasks);
    }
  }, [onReorderTasks]);

  // Handle moving task to a different section
  const handleMoveTask = useCallback((taskId: string, targetSection: TimeSection) => {
    if (onMoveTaskToSection) {
      onMoveTaskToSection(taskId, targetSection);
    }
  }, [onMoveTaskToSection]);

  return (
    <div className="relative">
      <div className="relative p-2 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMonthView(true)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg font-bold">
                {format(selectedDate, "MMM d, yyyy")}
              </span>
            </button>
            {currentStreak > 0 && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                currentStreak >= 30 
                  ? "bg-stardust-gold/20 text-stardust-gold" 
                  : currentStreak >= 14 
                    ? "bg-celestial-blue/20 text-celestial-blue" 
                    : "bg-orange-500/10 text-orange-400"
              )}>
                <Flame className="h-3.5 w-3.5" />
                {currentStreak}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-base">
            <Trophy className={cn(
              "h-5 w-5",
              allComplete ? "text-stardust-gold" : "text-stardust-gold/70"
            )} />
            <span className="font-semibold text-stardust-gold">{totalXP} XP</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {allComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>

        <div className="flex justify-between mb-4 text-sm text-muted-foreground">
          <span>{completedCount} of {totalCount} completed</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        {/* Task Lists */}
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <Circle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No tasks for this day
            </p>
            <Button size="sm" onClick={onAddQuest} className="gap-1">
              <Plus className="w-4 h-4" />
              Add Quest
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Quests Section */}
            {questTasks.length > 0 && (
              <>
                {ritualTasks.length > 0 && (
                  <div className="flex items-center gap-2 py-1.5 px-1">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Quests
                    </span>
                    <Badge variant="secondary" className="h-5 px-2 text-sm bg-muted text-muted-foreground border-0">
                      {questTasks.length}
                    </Badge>
                  </div>
                )}
                <DraggableSectionList
                  tasks={showAllTasks ? questTasks : questTasks.slice(0, questLimit)}
                  onReorderWithinSection={handleQuestReorder}
                  onMoveTask={handleMoveTask}
                  disableDrag={!onReorderTasks}
                  renderItem={(task, dragProps) => (
                    <div>
                      {renderTaskItem(task, dragProps)}
                      <div className="mx-8 border-b border-muted-foreground/20 last:hidden" />
                    </div>
                  )}
                />
                {questTasks.length > questLimit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTasks(!showAllTasks)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1 h-8"
                  >
                    {showAllTasks ? (
                      <>
                        <ChevronUp className="w-3 h-3 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3 mr-1" />
                        View all {questTasks.length} quests
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
            
            {/* Rituals Section - Grouped by Campaign */}
            {ritualTasks.length > 0 && (
              <>
                {/* Rituals header with first-time tooltip */}
                <TooltipProvider>
                  <Tooltip open={showRitualsTooltip} onOpenChange={setShowRitualsTooltip}>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center gap-2 py-1.5 px-1 mt-2 cursor-default"
                        onClick={() => {
                          if (showRitualsTooltip) {
                            setShowRitualsTooltip(false);
                            localStorage.setItem('rituals_grouping_seen', 'true');
                          }
                        }}
                      >
                        <motion.div 
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30"
                          animate={showRitualsTooltip ? { 
                            boxShadow: ['0 0 0 0 hsl(var(--accent) / 0.4)', '0 0 0 6px hsl(var(--accent) / 0)', '0 0 0 0 hsl(var(--accent) / 0.4)']
                          } : {}}
                          transition={{ duration: 1.5, repeat: showRitualsTooltip ? Infinity : 0 }}
                        >
                          <Sparkles className="w-4 h-4 text-accent" />
                          <span className="text-sm font-semibold text-accent uppercase tracking-wide">
                            Rituals
                          </span>
                          <Badge variant="secondary" className="h-5 px-2 text-sm bg-accent/20 text-accent border-0">
                            {ritualTasks.length}
                          </Badge>
                          {showRitualsTooltip && (
                            <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-accent text-accent-foreground animate-pulse">
                              New!
                            </Badge>
                          )}
                        </motion.div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-center">
                      <p className="text-xs">Rituals are now grouped by campaign! Tap a campaign to expand.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Campaign groups - each collapsible */}
                {Array.from(ritualsByCampaign.entries()).map(([campaignId, group]) => {
                  const isExpanded = expandedCampaigns.has(campaignId);
                  const isComplete = group.completedCount === group.totalCount;
                  
                  return (
                    <Collapsible 
                      key={campaignId} 
                      open={isExpanded} 
                      onOpenChange={() => toggleCampaign(campaignId)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className={cn(
                          "flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors",
                          "hover:bg-muted/30",
                          isComplete && "bg-green-500/10"
                        )}>
                          <div className="flex items-center gap-2">
                            {isComplete ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Target className="w-3.5 h-3.5 text-accent/70" />
                            )}
                            <span className={cn(
                              "text-xs font-medium truncate max-w-[160px]",
                              isComplete && "text-green-500"
                            )}>
                              {group.title}
                            </span>
                            <Badge variant="outline" className={cn(
                              "h-4 px-1.5 text-xs border-muted-foreground/30",
                              isComplete && "bg-green-500/20 text-green-500 border-green-500/30"
                            )}>
                              {group.completedCount}/{group.totalCount}
                            </Badge>
                          </div>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            isExpanded ? "" : "-rotate-90"
                          )} />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="pl-4 border-l border-accent/20 ml-2">
                          {group.tasks.map((task) => renderTaskItem(task))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Journey Progress Indicators */}
        {activeJourneys.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Journey Progress</p>
            <div className="flex gap-2 flex-wrap">
              {activeJourneys.map((journey) => (
                <div
                  key={journey.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs truncate max-w-[100px]">{journey.title}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(journey.progress_percentage)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Progress Banner */}
      {hasOnboardingTasks && onboardingComplete < onboardingTotal && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded-xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20"
        >
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Getting Started</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {onboardingComplete}/{onboardingTotal}
            </Badge>
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(onboardingComplete / onboardingTotal) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Complete all tasks to evolve your companion! ✨
          </p>
        </motion.div>
      )}
      
      <MonthViewModal
        open={showMonthView}
        onOpenChange={setShowMonthView}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          if (onDateSelect) onDateSelect(date);
          setShowMonthView(false);
        }}
        tasks={calendarTasks}
        milestones={calendarMilestones}
      />
    </div>
  );
}
