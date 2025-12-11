import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Star, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getHabitCompletions } from "@/lib/firebase/habitCompletions";
import { setDocument, deleteDocument } from "@/lib/firebase/firestore";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface Habit {
  id: string;
  title: string;
  difficulty: string;
}

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

  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Memoize habitIds to create a stable reference
  const habitIds = useMemo(() => habits.map(h => h.id), [habits]);

  const fetchTodayCompletions = useCallback(async () => {
    if (!user?.uid || habitIds.length === 0) return;
    
    setLoadingCompletions(true);
    try {
      const completions = await getHabitCompletions(user.uid, today, today);
      const todayCompletions = completions.filter(c => habitIds.includes(c.habit_id));
      setCompletedToday(new Set(todayCompletions.map(c => c.habit_id).filter(Boolean)));
    } finally {
      setLoadingCompletions(false);
    }
  }, [user?.uid, habitIds, today]);

  // Fetch today's completions when drawer opens
  useEffect(() => {
    if (open && user?.uid) {
      fetchTodayCompletions();
    }
  }, [open, user?.uid, fetchTodayCompletions]);

  const handleToggleHabit = async (habitId: string, checked: boolean) => {
    console.log('[EpicCheckIn] handleToggleHabit called', { habitId, checked, userId: user?.uid });
    if (!user?.uid) {
      console.log('[EpicCheckIn] No user ID, returning early');
      return;
    }
    
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
        const completionId = `${user.uid}_${habitId}_${today}`;
        try {
          await setDocument('habit_completions', completionId, {
            user_id: user.uid,
            habit_id: habitId,
            date: today,
            completed_at: new Date().toISOString(),
          }, false);
        } catch (error: any) {
          // Ignore duplicate errors (document already exists)
          if (!error.message?.includes('already exists')) {
            throw error;
          }
        }
      } else {
        // Uncomplete habit - find and delete the completion
        const completions = await getHabitCompletions(user.uid, today, today);
        const completion = completions.find(c => c.habit_id === habitId && c.date === today);
        if (completion?.id) {
          await deleteDocument('habit_completions', completion.id);
        }
      }
      
      // Invalidate queries to refresh progress
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    } catch (err) {
      // Rollback on error
      setCompletedToday(previousState);
      console.error('Error toggling habit:', err);
      toast.error('Failed to update habit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAll = async () => {
    if (!user?.uid) return;
    
    const uncompleted = habits.filter(h => !completedToday.has(h.id));
    if (uncompleted.length === 0) return;
    
    setSubmitting(true);
    try {
      // Create all completions
      for (const habit of uncompleted) {
        const completionId = `${user.uid}_${habit.id}_${today}`;
        try {
          await setDocument('habit_completions', completionId, {
            user_id: user.uid,
            habit_id: habit.id,
            date: today,
            completed_at: new Date().toISOString(),
          }, false);
        } catch (error: any) {
          // Ignore duplicate errors
          if (!error.message?.includes('already exists')) {
            throw error;
          }
        }
      }
      
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
    } catch (err) {
      console.error('Error completing all habits:', err);
      toast.error('Failed to complete habits');
    } finally {
      setSubmitting(false);
    }
  };

  const allCompleted = habits.length > 0 && habits.every(h => completedToday.has(h.id));
  const completionCount = completedToday.size;

  if (!isActive || habits.length === 0) return null;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
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
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 rounded-full">
              {completionCount}/{habits.length}
            </span>
          )}
          
          <Star className="w-4 h-4 ml-2 text-accent" />
        </Button>
      </DrawerTrigger>
      
      <DrawerContent className="bg-background/95 backdrop-blur-lg border-t border-primary/20">
        <div className="mx-auto w-full max-w-lg p-6">
          <DrawerHeader className="px-0 pb-4">
            <DrawerTitle className="flex items-center gap-2 text-xl">
              <Star className="w-5 h-5 text-primary fill-primary/30" />
              Today's Cosmic Rituals
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
                  <CheckCircle2 className="w-20 h-20 text-green-500" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-lg font-medium text-center"
                >
                  Rituals Complete! ⭐
                </motion.p>
                {/* Star burst animation */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-primary rounded-full"
                    initial={{ opacity: 1, scale: 0 }}
                    animate={{
                      opacity: [1, 0],
                      scale: [0, 1],
                      x: [0, Math.cos(i * 45 * Math.PI / 180) * 60],
                      y: [0, Math.sin(i * 45 * Math.PI / 180) * 60],
                    }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {habits.map((habit, index) => {
                  const isCompleted = completedToday.has(habit.id);
                  return (
                    <motion.div
                      key={habit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => {
                        console.log('[EpicCheckIn] Row clicked', { habitId: habit.id, isCompleted, submitting });
                        if (!submitting) {
                          handleToggleHabit(habit.id, !isCompleted);
                        }
                      }}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl transition-all cursor-pointer",
                        "bg-secondary/30 border border-border/50",
                        isCompleted && "bg-primary/10 border-primary/30"
                      )}
                    >
                      <Checkbox
                        id={habit.id}
                        checked={isCompleted}
                        disabled={submitting}
                        onCheckedChange={(checked) => handleToggleHabit(habit.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "h-6 w-6 rounded-full border-2",
                          isCompleted ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}
                        style={{ touchAction: 'manipulation' }}
                      />
                      <label
                        htmlFor={habit.id}
                        className={cn(
                          "flex-1 text-sm font-medium cursor-pointer transition-all",
                          isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {habit.title}
                      </label>
                      {isCompleted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-primary"
                        >
                          <Sparkles className="w-4 h-4" />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
                
                {/* Complete All Button */}
                {!allCompleted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: habits.length * 0.1 }}
                    className="pt-4"
                  >
                    <Button
                      onClick={handleCompleteAll}
                      disabled={submitting || allCompleted}
                      className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Complete All Rituals
                    </Button>
                  </motion.div>
                )}
                
                {allCompleted && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-sm text-muted-foreground pt-4"
                  >
                    ✨ You've completed all rituals for today!
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
