import { memo, useState, useMemo, useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Star, ChevronDown, Clock, Calendar, Target, Pencil, Zap, BookOpen, Settings2, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { playStrikethrough } from "@/utils/soundEffects";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useTaskMutations } from "@/hooks/useTaskMutations";
interface Habit {
  id: string;
  title: string;
  description?: string | null;
  difficulty: string;
  frequency?: string;
  estimated_minutes?: number | null;
  custom_days?: number[] | null;
  preferred_time?: string | null;
  category?: 'mind' | 'body' | 'soul' | null;
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Format days for display - show day chips or readable text
const formatDaysDisplay = (frequency: string | undefined, days: number[] | null | undefined): { type: 'text' | 'chips', value: string | number[] } => {
  if (frequency === 'daily' || !days || days.length === 0 || days.length === 7) {
    return { type: 'text', value: 'Daily' };
  }
  // Check for weekdays
  if (days.length === 5 && [0,1,2,3,4].every(d => days.includes(d))) {
    return { type: 'text', value: 'Weekdays' };
  }
  // Show chips for custom days
  return { type: 'chips', value: days };
};

// Check if a habit is scheduled for today based on frequency and custom_days
const isScheduledForToday = (habit: Habit): boolean => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // Convert JS day (0=Sunday) to our system (0=Monday)
  const ourDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Daily habits are always scheduled
  if (habit.frequency === 'daily' || !habit.custom_days || habit.custom_days.length === 0) {
    return true;
  }
  
  // Custom frequency - check if today is in custom_days
  return habit.custom_days.includes(ourDayIndex);
};

// Get next scheduled day name for upcoming habits
const getNextScheduledDay = (days: number[]): string => {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
  
  // Find the next day after today
  const nextDay = days.find(d => d > currentDay) ?? days[0];
  return dayNames[nextDay];
};

interface EpicCheckInDrawerProps {
  epicId: string;
  habits: Habit[];
  isActive: boolean;
  onAdjustPlan?: () => void;
  showAdjustPlan?: boolean;
  renderTrigger?: (todayCount: number) => React.ReactNode;
}

