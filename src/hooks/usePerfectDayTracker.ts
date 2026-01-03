import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { format } from "date-fns";
import { safeLocalStorage } from "@/utils/storage";

interface PerfectDayState {
  showPerfectDay: boolean;
  totalXP: number;
  tasksCompleted: number;
}

interface Task {
  id: string;
  completed: boolean;
  xp_reward: number;
  task_date: string;
  scheduled_time?: string | null;
}

export function usePerfectDayTracker(
  tasks: Task[],
  selectedDate: Date
) {
  const [state, setState] = useState<PerfectDayState>({
    showPerfectDay: false,
    totalXP: 0,
    tasksCompleted: 0,
  });
  
  // Track if we have a pending perfect day celebration waiting for evolution to finish
  const pendingPerfectDayRef = useRef<{ totalXP: number; completedCount: number } | null>(null);

  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const storageKey = `perfect_day_shown_${dateKey}`;

  // Calculate if all tasks are complete
  const { allComplete, totalXP, completedCount, totalCount } = useMemo(() => {
    const todaysTasks = tasks.filter(t => t.task_date === dateKey);
    const completed = todaysTasks.filter(t => t.completed);
    const total = todaysTasks.length;
    const xp = completed.reduce((sum, t) => sum + (t.xp_reward || 0), 0);
    
    return {
      allComplete: total > 0 && completed.length === total,
      totalXP: xp,
      completedCount: completed.length,
      totalCount: total,
    };
  }, [tasks, dateKey]);

  // Listen for evolution completion to show deferred perfect day
  useEffect(() => {
    const handleEvolutionComplete = () => {
      // Check if we have a pending perfect day celebration
      if (pendingPerfectDayRef.current) {
        const { totalXP, completedCount } = pendingPerfectDayRef.current;
        pendingPerfectDayRef.current = null;
        
        // Small delay to let evolution modal fully close
        setTimeout(() => {
          setState({
            showPerfectDay: true,
            totalXP,
            tasksCompleted: completedCount,
          });
        }, 500);
      }
    };

    window.addEventListener('evolution-modal-closed', handleEvolutionComplete);
    return () => window.removeEventListener('evolution-modal-closed', handleEvolutionComplete);
  }, []);

  // Check if Perfect Day should trigger
  useEffect(() => {
    // Need at least 1 task to qualify
    if (totalCount === 0) return;
    
    // Check if already shown today
    const alreadyShown = safeLocalStorage.getItem(storageKey) === "true";
    if (alreadyShown) return;

    // Trigger if all complete
    if (allComplete) {
      // Check if evolution is currently in progress (check for existing modal)
      const evolutionModalActive = document.querySelector('[aria-labelledby="evolution-title"]');
      
      if (evolutionModalActive) {
        // Defer the perfect day celebration until evolution completes
        pendingPerfectDayRef.current = { totalXP, completedCount };
        // Mark as shown so we don't trigger again
        safeLocalStorage.setItem(storageKey, "true");
      } else {
        // No evolution in progress, show immediately
        setState({
          showPerfectDay: true,
          totalXP,
          tasksCompleted: completedCount,
        });
        
        // Mark as shown
        safeLocalStorage.setItem(storageKey, "true");
      }
    }
  }, [allComplete, totalXP, completedCount, totalCount, storageKey]);

  const dismissPerfectDay = useCallback(() => {
    setState(prev => ({ ...prev, showPerfectDay: false }));
  }, []);

  // Check if eligible (but not yet triggered)
  const isPerfectDayEligible = allComplete && totalCount > 0;

  return {
    showPerfectDay: state.showPerfectDay,
    totalXP: state.totalXP,
    tasksCompleted: state.tasksCompleted,
    dismissPerfectDay,
    isPerfectDayEligible,
  };
}
