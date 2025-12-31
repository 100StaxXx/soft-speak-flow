import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailyInsight {
  type: 'optimization' | 'warning' | 'encouragement' | 'suggestion';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'reschedule' | 'add_break' | 'simplify' | 'celebrate';
  relatedTaskIds?: string[];
}

interface SuggestedScheduleItem {
  taskId: string;
  suggestedTime: string;
  reason: string;
}

interface DailyPlanOptimization {
  insights: DailyInsight[];
  suggestedSchedule?: SuggestedScheduleItem[];
  energyForecast: {
    morning: 'low' | 'medium' | 'high';
    afternoon: 'low' | 'medium' | 'high';
    evening: 'low' | 'medium' | 'high';
  };
  overallReadiness: number; // 0-100
}

interface Task {
  id: string;
  task_text: string;
  completed: boolean;
  scheduled_time: string | null;
  estimated_duration: number | null;
  difficulty: string | null;
  energy_level: string | null;
  is_top_three: boolean | null;
  category: string | null;
}

// Score a time slot for a given task
function scoreSlot(hour: number, task: Task, peakTimes: number[]): { score: number; reason: string } {
  let score = 50;
  let reasons: string[] = [];

  // Hard tasks in morning get bonus
  if (task.difficulty === 'hard' && hour < 12) {
    score += 25;
    reasons.push('Morning focus for hard task');
  } else if (task.difficulty === 'hard' && hour >= 14) {
    score -= 10;
  }

  // Easy tasks can go in afternoon
  if (task.difficulty === 'easy' && hour >= 14) {
    score += 10;
    reasons.push('Afternoon slot for easy task');
  }

  // Peak productivity match
  if (peakTimes.includes(hour)) {
    score += 20;
    reasons.push('Peak productivity time');
  }

  // Prime morning hours
  if (hour >= 9 && hour <= 11) {
    score += 15;
    if (!reasons.includes('Peak productivity time')) {
      reasons.push('Prime morning hours');
    }
  }

  // Afternoon focus window
  if (hour >= 14 && hour <= 16) {
    score += 5;
    if (reasons.length === 0) {
      reasons.push('Afternoon focus window');
    }
  }

  // Avoid late evening for hard tasks
  if (hour >= 20 && task.difficulty === 'hard') {
    score -= 15;
  }

  return {
    score,
    reason: reasons[0] || 'Available slot',
  };
}

