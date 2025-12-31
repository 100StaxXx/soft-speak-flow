import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Star, CheckCircle2, Loader2, ChevronDown, Clock, Calendar, Target, Pencil } from "lucide-react";
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
  
  // Ref-based guard for rapid click prevention
  const processingRef = useRef(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  
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
    
    const uncompleted = habits.filter(h => !completedToday.has(h.id));
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
      
      setCompletedToday(new Set(habits.map(h => h.id)));
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

  const allCompleted = habits.length > 0 && habits.every(h => completedToday.has(h.id));
  const completionCount = completedToday.size;

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
            {allCompleted ? "Today's Rituals Complete ✨" : "Check In Today"}
          </span>
          
          {completionCount > 0 && !allCompleted && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-celestial-blue/20 text-celestial-blue rounded-full">
              {completionCount}/{habits.length}
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
                  {habits.map((habit, index) => {
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
                </div>
                  
                {/* Complete All Button */}
                {!allCompleted && (
                  <div className="pt-4">
                    <Button
                      onClick={handleCompleteAll}
                      disabled={submitting || allCompleted}
                      className="w-full bg-gradient-to-r from-stardust-gold to-primary hover:from-stardust-gold/90 hover:to-primary/90 text-primary-foreground"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Complete All Rituals
                    </Button>
                  </div>
                )}
                
                {allCompleted && (
                  <p className="text-center text-sm text-muted-foreground pt-4">
                    ✨ You've completed all rituals for today!
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
