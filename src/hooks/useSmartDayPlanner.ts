import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';

export type EnergyLevel = 'low' | 'medium' | 'high';
export type DayShape = 'front_load' | 'spread' | 'back_load' | 'auto';
export type WizardStep = 'check_in' | 'anchors' | 'shape' | 'review';

export interface HardCommitment {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isImported?: boolean;
}

export interface HabitWithStreak {
  id: string;
  name: string;
  streak: number;
  preferredTime?: string;
  category?: string;
}

export interface UpcomingMilestone {
  id: string;
  title: string;
  epicTitle: string;
  epicId: string;
  dueDate?: string;
  milestonePercent: number;
}

export interface ExistingTask {
  id: string;
  title: string;
  scheduledTime?: string;
  isAnchor?: boolean;
  epicId?: string;
}

export interface GeneratedTask {
  title: string;
  scheduledTime: string;
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  blockType?: string;
  isAnchor?: boolean;
  epicId?: string;
  rationale?: string;
}

export interface GeneratedPlan {
  tasks: GeneratedTask[];
  insights: string[];
  totalHours: number;
  balanceScore: number;
  dayShape: DayShape;
}

export interface PlanContext {
  energyLevel: EnergyLevel;
  flexTimeHours: number;
  hardCommitments: HardCommitment[];
  protectedHabitIds: string[];
  prioritizedEpicIds: string[];
  dayShape: DayShape;
  adjustmentRequest?: string;
}

const DEFAULT_CONTEXT: PlanContext = {
  energyLevel: 'medium',
  flexTimeHours: 6,
  hardCommitments: [],
  protectedHabitIds: [],
  prioritizedEpicIds: [],
  dayShape: 'auto',
};

