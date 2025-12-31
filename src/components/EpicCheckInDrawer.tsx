import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Star, CheckCircle2, Loader2, ChevronDown, Clock, Calendar, Target, Pencil, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { EditHabitDialog } from "@/components/EditHabitDialog";
import { format } from "date-fns";

interface Habit {
  id: string;
  title: string;
  description?: string | null;
  difficulty: string;
  frequency?: string;
  estimated_minutes?: number | null;
  custom_days?: number[] | null;
  preferred_time?: string | null;
}

const formatFrequency = (freq: string): string => {
  switch (freq) {
    case 'daily': return 'Daily';
    case '5x_week': return '5x per week';
    case '3x_week': return '3x per week';
    case 'custom': return 'Custom';
    default: return freq;
  }
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
}

export const EpicCheckInDrawer = ({ epicId, habits, isActive }: EpicCheckInDrawerProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingCompletions, setLoadingCompletions] = useState(false);
  const [processingHabits, setProcessingHabits] = useState<Set<string>>(new Set());
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [earlyBirdExpanded, setEarlyBirdExpanded] = useState(false);
  
  // Ref-based guard for rapid click prevention
  const processingRef = useRef(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  
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
  
  // Memoize habitIds to create a stable reference
  const habitIds = useMemo(() => habits.map(h => h.id), [habits]);

  const fetchTodayCompletions = useCallback(async () => {
    if (!user?.id || habitIds.length === 0) return;
    
    setLoadingCompletions(true);
    try {
      const { data } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', today)
        .in('habit_id', habitIds);
      
      if (data) {
        setCompletedToday(new Set(data.map(d => d.habit_id).filter(Boolean)));
      }
    } finally {
      setLoadingCompletions(false);
    }
  }, [user?.id, habitIds, today]);

  // Fetch today's completions when drawer opens
  useEffect(() => {
    if (open && user?.id) {
      fetchTodayCompletions();
    }
  }, [open, user?.id, fetchTodayCompletions]);

  const handleToggleHabit = async (habitId: string, checked: boolean) => {
    // Synchronous guard - prevents rapid double-taps
    if (processingRef.current) return;
    if (processingHabits.has(habitId)) return;
    if (!user?.id) return;
    
    processingRef.current = true;
    setProcessingHabits(prev => new Set([...prev, habitId]));
    
    // Optimistically update UI
    const previousState = new Set(completedToday);
    if (checked) {
      setCompletedToday(prev => new Set([...prev, habitId]));
    } else {
      setCompletedToday(prev => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
    
    setSubmitting(true);
    try {
      if (checked) {
        // Complete habit
        const { error } = await supabase
          .from('habit_completions')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            date: today,
          });
        
        if (error && error.code !== '23505') throw error; // Ignore duplicate errors
      } else {
        // Uncomplete habit
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('user_id', user.id)
          .eq('habit_id', habitId)
          .eq('date', today);
        
        if (error) throw error;
      }
      
      // Invalidate queries to refresh progress
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
    } catch (err) {
      // Rollback on error
      setCompletedToday(previousState);
      console.error('Error toggling habit:', err);
      toast.error('Failed to update habit');
    } finally {
      setSubmitting(false);
      processingRef.current = false;
      setProcessingHabits(prev => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  };

  const handleCompleteAll = async () => {
    if (!user?.id) return;
    
    // Only complete today's habits with "Complete All"
    const uncompleted = todayHabits.filter(h => !completedToday.has(h.id));
    if (uncompleted.length === 0) return;
    
    setSubmitting(true);
    try {
      const insertions = uncompleted.map(h => ({
        user_id: user.id,
        habit_id: h.id,
        date: today,
      }));
      
      const { error } = await supabase
        .from('habit_completions')
        .upsert(insertions, { onConflict: 'user_id,habit_id,date' });
      
      if (error) throw error;
      
      // Mark only today's habits as completed
      setCompletedToday(prev => new Set([...prev, ...todayHabits.map(h => h.id)]));
      setShowSuccess(true);
      
      // Show success animation then close
      setTimeout(() => {
        setShowSuccess(false);
        setOpen(false);
        toast.success("Star Path progress updated! ⭐", {
          description: "Keep going, you're doing great!"
        });
      }, 1500);
      
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
    } catch (err) {
      console.error('Error completing all habits:', err);
      toast.error('Failed to complete habits');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateHabit = async (habitId: string, updates: {
    title: string;
    description: string | null;
    frequency: string;
    estimated_minutes: number | null;
    difficulty: string;
    preferred_time: string | null;
  }) => {
    if (!user?.id) return;
    
    const { error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId)
      .eq('user_id', user.id);
    
    if (error) {
      toast.error('Failed to update habit');
      throw error;
    }
    
    toast.success('Habit updated!');
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['epics'] });
  };

  // Check completion based on today's habits only
  const allTodayCompleted = todayHabits.length > 0 && todayHabits.every(h => completedToday.has(h.id));
  const todayCompletionCount = todayHabits.filter(h => completedToday.has(h.id)).length;
  const totalTodayCount = todayHabits.length;
  const upcomingCompletionCount = upcomingHabits.filter(h => completedToday.has(h.id)).length;

  if (!isActive || habits.length === 0) return null;

  return (
    <Drawer 
      open={open} 
      onOpenChange={setOpen}
      shouldScaleBackground={false}
      handleOnly={true}
    >
      <DrawerTrigger asChild>
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
          
          {/* Sparkle icons */}
          <Sparkles className="w-4 h-4 mr-2 text-primary animate-pulse" />
          
          <span className="relative z-10 font-medium">
            {allTodayCompleted ? "Today's Rituals Complete ✨" : "Check In Today"}
          </span>
          
          {todayCompletionCount > 0 && !allTodayCompleted && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-celestial-blue/20 text-celestial-blue rounded-full">
              {todayCompletionCount}/{totalTodayCount}
            </span>
          )}
          
          {upcomingCompletionCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-500 rounded-full">
              +{upcomingCompletionCount} early
            </span>
          )}
          
          <Star className="w-4 h-4 ml-2 text-accent" />
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="bg-background border-t border-primary/20">
        <div className="mx-auto w-full max-w-lg p-6">
          <DrawerHeader className="px-0 pb-4">
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <Star className="w-5 h-5 text-stardust-gold fill-stardust-gold/30" />
              Today's Cosmiq habits
            </DrawerTitle>
          </DrawerHeader>
          
          <AnimatePresence mode="wait">
            {loadingCompletions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : showSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  animate={{ 
                    rotate: [0, 10, -10, 10, 0],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ duration: 0.6 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-stardust-gold" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-lg font-medium text-center"
                >
                  Rituals Complete! ⭐
                </motion.p>
              </motion.div>
            ) : (
              <>
                <div
                  className="space-y-3 overflow-y-auto overscroll-contain max-h-[60vh] -mx-2 px-2"
                  data-vaul-no-drag
                >
                  {/* Today's Habits */}
                  {todayHabits.map((habit) => {
                    const isCompleted = completedToday.has(habit.id);
                    const isProcessing = processingHabits.has(habit.id);
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
                            "bg-secondary/30 border border-border/50",
                            isCompleted && "bg-stardust-gold/10 border-stardust-gold/30",
                            isProcessing && "opacity-50 pointer-events-none"
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
                            <Checkbox
                              id={`habit-${habit.id}`}
                              checked={isCompleted}
                              disabled={submitting || isProcessing}
                              onCheckedChange={(checked) => {
                                handleToggleHabit(habit.id, Boolean(checked));
                              }}
                              className={cn(
                                "h-6 w-6 rounded-full border-2 touch-manipulation",
                                isCompleted ? "border-primary bg-primary" : "border-muted-foreground/30"
                              )}
                            />
                            <label
                              htmlFor={`habit-${habit.id}`}
                              className={cn(
                                "flex-1 text-sm font-medium cursor-pointer touch-manipulation select-none",
                                isCompleted && "line-through text-muted-foreground"
                              )}
                            >
                              {habit.title}
                            </label>
                            {habit.preferred_time && !isCompleted && (
                              <span className="text-xs text-celestial-blue/80 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {habit.preferred_time.slice(0, 5)}
                              </span>
                            )}
                            {isCompleted && (
                              <Sparkles className="w-4 h-4 text-stardust-gold" />
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
                                {habit.frequency && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Calendar className="w-3.5 h-3.5 text-celestial-blue" />
                                    <span>{formatFrequency(habit.frequency)}</span>
                                  </div>
                                )}
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
                                    setEditingHabit(habit);
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
                              Get ahead of the game!
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
                            These habits are scheduled for later, but feel free to knock them out early! ⚡
                          </p>
                          
                          {upcomingHabits.map((habit) => {
                            const isCompleted = completedToday.has(habit.id);
                            const isProcessing = processingHabits.has(habit.id);
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
                                    "bg-amber-500/5 border border-amber-500/20",
                                    isCompleted && "bg-stardust-gold/10 border-stardust-gold/30",
                                    isProcessing && "opacity-50 pointer-events-none"
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
                                    <Checkbox
                                      id={`habit-upcoming-${habit.id}`}
                                      checked={isCompleted}
                                      disabled={submitting || isProcessing}
                                      onCheckedChange={(checked) => {
                                        handleToggleHabit(habit.id, Boolean(checked));
                                      }}
                                      className={cn(
                                        "h-6 w-6 rounded-full border-2 touch-manipulation",
                                        isCompleted ? "border-amber-500 bg-amber-500" : "border-amber-500/30"
                                      )}
                                    />
                                    <label
                                      htmlFor={`habit-upcoming-${habit.id}`}
                                      className={cn(
                                        "flex-1 text-sm font-medium cursor-pointer touch-manipulation select-none",
                                        isCompleted && "line-through text-muted-foreground"
                                      )}
                                    >
                                      {habit.title}
                                    </label>
                                    {/* Day badge showing when scheduled */}
                                    {habit.custom_days && habit.custom_days.length > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        {getNextScheduledDay(habit.custom_days)}
                                      </span>
                                    )}
                                    {isCompleted && (
                                      <Sparkles className="w-4 h-4 text-amber-500" />
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
                                        {habit.frequency && (
                                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                            <span>{formatFrequency(habit.frequency)}</span>
                                          </div>
                                        )}
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
                                            setEditingHabit(habit);
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
                </div>
                  
                {/* Complete All Button - only for today's habits */}
                {todayHabits.length > 0 && !allTodayCompleted && (
                  <div className="pt-4">
                    <Button
                      onClick={handleCompleteAll}
                      disabled={submitting || allTodayCompleted}
                      className="w-full bg-gradient-to-r from-stardust-gold to-primary hover:from-stardust-gold/90 hover:to-primary/90 text-primary-foreground"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Complete All Rituals
                    </Button>
                  </div>
                )}
                
                {allTodayCompleted && todayHabits.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground pt-4">
                    ✨ You've completed all rituals for today!
                  </p>
                )}
                
                {todayHabits.length === 0 && upcomingHabits.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No habits scheduled for today. Check the Early Bird section to get ahead! ⚡
                  </p>
                )}
              </>
            )}
          </AnimatePresence>
        </div>
        
        <EditHabitDialog
          habit={editingHabit}
          open={!!editingHabit}
          onOpenChange={(open) => !open && setEditingHabit(null)}
          onSave={handleUpdateHabit}
        />
      </DrawerContent>
    </Drawer>
  );
};
