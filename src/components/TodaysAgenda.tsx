import { useMemo, useRef, useState, useEffect, useCallback, memo } from "react";
import { format, differenceInDays } from "date-fns";
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
  Sparkles,
  Zap,
  FileText,
  Timer,
  Brain,
  Heart,
  Dumbbell,
  ArrowUpDown,
  Inbox,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn, stripMarkdown } from "@/lib/utils";
import { isOnboardingTask } from "@/hooks/useOnboardingSchedule";

import { useProfile } from "@/hooks/useProfile";
import { playStrikethrough } from "@/utils/soundEffects";

import { type DragHandleProps } from "./DraggableTaskList";
import { SwipeableTaskItem } from "./SwipeableTaskItem";
import { MarqueeText } from "@/components/ui/marquee-text";
import { JourneyPathDrawer } from "@/components/JourneyPathDrawer";
import { TimelineTaskRow } from "@/components/TimelineTaskRow";
import { ProgressRing } from "@/features/tasks/components/ProgressRing";

import type { ParsedTask } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { PlanMyWeekAnswers } from "@/features/tasks/components/PlanMyWeekClarification";

// Helper to calculate days remaining
const getDaysLeft = (endDate?: string | null) => {
  if (!endDate) return null;
  return Math.max(0, differenceInDays(new Date(endDate), new Date()));
};

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  task_date?: string;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  sort_order?: number | null;
  // Expandable detail fields
  notes?: string | null;
  priority?: string | null;
  energy_level?: string | null;
  estimated_duration?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  image_url?: string | null;
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
  hideIndicator?: boolean;
  calendarTasks?: CalendarTask[];
  calendarMilestones?: CalendarMilestone[];
  onDateSelect?: (date: Date) => void;
  onQuickAdd?: (parsed: ParsedTask) => void;
  onPlanMyDay?: () => void;
  onPlanMyWeek?: (answers: PlanMyWeekAnswers) => void;
  activeEpics?: Array<{
    id: string;
    title: string;
    description?: string | null;
    progress_percentage?: number | null;
    target_days: number;
    start_date: string;
    end_date: string;
    epic_habits?: Array<{
      habit_id: string;
      habits: {
        id: string;
        title: string;
        difficulty: string;
        description?: string | null;
        frequency?: string;
        estimated_minutes?: number | null;
        custom_days?: number[] | null;
      };
    }>;
  }>;
  habitsAtRisk?: Array<{ id: string; title: string; current_streak: number }>;
  onDeleteQuest?: (taskId: string) => void;
  onMoveQuestToNextDay?: (taskId: string) => void;
}