// Find available time slots given scheduled tasks
function findAvailableSlots(
  scheduledTasks: Task[],
  startHour: number = 6,
  endHour: number = 22
): number[] {
  const occupiedHours = new Set<number>();

  for (const task of scheduledTasks) {
    if (!task.scheduled_time) continue;
    const hour = parseInt(task.scheduled_time.split(':')[0]);
    const duration = task.estimated_duration || 30;
    const hoursOccupied = Math.ceil(duration / 60);

    for (let h = 0; h < hoursOccupied; h++) {
      occupiedHours.add(hour + h);
    }
  }

  const available: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    if (!occupiedHours.has(h)) {
      available.push(h);
    }
  }

  return available;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`Generating daily plan optimization for user: ${userId}`);

    // Fetch today's data in parallel
    const [
      todayTasksResult,
      yesterdayTasksResult,
      habitsResult,
      activeEpicsResult,
      recentStreakResult,
      learningResult,
    ] = await Promise.all([
      // Today's tasks
      supabase
        .from('daily_tasks')
        .select('id, task_text, completed, scheduled_time, estimated_duration, difficulty, energy_level, is_top_three, category')
        .eq('user_id', userId)
        .eq('task_date', today),
      
      // Yesterday's tasks (for pattern analysis)
      supabase
        .from('daily_tasks')
        .select('id, completed, difficulty')
        .eq('user_id', userId)
        .eq('task_date', yesterday),
      
      // Active habits due today
      supabase
        .from('habits')
        .select('id, title, difficulty, current_streak, frequency')
        .eq('user_id', userId)
        .eq('is_active', true),
      
      // Active epics
      supabase
        .from('epics')
        .select('id, title, progress_percentage, target_days, start_date')
        .eq('user_id', userId)
        .eq('status', 'active'),
      
      // Recent 7-day task completion
      supabase
        .from('daily_tasks')
        .select('completed, task_date')
        .eq('user_id', userId)
        .gte('task_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      
      // AI learning profile
      supabase
        .from('user_ai_learning')
        .select('preferred_habit_difficulty, successful_patterns, failed_patterns, peak_productivity_times')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const todayTasks: Task[] = todayTasksResult.data || [];
    const yesterdayTasks = yesterdayTasksResult.data || [];
    const habits = habitsResult.data || [];
    const activeEpics = activeEpicsResult.data || [];
    const recentTasks = recentStreakResult.data || [];
    const learning = learningResult.data;

    console.log(`Today: ${todayTasks.length} tasks, ${habits.length} habits, ${activeEpics.length} epics`);

    const insights: DailyInsight[] = [];

    // Calculate metrics
    const completedToday = todayTasks.filter(t => t.completed).length;
    const totalToday = todayTasks.length;
    const yesterdayCompletion = yesterdayTasks.length > 0 
      ? (yesterdayTasks.filter(t => t.completed).length / yesterdayTasks.length) * 100 
      : 0;

    // 7-day average
    const weeklyCompletion = recentTasks.length > 0
      ? (recentTasks.filter(t => t.completed).length / recentTasks.length) * 100
      : 0;

    // Check for overload
    const hardTasks = todayTasks.filter(t => t.difficulty === 'hard').length;
    const highEnergyTasks = todayTasks.filter(t => t.energy_level === 'high').length;
    const totalEstimatedMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);

    // 1. Overload warning
    if (totalToday > 8 || hardTasks >= 3 || totalEstimatedMinutes > 480) {
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Heavy Day Ahead',
        message: `You have ${totalToday} tasks${hardTasks >= 3 ? ` including ${hardTasks} hard ones` : ''}. Consider simplifying or rescheduling some tasks.`,
        actionLabel: 'Review Tasks',
        actionType: 'simplify',
        relatedTaskIds: todayTasks.filter(t => t.difficulty === 'hard').map(t => t.id),
      });
    }

    // 2. Yesterday momentum
    if (yesterdayCompletion >= 80 && yesterdayTasks.length >= 3) {
      insights.push({
        type: 'encouragement',
        priority: 'medium',
        title: 'Great Momentum!',
        message: `You completed ${Math.round(yesterdayCompletion)}% yesterday. Keep that energy going today!`,
      });
    } else if (yesterdayCompletion < 50 && yesterdayTasks.length >= 3) {
      insights.push({
        type: 'suggestion',
        priority: 'medium',
        title: 'Fresh Start Today',
        message: 'Yesterday was tough. Start with your easiest task today to build momentum.',
        actionLabel: 'Start Easy',
      });
    }

    // 3. Habit streaks at risk
    const streaksAtRisk = habits.filter(h => h.current_streak >= 3);
    if (streaksAtRisk.length > 0) {
      const topStreak = streaksAtRisk.reduce((max, h) => h.current_streak > max.current_streak ? h : max, streaksAtRisk[0]);
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Protect Your Streaks',
        message: `Your "${topStreak.title}" streak is at ${topStreak.current_streak} days. Don't break it today!`,
      });
    }

    // 4. Epic progress check
    for (const epic of activeEpics) {
      const startDate = new Date(epic.start_date);
      const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedProgress = (daysSinceStart / epic.target_days) * 100;
      const actualProgress = epic.progress_percentage || 0;

      if (actualProgress < expectedProgress - 15) {
        insights.push({
          type: 'warning',
          priority: 'medium',
          title: 'Epic Falling Behind',
          message: `"${epic.title}" is ${Math.round(expectedProgress - actualProgress)}% behind schedule. Focus on its habits today.`,
        });
      } else if (actualProgress > expectedProgress + 10) {
        insights.push({
          type: 'encouragement',
          priority: 'low',
          title: 'Epic Ahead of Schedule!',
          message: `"${epic.title}" is ahead by ${Math.round(actualProgress - expectedProgress)}%. Amazing progress!`,
        });
      }
    }

    // 5. Energy distribution suggestion
    const morningTasks = todayTasks.filter(t => {
      const time = t.scheduled_time;
      if (!time) return false;
      const hour = parseInt(time.split(':')[0]);
      return hour >= 5 && hour < 12;
    });
    const afternoonTasks = todayTasks.filter(t => {
      const time = t.scheduled_time;
      if (!time) return false;
      const hour = parseInt(time.split(':')[0]);
      return hour >= 12 && hour < 17;
    });

    const morningHardCount = morningTasks.filter(t => t.difficulty === 'hard').length;
    const afternoonHardCount = afternoonTasks.filter(t => t.difficulty === 'hard').length;

    if (afternoonHardCount > morningHardCount && afternoonHardCount >= 2) {
      insights.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Energy Optimization',
        message: 'Your hard tasks are scheduled for afternoon when energy typically dips. Consider moving them to morning.',
        actionLabel: 'Reschedule',
        actionType: 'reschedule',
      });
    }

    // 6. Top three check
    const topThreeTasks = todayTasks.filter(t => t.is_top_three);
    if (totalToday >= 5 && topThreeTasks.length === 0) {
      insights.push({
        type: 'suggestion',
        priority: 'medium',
        title: 'Set Your Top 3',
        message: 'Mark your 3 most important tasks to stay focused on what matters most.',
      });
    }

    // 7. Weekly trend
    if (weeklyCompletion >= 75) {
      insights.push({
        type: 'encouragement',
        priority: 'low',
        title: 'Strong Week!',
        message: `You've completed ${Math.round(weeklyCompletion)}% of tasks this week. Keep it up!`,
      });
    }

    // Calculate overall readiness
    let readiness = 70; // Base
    if (totalToday <= 6) readiness += 10;
    if (hardTasks <= 2) readiness += 10;
    if (topThreeTasks.length >= 1) readiness += 5;
    if (weeklyCompletion >= 70) readiness += 5;
    if (yesterdayCompletion >= 70) readiness += 5;
    readiness = Math.min(100, readiness);

    // Energy forecast (simplified)
    const energyForecast = {
      morning: 'high' as const,
      afternoon: totalToday > 6 ? 'low' as const : 'medium' as const,
      evening: 'medium' as const,
    };

    // Sort insights by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // ==========================================
    // Generate suggested schedule for unscheduled tasks
    // ==========================================
    const suggestedSchedule: SuggestedScheduleItem[] = [];
    const unscheduledTasks = todayTasks.filter(t => !t.scheduled_time && !t.completed);
    
    if (unscheduledTasks.length > 0) {
      const scheduledTasks = todayTasks.filter(t => t.scheduled_time);
      const availableHours = findAvailableSlots(scheduledTasks);
      
      // Get user's peak productivity times or use defaults
      const peakTimes: number[] = (learning?.peak_productivity_times as number[]) || [9, 10, 14];
      
      console.log(`Found ${unscheduledTasks.length} unscheduled tasks, ${availableHours.length} available hours`);

      // Score and sort tasks by priority (hard first, then by category)
      const sortedUnscheduled = [...unscheduledTasks].sort((a, b) => {
        const difficultyOrder: Record<string, number> = { hard: 0, medium: 1, easy: 2 };
        const aDiff = difficultyOrder[a.difficulty || 'medium'] ?? 1;
        const bDiff = difficultyOrder[b.difficulty || 'medium'] ?? 1;
        return aDiff - bDiff;
      });

      // Track used hours to avoid double-booking suggestions
      const usedHours = new Set<number>();

      for (const task of sortedUnscheduled.slice(0, 5)) {
        // Score each available hour for this task
        const scoredSlots = availableHours
          .filter(h => !usedHours.has(h))
          .map(hour => ({
            hour,
            ...scoreSlot(hour, task, peakTimes),
          }))
          .sort((a, b) => b.score - a.score);

        if (scoredSlots.length > 0) {
          const bestSlot = scoredSlots[0];
          const duration = task.estimated_duration || 30;
          const hoursNeeded = Math.ceil(duration / 60);

          // Mark hours as used
          for (let h = 0; h < hoursNeeded; h++) {
            usedHours.add(bestSlot.hour + h);
          }

          suggestedSchedule.push({
            taskId: task.id,
            suggestedTime: `${bestSlot.hour.toString().padStart(2, '0')}:00`,
            reason: bestSlot.reason,
          });
        }
      }
    }

    const result: DailyPlanOptimization = {
      insights: insights.slice(0, 5), // Max 5 insights
      suggestedSchedule: suggestedSchedule.length > 0 ? suggestedSchedule : undefined,
      energyForecast,
      overallReadiness: readiness,
    };

    console.log(`Generated ${insights.length} insights, ${suggestedSchedule.length} schedule suggestions, readiness: ${readiness}%`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating daily plan optimization:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