export const EpicCheckInDrawer = memo(function EpicCheckInDrawer({ epicId, habits, isActive, onAdjustPlan, showAdjustPlan, renderTrigger }: EpicCheckInDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [editingRitual, setEditingRitual] = useState<RitualData | null>(null);
  const [earlyBirdExpanded, setEarlyBirdExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add new ritual state
  const [isAddingRitual, setIsAddingRitual] = useState(false);
  const [newRitualTitle, setNewRitualTitle] = useState("");
  const [newRitualDifficulty, setNewRitualDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newRitualDays, setNewRitualDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // Default to daily
  const [isAddingLoading, setIsAddingLoading] = useState(false);
  
  // Toggle state and refs for iOS-optimized touch handling
  const [togglingHabitId, setTogglingHabitId] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Get habit surfacing data and mutations for syncing with Quests tab
  const taskDate = format(new Date(), 'yyyy-MM-dd');
  const { surfacedHabits, surfaceHabit } = useHabitSurfacing();
  const { toggleTask } = useTaskMutations(taskDate);
  
  // Map habit IDs to their task completion state
  const habitTaskMap = useMemo(() => {
    const map = new Map<string, { task_id: string | null; is_completed: boolean }>();
    surfacedHabits.forEach(sh => {
      map.set(sh.habit_id, { task_id: sh.task_id, is_completed: sh.is_completed });
    });
    return map;
  }, [surfacedHabits]);
  
  // Haptic feedback helper
  const triggerHaptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Haptics not available on web
    }
  };
  
  // Handle toggling ritual completion with haptics and sound
  const handleToggleRitual = async (habitId: string, taskId: string | null, isCompleted: boolean) => {
    if (isCompleted || togglingHabitId) return;
    
    setTogglingHabitId(habitId);
    triggerHaptic(ImpactStyle.Medium);
    playStrikethrough();
    
    try {
      // Surface the habit as a task if not already done
      if (!taskId) {
        surfaceHabit(habitId);
        // The surfaceHabit will create the task and invalidate queries
        // The UI will update via realtime sync
        return;
      }
      
      // Toggle the task to completed - toggleTask is already the mutate function
      toggleTask({ 
        taskId, 
        completed: true, 
        xpReward: 25 
      });
    } finally {
      setTimeout(() => setTogglingHabitId(null), 300);
    }
  };
  
  // Convert habit to RitualData for the unified editor
  const handleEditHabit = (habit: Habit) => {
    setEditingRitual({
      habitId: habit.id,
      title: habit.title,
      description: habit.description,
      difficulty: habit.difficulty,
      frequency: habit.frequency,
      estimated_minutes: habit.estimated_minutes,
      preferred_time: habit.preferred_time,
      category: habit.category,
      custom_days: habit.custom_days,
    });
  };

  const handleDeleteRitual = async (habitId: string) => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      // Delete the habit template
      const { error: habitError } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);
      
      if (habitError) throw habitError;

      // Delete all incomplete tasks linked to this habit
      const { error: tasksError } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('habit_source_id', habitId)
        .eq('user_id', user.id)
        .eq('completed', false);

      if (tasksError) {
        console.error('Error deleting linked tasks:', tasksError);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      
      toast.success('Ritual deleted');
    } catch (error) {
      console.error('Error deleting ritual:', error);
      toast.error('Failed to delete ritual');
    } finally {
      setIsDeleting(false);
    }
    setEditingRitual(null);
  };

  const handleAddRitual = async () => {
    if (!user?.id || !newRitualTitle.trim()) return;
    
    setIsAddingLoading(true);
    try {
      // Determine frequency based on days selected
      const frequency = newRitualDays.length === 7 ? 'daily' : 'custom';
      
      // Insert new habit (epic_id is linked via junction table, not directly)
      const { data: newHabit, error } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          title: newRitualTitle.trim(),
          difficulty: newRitualDifficulty,
          frequency,
          custom_days: newRitualDays,
          is_active: true,
        })
        .select('id')
        .single();
      
      if (error) throw error;

      // Also link via epic_habits junction table
      if (newHabit?.id) {
        await supabase.from('epic_habits').insert({
          epic_id: epicId,
          habit_id: newHabit.id,
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      
      toast.success('Ritual added to campaign!');
      setNewRitualTitle("");
      setNewRitualDifficulty('medium');
      setNewRitualDays([0, 1, 2, 3, 4, 5, 6]); // Reset to daily
      setIsAddingRitual(false);
    } catch (error) {
      console.error('Error adding ritual:', error);
      toast.error('Failed to add ritual');
    } finally {
      setIsAddingLoading(false);
    }
  };
  
  // Split habits into today's and upcoming
  const { todayHabits, upcomingHabits } = useMemo(() => {
    const todayList: Habit[] = [];
    const upcomingList: Habit[] = [];
    
    habits.forEach(habit => {
      if (isScheduledForToday(habit)) {
        todayList.push(habit);
      } else {
        upcomingList.push(habit);
      }
    });
    
    return { todayHabits: todayList, upcomingHabits: upcomingList };
  }, [habits]);

  if (!isActive || habits.length === 0) return null;

  return (
    <Drawer 
      open={open} 
      onOpenChange={setOpen}
      shouldScaleBackground={false}
      handleOnly={true}
    >
      <DrawerTrigger asChild>
        {renderTrigger ? (
          renderTrigger(todayHabits.length)
        ) : (
          <Button
            variant="outline"
            className={cn(
              "w-full relative overflow-hidden group",
              "bg-gradient-to-r from-primary/10 to-accent/10",
              "border-primary/30 hover:border-primary/60",
              "transition-all duration-300"
            )}
          >
            {/* Glowing effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity" />
            
            {/* Icon */}
            <BookOpen className="w-4 h-4 mr-2 text-primary" />
            
            <span className="relative z-10 font-medium">
              Rituals
            </span>
            
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
              {todayHabits.length} today
            </span>
            
            <Star className="w-4 h-4 ml-2 text-accent" />
          </Button>
        )}
      </DrawerTrigger>
      
      <DrawerContent className="bg-background border-t border-primary/20">
        <div className="mx-auto w-full max-w-lg p-6">
          <DrawerHeader className="px-0 pb-4">
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <Star className="w-5 h-5 text-stardust-gold fill-stardust-gold/30" />
              Today's Cosmiq Habits
            </DrawerTitle>
          </DrawerHeader>
          
          <div
            className="space-y-3 overflow-y-auto overscroll-contain max-h-[60vh] -mx-2 px-2"
            data-vaul-no-drag
          >
            {/* Today's Habits */}
            {todayHabits.map((habit) => {
              const isExpanded = expandedHabit === habit.id;
              const hasDetails = habit.description || habit.frequency || habit.estimated_minutes || habit.preferred_time;
              
              return (
                <Collapsible
                  key={habit.id}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedHabit(open ? habit.id : null)}
                >
                  <div
                    className={cn(
                      "rounded-xl transition-colors overflow-hidden",
                      "bg-secondary/30 border border-border/50"
                    )}
                  >
                    {/* Main habit row */}
                    <div
                      className="flex items-center gap-3 p-4 min-h-[60px]"
                      style={{ 
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {/* iOS-optimized clickable toggle */}
                      {(() => {
                        const habitState = habitTaskMap.get(habit.id);
                        const isCompleted = habitState?.is_completed || false;
                        const isTogglingThis = togglingHabitId === habit.id;
                        
                        return (
                          <button
                            data-interactive="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCompleted && !isTogglingThis) {
                                handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
                              }
                            }}
                            onTouchStart={(e) => {
                              touchStartRef.current = { 
                                x: e.touches[0].clientX, 
                                y: e.touches[0].clientY 
                              };
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (touchStartRef.current && !isCompleted && !isTogglingThis) {
                                const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
                                const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
                                if (dx < 5 && dy < 5) {
                                  handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
                                }
                              }
                              touchStartRef.current = null;
                            }}
                            disabled={isCompleted}
                            className={cn(
                              "relative flex items-center justify-center w-11 h-11 -ml-2.5 touch-manipulation transition-transform select-none",
                              !isCompleted && "active:scale-95"
                            )}
                            style={{
                              WebkitTapHighlightColor: 'transparent',
                              touchAction: 'manipulation',
                            }}
                            aria-label={isCompleted ? "Ritual completed" : "Mark ritual as complete"}
                            role="checkbox"
                            aria-checked={isCompleted}
                            tabIndex={0}
                          >
                            <motion.div 
                              className={cn(
                                "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                isCompleted 
                                  ? "bg-green-500 border-green-500" 
                                  : "border-primary/30 hover:border-primary/60",
                                isTogglingThis && "animate-pulse border-primary"
                              )}
                              whileTap={!isCompleted ? { scale: 0.85 } : {}}
                            >
                              {isCompleted ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <Check className="w-4 h-4 text-white" />
                                </motion.div>
                              ) : isTogglingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-primary/50" />
                              )}
                            </motion.div>
                          </button>
                        );
                      })()}
                      <span className={cn(
                        "flex-1 text-sm font-medium transition-all",
                        habitTaskMap.get(habit.id)?.is_completed && "line-through text-muted-foreground"
                      )}>
                        {habit.title}
                      </span>
                      {habit.preferred_time && (
                        <span className="text-xs text-celestial-blue/80 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {habit.preferred_time.slice(0, 5)}
                        </span>
                      )}
                      {hasDetails && (
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "h-10 w-10 -mr-2 flex items-center justify-center rounded-lg",
                              "active:bg-primary/20 transition-colors",
                              "touch-manipulation",
                              "relative z-10"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <ChevronDown 
                              className={cn(
                                "h-5 w-5 text-muted-foreground transition-transform duration-200",
                                isExpanded && "rotate-180"
                              )} 
                            />
                          </button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                    
                    {/* Expandable details section */}
                    <CollapsibleContent>
                      <div 
                        className="px-4 pb-4 pt-0 space-y-2 border-t border-border/30"
                        data-vaul-no-drag
                      >
                        {habit.description && (
                          <p className="text-sm text-celestial-blue/80 pt-3">
                            {habit.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          {/* Day schedule display */}
                          {(() => {
                            const daysDisplay = formatDaysDisplay(habit.frequency, habit.custom_days);
                            return (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5 text-celestial-blue" />
                                {daysDisplay.type === 'text' ? (
                                  <span>{daysDisplay.value}</span>
                                ) : (
                                  <div className="flex gap-0.5">
                                    {DAYS.map((day, dayIndex) => (
                                      <span
                                        key={dayIndex}
                                        className={cn(
                                          "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                                          (daysDisplay.value as number[]).includes(dayIndex)
                                            ? "bg-celestial-blue/80 text-white"
                                            : "bg-muted/30 text-muted-foreground/40"
                                        )}
                                      >
                                        {day}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {habit.estimated_minutes && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5 text-celestial-blue" />
                              <span>~{habit.estimated_minutes} min</span>
                            </div>
                          )}
                          {habit.difficulty && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Target className="w-3.5 h-3.5 text-celestial-blue" />
                              <span className="capitalize">{habit.difficulty}</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 ml-auto text-xs text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditHabit(habit);
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {/* Early Bird Mode - Upcoming Habits */}
            {upcomingHabits.length > 0 && (
              <Collapsible 
                open={earlyBirdExpanded} 
                onOpenChange={setEarlyBirdExpanded}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-200">
                        Early Bird Mode
                      </span>
                      <span className="text-xs text-amber-500/70">
                        Preview upcoming
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {upcomingHabits.length} upcoming
                      </span>
                      <ChevronDown className={cn(
                        "w-4 h-4 text-amber-500 transition-transform",
                        earlyBirdExpanded && "rotate-180"
                      )} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="mt-3 space-y-2 pl-2 border-l-2 border-amber-500/20">
                    <p className="text-xs text-amber-500/80 italic px-2 pb-2">
                      These habits are scheduled for later this week
                    </p>
                    
                    {upcomingHabits.map((habit) => {
                      const isExpanded = expandedHabit === habit.id;
                      const hasDetails = habit.description || habit.frequency || habit.estimated_minutes;
                      
                      return (
                        <Collapsible
                          key={habit.id}
                          open={isExpanded}
                          onOpenChange={(open) => setExpandedHabit(open ? habit.id : null)}
                        >
                          <div
                            className={cn(
                              "rounded-xl transition-colors overflow-hidden",
                              "bg-amber-500/5 border border-amber-500/20"
                            )}
                          >
                            {/* Main habit row */}
                            <div
                              className="flex items-center gap-3 p-4 min-h-[60px]"
                              style={{ 
                                touchAction: 'manipulation',
                                WebkitTapHighlightColor: 'transparent',
                              }}
                            >
                              {/* iOS-optimized clickable toggle for upcoming habits */}
                              {(() => {
                                const habitState = habitTaskMap.get(habit.id);
                                const isCompleted = habitState?.is_completed || false;
                                const isTogglingThis = togglingHabitId === habit.id;
                                
                                return (
                                  <button
                                    data-interactive="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isCompleted && !isTogglingThis) {
                                        handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
                                      }
                                    }}
                                    onTouchStart={(e) => {
                                      touchStartRef.current = { 
                                        x: e.touches[0].clientX, 
                                        y: e.touches[0].clientY 
                                      };
                                    }}
                                    onTouchEnd={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (touchStartRef.current && !isCompleted && !isTogglingThis) {
                                        const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
                                        const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
                                        if (dx < 5 && dy < 5) {
                                          handleToggleRitual(habit.id, habitState?.task_id || null, isCompleted);
                                        }
                                      }
                                      touchStartRef.current = null;
                                    }}
                                    disabled={isCompleted}
                                    className={cn(
                                      "relative flex items-center justify-center w-11 h-11 -ml-2.5 touch-manipulation transition-transform select-none",
                                      !isCompleted && "active:scale-95"
                                    )}
                                    style={{
                                      WebkitTapHighlightColor: 'transparent',
                                      touchAction: 'manipulation',
                                    }}
                                    aria-label={isCompleted ? "Ritual completed" : "Mark ritual as complete"}
                                    role="checkbox"
                                    aria-checked={isCompleted}
                                    tabIndex={0}
                                  >
                                    <motion.div 
                                      className={cn(
                                        "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                        isCompleted 
                                          ? "bg-green-500 border-green-500" 
                                          : "border-amber-500/30 hover:border-amber-500/60",
                                        isTogglingThis && "animate-pulse border-amber-500"
                                      )}
                                      whileTap={!isCompleted ? { scale: 0.85 } : {}}
                                    >
                                      {isCompleted ? (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                        >
                                          <Check className="w-4 h-4 text-white" />
                                        </motion.div>
                                      ) : isTogglingThis ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                      ) : (
                                        <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                                      )}
                                    </motion.div>
                                  </button>
                                );
                              })()}
                              <span className={cn(
                                "flex-1 text-sm font-medium transition-all",
                                habitTaskMap.get(habit.id)?.is_completed && "line-through text-muted-foreground"
                              )}>
                                {habit.title}
                              </span>
                              {/* Day badge showing when scheduled */}
                              {habit.custom_days && habit.custom_days.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  {getNextScheduledDay(habit.custom_days)}
                                </span>
                              )}
                              {hasDetails && (
                                <CollapsibleTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "h-10 w-10 -mr-2 flex items-center justify-center rounded-lg",
                                      "active:bg-amber-500/20 transition-colors",
                                      "touch-manipulation",
                                      "relative z-10"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    onTouchEnd={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <ChevronDown 
                                      className={cn(
                                        "h-5 w-5 text-amber-500/70 transition-transform duration-200",
                                        isExpanded && "rotate-180"
                                      )} 
                                    />
                                  </button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                            
                            {/* Expandable details section */}
                            <CollapsibleContent>
                              <div 
                                className="px-4 pb-4 pt-0 space-y-2 border-t border-amber-500/20"
                                data-vaul-no-drag
                              >
                                {habit.description && (
                                  <p className="text-sm text-amber-500/70 pt-3">
                                    {habit.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                  {/* Day schedule display for upcoming */}
                                  {(() => {
                                    const daysDisplay = formatDaysDisplay(habit.frequency, habit.custom_days);
                                    return (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                        {daysDisplay.type === 'text' ? (
                                          <span>{daysDisplay.value}</span>
                                        ) : (
                                          <div className="flex gap-0.5">
                                            {DAYS.map((day, dayIndex) => (
                                              <span
                                                key={dayIndex}
                                                className={cn(
                                                  "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                                                  (daysDisplay.value as number[]).includes(dayIndex)
                                                    ? "bg-amber-500/80 text-white"
                                                    : "bg-muted/30 text-muted-foreground/40"
                                                )}
                                              >
                                                {day}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {habit.estimated_minutes && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                                      <span>~{habit.estimated_minutes} min</span>
                                    </div>
                                  )}
                                  {habit.difficulty && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Target className="w-3.5 h-3.5 text-amber-500" />
                                      <span className="capitalize">{habit.difficulty}</span>
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 ml-auto text-xs text-amber-500/70 hover:text-amber-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditHabit(habit);
                                    }}
                                  >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Add New Ritual Section */}
            <div className="mt-4 pt-4 border-t border-border/30">
              {isAddingRitual ? (
                <div className="space-y-3 p-3 rounded-xl bg-secondary/30 border border-primary/20" data-vaul-no-drag>
                  <Input
                    value={newRitualTitle}
                    onChange={(e) => setNewRitualTitle(e.target.value)}
                    placeholder="New ritual name..."
                    autoFocus
                    className="bg-background/50"
                  />
                  <HabitDifficultySelector
                    value={newRitualDifficulty}
                    onChange={setNewRitualDifficulty}
                  />
                  <FrequencyPicker
                    selectedDays={newRitualDays}
                    onDaysChange={setNewRitualDays}
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleAddRitual} 
                      disabled={!newRitualTitle.trim() || isAddingLoading}
                      className="flex-1"
                    >
                      {isAddingLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" /> Add Ritual
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setIsAddingRitual(false);
                        setNewRitualTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsAddingRitual(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add New Ritual
                </Button>
              )}
            </div>
          </div>
          {/* Adjust Plan Button */}
          {showAdjustPlan && onAdjustPlan && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                onAdjustPlan();
              }}
              className="w-full mt-4"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Adjust My Plan
            </Button>
          )}
          
          {/* Guidance note */}
          <p className="text-center text-xs text-muted-foreground pt-4 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Tap circles to complete rituals
          </p>
          
          {todayHabits.length === 0 && upcomingHabits.length > 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No habits scheduled for today. Check the Early Bird section to preview upcoming habits!
            </p>
          )}
        </div>
        
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(open) => !open && setEditingRitual(null)}
          onDelete={handleDeleteRitual}
          isDeleting={isDeleting}
        />
      </DrawerContent>
    </Drawer>
  );
});