export function useSmartDayPlanner(planDate: Date = new Date()) {
  const { user } = useAuth();
  const { success, medium } = useHapticFeedback();
  
  const [step, setStep] = useState<WizardStep>('check_in');
  const [context, setContext] = useState<PlanContext>(DEFAULT_CONTEXT);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  
  // Auto-detected data
  const [habitsWithStreaks, setHabitsWithStreaks] = useState<HabitWithStreak[]>([]);
  const [upcomingMilestones, setUpcomingMilestones] = useState<UpcomingMilestone[]>([]);
  const [existingTasks, setExistingTasks] = useState<ExistingTask[]>([]);
  
  // Loading states
  const [isLoadingAnchors, setIsLoadingAnchors] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = format(planDate, 'yyyy-MM-dd');

  // Fetch habits with streaks (3+ days)
  const fetchHabitsWithStreaks = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('id, habit_name, streak, reminder_time, category')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gte('streak', 3)
        .order('streak', { ascending: false });

      if (habitsError) throw habitsError;

      setHabitsWithStreaks(
        (habits || []).map(h => ({
          id: h.id,
          name: h.habit_name,
          streak: h.streak || 0,
          preferredTime: h.reminder_time,
          category: h.category,
        }))
      );
    } catch (err) {
      console.error('Error fetching habits with streaks:', err);
    }
  }, [user?.id]);

  // Fetch upcoming epic milestones (due within 7 days)
  const fetchUpcomingMilestones = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: milestones, error: milestonesError } = await supabase
        .from('epic_milestones')
        .select(`
          id,
          title,
          target_date,
          milestone_percent,
          epic_id,
          epics!inner(id, title)
        `)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('target_date', { ascending: true })
        .limit(10);

      if (milestonesError) throw milestonesError;

      setUpcomingMilestones(
        (milestones || []).map((m: any) => ({
          id: m.id,
          title: m.title,
          epicTitle: m.epics?.title || 'Unknown Epic',
          epicId: m.epic_id,
          dueDate: m.target_date,
          milestonePercent: m.milestone_percent,
        }))
      );
    } catch (err) {
      console.error('Error fetching milestones:', err);
    }
  }, [user?.id]);

  // Fetch existing tasks for the day
  const fetchExistingTasks = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: tasks, error: tasksError } = await supabase
        .from('daily_tasks')
        .select('id, task_text, scheduled_time, is_anchor, epic_id')
        .eq('user_id', user.id)
        .eq('task_date', dateStr)
        .eq('completed', false)
        .order('scheduled_time', { ascending: true });

      if (tasksError) throw tasksError;

      setExistingTasks(
        (tasks || []).map(t => ({
          id: t.id,
          title: t.task_text,
          scheduledTime: t.scheduled_time,
          isAnchor: t.is_anchor,
          epicId: t.epic_id,
        }))
      );
    } catch (err) {
      console.error('Error fetching existing tasks:', err);
    }
  }, [user?.id, dateStr]);

  // Load all anchor data
  const loadAnchors = useCallback(async () => {
    setIsLoadingAnchors(true);
    try {
      await Promise.all([
        fetchHabitsWithStreaks(),
        fetchUpcomingMilestones(),
        fetchExistingTasks(),
      ]);
    } finally {
      setIsLoadingAnchors(false);
    }
  }, [fetchHabitsWithStreaks, fetchUpcomingMilestones, fetchExistingTasks]);

  // Load anchors when entering the anchors step
  useEffect(() => {
    if (step === 'anchors') {
      loadAnchors();
    }
  }, [step, loadAnchors]);

  const updateContext = useCallback((updates: Partial<PlanContext>) => {
    setContext(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    medium();
    const steps: WizardStep[] = ['check_in', 'anchors', 'shape', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  }, [step, medium]);

  const prevStep = useCallback(() => {
    medium();
    const steps: WizardStep[] = ['check_in', 'anchors', 'shape', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  }, [step, medium]);

  const generatePlan = useCallback(async (): Promise<GeneratedPlan | null> => {
    if (!user?.id) return null;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('generate-smart-daily-plan', {
        body: {
          planDate: dateStr,
          energyLevel: context.energyLevel,
          flexTimeHours: context.flexTimeHours,
          hardCommitments: context.hardCommitments,
          protectedHabitIds: context.protectedHabitIds,
          prioritizedEpicIds: context.prioritizedEpicIds,
          dayShape: context.dayShape,
        },
      });

      if (funcError) throw funcError;

      const plan: GeneratedPlan = {
        tasks: data.tasks || [],
        insights: data.insights || [],
        totalHours: data.totalHours || 0,
        balanceScore: data.balanceScore || 0,
        dayShape: data.dayShape || context.dayShape,
      };

      setGeneratedPlan(plan);
      success();
      return plan;
    } catch (err: any) {
      console.error('Error generating plan:', err);
      setError(err.message || 'Failed to generate plan');
      toast.error('Failed to generate your day plan');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [user?.id, dateStr, context, success]);

  const adjustPlan = useCallback(async (adjustmentRequest: string): Promise<GeneratedPlan | null> => {
    if (!user?.id || !generatedPlan) return null;
    
    setIsAdjusting(true);
    setError(null);
    
    try {
      const { data, error: funcError } = await supabase.functions.invoke('generate-smart-daily-plan', {
        body: {
          planDate: dateStr,
          energyLevel: context.energyLevel,
          flexTimeHours: context.flexTimeHours,
          hardCommitments: context.hardCommitments,
          protectedHabitIds: context.protectedHabitIds,
          prioritizedEpicIds: context.prioritizedEpicIds,
          dayShape: context.dayShape,
          adjustmentRequest,
          previousPlan: generatedPlan,
        },
      });

      if (funcError) throw funcError;

      const plan: GeneratedPlan = {
        tasks: data.tasks || [],
        insights: data.insights || [],
        totalHours: data.totalHours || 0,
        balanceScore: data.balanceScore || 0,
        dayShape: data.dayShape || context.dayShape,
      };

      setGeneratedPlan(plan);
      success();
      toast.success('Plan adjusted!');
      return plan;
    } catch (err: any) {
      console.error('Error adjusting plan:', err);
      setError(err.message || 'Failed to adjust plan');
      toast.error('Failed to adjust your plan');
      return null;
    } finally {
      setIsAdjusting(false);
    }
  }, [user?.id, dateStr, context, generatedPlan, success]);

  const savePlan = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !generatedPlan) return false;
    
    try {
      // Insert the generated tasks
      const tasksToInsert = generatedPlan.tasks.map(task => ({
        user_id: user.id,
        task_date: dateStr,
        task_text: task.title,
        scheduled_time: task.scheduledTime,
        estimated_duration: task.estimatedDuration,
        priority: task.priority,
        category: task.category,
        block_type: task.blockType,
        is_anchor: task.isAnchor || false,
        epic_id: task.epicId,
        ai_generated: true,
        source: 'smart_planner',
        xp_reward: task.priority === 'high' ? 30 : task.priority === 'medium' ? 20 : 10,
      }));

      const { error: insertError } = await supabase
        .from('daily_tasks')
        .insert(tasksToInsert);

      if (insertError) throw insertError;

      // Save the planning session
      await supabase.from('daily_plan_sessions').insert([{
        user_id: user.id,
        plan_date: dateStr,
        energy_level: context.energyLevel,
        flex_time_hours: context.flexTimeHours,
        protected_habits: context.protectedHabitIds as unknown as Record<string, unknown>,
        protected_epics: context.prioritizedEpicIds as unknown as Record<string, unknown>,
        day_shape: context.dayShape,
        generation_context: context as unknown as Record<string, unknown>,
        tasks_generated: generatedPlan.tasks.length,
      }]);

      success();
      toast.success('Day planned! May your quests be legendary ⚔️');
      return true;
    } catch (err: any) {
      console.error('Error saving plan:', err);
      toast.error('Failed to save your plan');
      return false;
    }
  }, [user?.id, dateStr, generatedPlan, context, success]);

  const reset = useCallback(() => {
    setStep('check_in');
    setContext(DEFAULT_CONTEXT);
    setGeneratedPlan(null);
    setError(null);
  }, []);

  return {
    // State
    step,
    context,
    generatedPlan,
    
    // Auto-detected data
    habitsWithStreaks,
    upcomingMilestones,
    existingTasks,
    
    // Actions
    setStep,
    updateContext,
    nextStep,
    prevStep,
    generatePlan,
    adjustPlan,
    savePlan,
    reset,
    loadAnchors,
    
    // State flags
    isLoadingAnchors,
    isGenerating,
    isAdjusting,
    error,
    
    // Computed
    planDate,
    dateStr,
  };
}