// Helper to format time in 12-hour format
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const TodaysAgenda = memo(function TodaysAgenda({
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
  hideIndicator = false,
  calendarTasks = [],
  calendarMilestones = [],
  onDateSelect,
  onQuickAdd,
  onPlanMyDay,
  onPlanMyWeek,
  activeEpics = [],
  habitsAtRisk = [],
  onDeleteQuest,
  onMoveQuestToNextDay,
}: TodaysAgendaProps) {
  const { profile } = useProfile();
  const keepInPlace = profile?.completed_tasks_stay_in_place ?? true;
  
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showMonthView, setShowMonthView] = useState(false);
  const [sortBy, setSortBy] = useState<'custom' | 'time' | 'priority' | 'xp'>('custom');
  const [justCompletedTasks, setJustCompletedTasks] = useState<Set<string>>(new Set());
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  
  // Track touch start position to distinguish taps from scrolls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Clean up optimistic state when server confirms completion
  useEffect(() => {
    setOptimisticCompleted(prev => {
      const confirmedIds = tasks.filter(t => t.completed).map(t => t.id);
      const next = new Set(prev);
      confirmedIds.forEach(id => next.delete(id));
      return next.size !== prev.size ? next : prev;
    });
  }, [tasks]);

  // Find onboarding tasks
  const onboardingTasks = useMemo(() => 
    tasks.filter(t => isOnboardingTask(t.task_text)),
    [tasks]
  );
  
  const hasOnboardingTasks = onboardingTasks.length > 0;
  const onboardingComplete = onboardingTasks.filter(t => t.completed).length;
  const onboardingTotal = onboardingTasks.length;

  // Auto-expand only the first uncompleted onboarding task (accordion style)
  useEffect(() => {
    const firstUncompletedOnboarding = tasks.find(t => isOnboardingTask(t.task_text) && !t.completed);
    
    if (firstUncompletedOnboarding) {
      setExpandedTasks(prev => {
        // Only add if not already expanded
        if (prev.has(firstUncompletedOnboarding.id)) return prev;
        const next = new Set(prev);
        next.add(firstUncompletedOnboarding.id);
        return next;
      });
    }
  }, [tasks]);
  

  // Priority weight for sorting
  const getPriorityWeight = (priority: string | null | undefined) => {
    switch (priority) {
      case 'high': return 0;
      case 'medium': return 1;
      case 'low': return 2;
      default: return 3;
    }
  };

  // Separate ritual tasks (from campaigns) and regular quests
  const { ritualTasks, questTasks } = useMemo(() => {
    const rituals = tasks.filter(t => !!t.habit_source_id);
    const quests = tasks.filter(t => !t.habit_source_id);
    
    // Sort based on selected sort option
    const sortGroup = (group: Task[]) => {
      let sorted = [...group].sort((a, b) => {
        switch (sortBy) {
          case 'time':
            if (a.scheduled_time && b.scheduled_time) {
              return a.scheduled_time.localeCompare(b.scheduled_time);
            }
            if (a.scheduled_time) return -1;
            if (b.scheduled_time) return 1;
            return 0;
          case 'priority':
            return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
          case 'xp':
            return b.xp_reward - a.xp_reward;
          case 'custom':
          default:
            const orderA = a.sort_order ?? 9999;
            const orderB = b.sort_order ?? 9999;
            if (orderA !== orderB) return orderA - orderB;
            if (a.scheduled_time && b.scheduled_time) {
              return a.scheduled_time.localeCompare(b.scheduled_time);
            }
            if (a.scheduled_time) return -1;
            if (b.scheduled_time) return 1;
            return a.id.localeCompare(b.id);
        }
      });
      
      if (!keepInPlace) {
        const incomplete = sorted.filter(t => !t.completed);
        const complete = sorted.filter(t => t.completed);
        sorted = [...incomplete, ...complete];
      }
      
      return sorted;
    };
    
    return {
      ritualTasks: sortGroup(rituals),
      questTasks: sortGroup(quests),
    };
  }, [tasks, sortBy, keepInPlace]);

  // Merge all tasks (quests + rituals) into a unified timeline
  const { scheduledItems, anytimeItems } = useMemo(() => {
    const all = [...questTasks, ...ritualTasks];
    const scheduled = all.filter(t => !!t.scheduled_time).sort((a, b) => 
      (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
    );
    const anytime = all.filter(t => !t.scheduled_time);
    return { scheduledItems: scheduled, anytimeItems: anytime };
  }, [questTasks, ritualTasks]);



  

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

  // Check if a task has expandable details
  const hasExpandableDetails = useCallback((task: Task) => {
    return !!(
      task.notes || 
      task.priority || 
      task.energy_level || 
      task.estimated_duration || 
      (task.is_recurring && task.recurrence_pattern) || 
      task.difficulty ||
      task.category
    );
  }, []);

  const toggleTaskExpanded = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const isClickingOnboarding = tasks.some(t => t.id === taskId && isOnboardingTask(t.task_text));
    
    setExpandedTasks(prev => {
      const next = new Set(prev);
      
      if (next.has(taskId)) {
        // Closing this task
        next.delete(taskId);
      } else {
        // Opening this task - if it's onboarding, close other onboarding tasks first
        if (isClickingOnboarding) {
          tasks.forEach(t => {
            if (isOnboardingTask(t.task_text) && t.id !== taskId) {
              next.delete(t.id);
            }
          });
        }
        next.add(taskId);
      }
      
      return next;
    });
  }, [tasks]);

  const getCategoryIcon = (category: string | null | undefined) => {
    switch (category) {
      case 'mind': return Brain;
      case 'body': return Dumbbell;
      case 'soul': return Heart;
      default: return null;
    }
  };

  const renderTaskItem = useCallback((task: Task, dragProps?: DragHandleProps) => {
    const isComplete = !!task.completed || optimisticCompleted.has(task.id);
    const isOnboarding = isOnboardingTask(task.task_text);
    const isRitual = !!task.habit_source_id;
    const isDragging = dragProps?.isDragging ?? false;
    const isPressed = dragProps?.isPressed ?? false;
    const isActivated = dragProps?.isActivated ?? false;
    const isExpanded = expandedTasks.has(task.id);
    const hasDetails = hasExpandableDetails(task);
    
    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Don't allow clicks while dragging or during long press
      if (isDragging || isActivated || isPressed) {
        e.preventDefault();
        return;
      }
      
      if (isComplete && onUndoToggle) {
        // Undo: remove from optimistic set
        setOptimisticCompleted(prev => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        triggerHaptic(ImpactStyle.Light);
        onUndoToggle(task.id, task.xp_reward);
      } else {
        // Complete: add to optimistic set immediately for instant strikethrough
        setOptimisticCompleted(prev => new Set(prev).add(task.id));
        triggerHaptic(ImpactStyle.Medium);
        playStrikethrough();
        // Track for strikethrough animation
        setJustCompletedTasks(prev => new Set(prev).add(task.id));
        setTimeout(() => {
          setJustCompletedTasks(prev => {
            const next = new Set(prev);
            next.delete(task.id);
            return next;
          });
        }, 600);
        
        // Auto-collapse tutorial quests when completed and expand next one
        if (isOnboarding) {
          setExpandedTasks(prev => {
            const next = new Set(prev);
            next.delete(task.id);
            
            // Find and expand the next uncompleted onboarding task
            const nextOnboarding = tasks.find(t => 
              isOnboardingTask(t.task_text) && 
              !t.completed && 
              t.id !== task.id
            );
            if (nextOnboarding) {
              next.add(nextOnboarding.id);
            }
            
            return next;
          });
        }
        
        onToggle(task.id, !isComplete, task.xp_reward);
      }
    };

    const CategoryIcon = getCategoryIcon(task.category);

    const taskContent = (
      <Collapsible open={isExpanded} onOpenChange={() => {}}>
        <div
          className={cn(
            "flex items-center gap-3 transition-all relative group",
            "select-none min-h-[52px]",
            isRitual ? "py-4" : "py-3",
            isComplete && "opacity-60",
            isDragging && "cursor-grabbing",
                isActivated && !isDragging && "bg-muted/30 rounded-lg",
                isOnboarding && !isComplete && "bg-primary/5 rounded-lg"
          )}
        >
          {/* Checkbox - only this toggles completion */}
              <div className="relative ml-1">
            {/* Tutorial quest breathing glow effect */}
            {isOnboarding && !isComplete && (
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/30"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 0, 0.6]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            <button
              data-interactive="true"
              onClick={handleCheckboxClick}
              onTouchStart={(e) => {
                touchStartRef.current = { 
                  x: e.touches[0].clientX, 
                  y: e.touches[0].clientY 
                };
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only trigger if finger moved less than 5px (not scrolling)
                if (touchStartRef.current) {
                  const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
                  const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
                  if (dx < 5 && dy < 5) {
                    handleCheckboxClick(e as unknown as React.MouseEvent);
                  }
                }
                touchStartRef.current = null;
              }}
              className="relative flex items-center justify-center w-11 h-11 -ml-3 touch-manipulation active:scale-95 transition-transform select-none"
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
              aria-label={isComplete ? "Mark task as incomplete" : "Mark task as complete"}
              role="checkbox"
              aria-checked={isComplete}
              tabIndex={0}
            >
              <motion.div 
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  isComplete 
                    ? "bg-primary border-primary" 
                    : isOnboarding
                      ? "border-primary ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
                      : "border-muted-foreground/40 hover:border-primary"
                )}
                whileTap={!isDragging && !isPressed ? { scale: 0.85 } : {}}
              >
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.div>
            </button>
            {/* Tutorial quest helper label */}
            {isOnboarding && !isComplete && (
              <motion.span
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-primary whitespace-nowrap font-medium"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Tap to complete
              </motion.span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isRitual && (
                <Repeat className="w-4 h-4 text-accent flex-shrink-0" />
              )}
              <MarqueeText
                text={task.task_text}
                className={cn(
                  "text-sm flex-1",
                  isComplete && "text-muted-foreground",
                  isComplete && (justCompletedTasks.has(task.id) ? "animate-strikethrough" : "line-through")
                )}
              />
            </div>
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
            
            {/* Chevron for expandable details - only shown if task has details */}
            {hasDetails && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -m-1 flex-shrink-0"
                onClick={(e) => toggleTaskExpanded(task.id, e)}
              >
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            )}
          </div>
        </div>

        {/* Expandable details section */}
        <CollapsibleContent>
          <div className="pl-8 pr-2 pb-2 space-y-2">
            {/* Notes - with tutorial highlight */}
            {task.notes && (
              <motion.div 
                className={cn(
                  "flex items-start gap-2 text-sm",
                  isOnboarding && !isComplete 
                    ? "p-2 rounded-lg bg-primary/10 border border-primary/20 text-foreground" 
                    : "text-muted-foreground"
                )}
                animate={isOnboarding && !isComplete ? {
                  boxShadow: [
                    "0 0 0 0 rgba(129, 140, 248, 0)",
                    "0 0 12px 2px rgba(129, 140, 248, 0.3)",
                    "0 0 0 0 rgba(129, 140, 248, 0)"
                  ]
                } : {}}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">{stripMarkdown(task.notes)}</p>
              </motion.div>
            )}
            
            {/* Badges row */}
            <div className="flex flex-wrap gap-1.5">
              {/* Category */}
              {CategoryIcon && task.category && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                  <CategoryIcon className="w-3 h-3" />
                  {task.category}
                </Badge>
              )}
              
              {/* Difficulty */}
              {task.difficulty && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-1.5 py-0.5 h-5",
                    task.difficulty === 'easy' && "bg-green-500/10 text-green-500 border-green-500/30",
                    task.difficulty === 'medium' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                    task.difficulty === 'hard' && "bg-red-500/10 text-red-500 border-red-500/30"
                  )}
                >
                  {task.difficulty}
                </Badge>
              )}
              
              {/* Priority */}
              {task.priority && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs px-1.5 py-0.5 h-5",
                    task.priority === 'high' && "bg-red-500/10 text-red-500 border-red-500/30",
                    task.priority === 'medium' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                    task.priority === 'low' && "bg-blue-500/10 text-blue-500 border-blue-500/30"
                  )}
                >
                  {task.priority} priority
                </Badge>
              )}
              
              {/* Energy level */}
              {task.energy_level && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                  <Zap className="w-3 h-3" />
                  {task.energy_level}
                </Badge>
              )}
              
              {/* Duration */}
              {task.estimated_duration && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                  <Timer className="w-3 h-3" />
                  {task.estimated_duration}m
                </Badge>
              )}
              
              {/* Recurrence */}
              {task.is_recurring && task.recurrence_pattern && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 bg-accent/10 text-accent border-accent/30">
                  <Repeat className="w-3 h-3" />
                  {task.recurrence_pattern}
                </Badge>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );

    // Wrap with SwipeableTaskItem for swipe gestures (only for non-completed, non-dragging tasks)
    if ((onDeleteQuest || onMoveQuestToNextDay) && !isComplete && !isDragging && !isActivated) {
      // Don't allow "move to next day" for rituals - they're recurring and already exist every day
      const isRitual = !!task.habit_source_id;
      
      return (
        <SwipeableTaskItem
          onSwipeDelete={() => onDeleteQuest?.(task.id)}
          onSwipeMoveToNextDay={!isRitual && onMoveQuestToNextDay ? () => onMoveQuestToNextDay(task.id) : undefined}
          disabled={isDragging || isActivated}
        >
          {taskContent}
        </SwipeableTaskItem>
      );
    }

    return taskContent;
  }, [onToggle, onUndoToggle, onEditQuest, onDeleteQuest, onMoveQuestToNextDay, expandedTasks, hasExpandableDetails, toggleTaskExpanded, justCompletedTasks, keepInPlace, optimisticCompleted, tasks]);


  return (
    <div className="relative">
      <div className="relative px-4 py-2 overflow-visible">
        {/* Compact Header: Date + Progress Ring + XP */}
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

          <div className="flex items-center gap-2">
            {/* Compact progress ring */}
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <ProgressRing percent={progressPercent} size={24} strokeWidth={2.5} />
                <span className="text-xs font-medium text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm">
              <Trophy className={cn(
                "h-4 w-4",
                allComplete ? "text-stardust-gold" : "text-stardust-gold/70"
              )} />
              <span className="font-semibold text-stardust-gold">{totalXP}</span>
            </div>
          </div>
        </div>

        {/* Timeline Content */}
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <Circle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No tasks for this day
            </p>
            <p className="text-xs text-muted-foreground/70">
              Tap <Plus className="w-3 h-3 inline" /> to add your first quest
            </p>
          </div>
        ) : (
          <div>
            {/* Sort dropdown */}
            <div className="flex items-center gap-2 mb-1">
              {tasks.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded opacity-40 hover:opacity-70 transition-opacity flex-shrink-0">
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
                    <DropdownMenuItem 
                      onClick={() => setSortBy('custom')}
                      className={cn("text-xs", sortBy === 'custom' && 'bg-accent/10')}
                    >
                      Custom
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSortBy('time')}
                      className={cn("text-xs", sortBy === 'time' && 'bg-accent/10')}
                    >
                      Time
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSortBy('priority')}
                      className={cn("text-xs", sortBy === 'priority' && 'bg-accent/10')}
                    >
                      Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setSortBy('xp')}
                      className={cn("text-xs", sortBy === 'xp' && 'bg-accent/10')}
                    >
                      XP
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Scheduled Tasks Timeline */}
            {scheduledItems.length > 0 && (
              <div>
                {scheduledItems.map((task, index) => (
                  <TimelineTaskRow
                    key={task.id}
                    time={task.scheduled_time}
                    showLine={index > 0}
                    isLast={index === scheduledItems.length - 1 && anytimeItems.length === 0}
                  >
                    {renderTaskItem(task)}
                  </TimelineTaskRow>
                ))}
              </div>
            )}

            {/* Anytime Divider + Unscheduled Tasks */}
            {anytimeItems.length > 0 && (
              <div>
                {/* Divider */}
                <div className="flex items-center gap-2 py-2 mt-1">
                  <div className="w-12 flex-shrink-0" />
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" />
                    Anytime
                  </div>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>

                {anytimeItems.map((task, index) => (
                  <TimelineTaskRow
                    key={task.id}
                    showLine={true}
                    isLast={index === anytimeItems.length - 1}
                  >
                    {renderTaskItem(task)}
                  </TimelineTaskRow>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Inbox section removed - now has its own tab */}

        {/* Campaign Headers (for epics with no rituals today, still show as strip) */}
        {activeEpics && activeEpics.length > 0 && ritualTasks.length === 0 && (
          <div className="mt-4 pt-3 border-t border-border/20 space-y-2">
            {activeEpics.map(epic => {
              const progress = Math.round(epic.progress_percentage ?? 0);
              const daysLeft = getDaysLeft(epic.end_date);
              return (
                <JourneyPathDrawer key={epic.id} epic={{
                  id: epic.id,
                  title: epic.title,
                  description: epic.description ?? undefined,
                  progress_percentage: epic.progress_percentage ?? 0,
                  target_days: epic.target_days,
                  start_date: epic.start_date,
                  end_date: epic.end_date,
                  epic_habits: epic.epic_habits,
                }}>
                  <button className="w-full text-left focus:outline-none">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/30 border border-border/30 bg-card/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[140px]">{epic.title}</span>
                        <span className="text-primary font-bold text-xs shrink-0">{progress}%</span>
                        {daysLeft !== null && (
                          <span className="text-muted-foreground text-xs shrink-0">· {daysLeft}d</span>
                        )}
                      </div>
                    </div>
                  </button>
                </JourneyPathDrawer>
              );
            })}
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

      <HourlyViewModal
        open={showMonthView}
        onOpenChange={setShowMonthView}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          if (onDateSelect) onDateSelect(date);
        }}
        tasks={calendarTasks}
        milestones={calendarMilestones}
        onTaskDrop={() => {}}
      />
    </div>
  );
});
