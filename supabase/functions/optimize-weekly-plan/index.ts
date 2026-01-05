import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RequestBody {
  energyLevel?: 'low' | 'medium' | 'high';
  prioritizedEpicId?: string;
  protectStreaks?: boolean;
  focusDays?: string[];
  lightDays?: string[];
  weeklyGoal?: string;
}

interface DailyPlan {
  date: string;
  dayName: string;
  tasks: Array<{
    taskId?: string;
    title: string;
    suggestedTime?: string;
    estimatedDuration?: number;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  totalHours: number;
  energyLevel: 'low' | 'medium' | 'high';
}

interface LearningContext {
  peakHours: number[];
  preferredTaskCount: number;
  dayOfWeekPatterns: Record<string, { avgTasks: number; completionRate: number }>;
  successfulCategories: string[];
}

function buildLearningContext(aiLearning: Record<string, unknown> | null): LearningContext {
  const defaultContext: LearningContext = {
    peakHours: [9, 10, 11, 14, 15],
    preferredTaskCount: 5,
    dayOfWeekPatterns: {},
    successfulCategories: [],
  };

  if (!aiLearning) return defaultContext;

  // Extract peak hours from energy_by_hour
  const energyByHour = aiLearning.energy_by_hour as Record<string, number> | undefined;
  if (energyByHour) {
    const sorted = Object.entries(energyByHour)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    defaultContext.peakHours = sorted.map(([hour]) => parseInt(hour));
  }

  // Extract successful categories
  const successfulPatterns = aiLearning.successful_patterns as Record<string, unknown> | undefined;
  if (successfulPatterns?.categories) {
    defaultContext.successfulCategories = Object.keys(successfulPatterns.categories as Record<string, unknown>);
  }

  // Extract day of week patterns
  const dayPatterns = aiLearning.day_of_week_patterns as Record<string, { tasks_completed?: number; total_tasks?: number }> | undefined;
  if (dayPatterns) {
    Object.entries(dayPatterns).forEach(([day, data]) => {
      defaultContext.dayOfWeekPatterns[day] = {
        avgTasks: data.tasks_completed || 0,
        completionRate: data.total_tasks ? (data.tasks_completed || 0) / data.total_tasks : 0,
      };
    });
  }

  return defaultContext;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body: RequestBody = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.log('No body or invalid JSON, using defaults');
    }

    const { 
      energyLevel = 'medium', 
      prioritizedEpicId, 
      protectStreaks = true,
      focusDays = [],
      lightDays = [],
    } = body;

    console.log('Optimizing weekly plan for user:', user.id, 'with params:', { energyLevel, prioritizedEpicId, protectStreaks, focusDays });

    // Calculate week boundaries (next 7 days starting from today)
    const today = new Date();
    const weekStart = new Date(today);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const getDayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Fetch AI learning data for personalization
    const { data: aiLearning } = await supabase
      .from('user_ai_learning')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const learningContext = buildLearningContext(aiLearning);
    console.log('Learning context for optimization:', learningContext);

    // Fetch existing tasks for the week
    const { data: existingTasks, error: tasksError } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('task_date', formatDate(weekStart))
      .lte('task_date', formatDate(weekEnd))
      .order('task_date', { ascending: true });

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    // Fetch user's habits for streak protection
    const { data: habits } = await supabase
      .from('habits')
      .select('id, title, current_streak, frequency, preferred_time, estimated_duration')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Fetch active epics for context
    const { data: epics } = await supabase
      .from('epics')
      .select('id, title, progress_percentage')
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Build daily plans for the week
    const dailyPlans: DailyPlan[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      const dayName = getDayName(date);

      // Get tasks for this day
      const dayTasks = existingTasks?.filter(t => t.task_date === dateStr) || [];
      
      // Determine day's energy level based on user preferences
      let dayEnergy: 'low' | 'medium' | 'high' = 'medium';
      if (focusDays.includes(dayName)) {
        dayEnergy = 'high';
      } else if (lightDays.includes(dayName)) {
        dayEnergy = 'low';
      } else if (energyLevel !== 'medium') {
        dayEnergy = energyLevel;
      }
      
      // Weekend default to lighter if no preference specified
      if ((dayName === 'saturday' || dayName === 'sunday') && !focusDays.includes(dayName)) {
        dayEnergy = dayEnergy === 'high' ? 'medium' : 'low';
      }

      // Calculate total hours from existing tasks
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);

      // Map tasks to the output format
      const plannedTasks: Array<{
        taskId?: string;
        title: string;
        suggestedTime?: string;
        estimatedDuration?: number;
        priority: 'high' | 'medium' | 'low';
        reason: string;
      }> = dayTasks.map(t => ({
        taskId: t.id,
        title: t.task_text,
        suggestedTime: t.scheduled_time || undefined,
        estimatedDuration: t.estimated_duration || 30,
        priority: (t.priority as 'high' | 'medium' | 'low') || 'medium',
        reason: t.epic_id 
          ? 'Part of active goal' 
          : t.habit_source_id 
            ? 'Recurring habit' 
            : 'Scheduled task',
      }));

      // Add habit placeholders if protecting streaks
      if (protectStreaks && habits && habits.length > 0) {
        const habitIds = new Set(dayTasks.filter(t => t.habit_source_id).map(t => t.habit_source_id));
        
        for (const habit of habits) {
          if (!habitIds.has(habit.id)) {
            // Check if this habit should run on this day (simplified frequency check)
            const shouldRun = habit.frequency === 'daily' || 
              (habit.frequency === 'weekly' && dayName === 'monday') ||
              (habit.frequency === 'weekdays' && !['saturday', 'sunday'].includes(dayName));
            
            if (shouldRun && habit.current_streak && habit.current_streak > 3) {
              plannedTasks.push({
                title: habit.title,
                suggestedTime: habit.preferred_time || undefined,
                estimatedDuration: habit.estimated_duration || 15,
                priority: 'high',
                reason: `Protect ${habit.current_streak}-day streak`,
              });
            }
          }
        }
      }

      // Sort by time if available
      plannedTasks.sort((a, b) => {
        if (!a.suggestedTime && !b.suggestedTime) return 0;
        if (!a.suggestedTime) return 1;
        if (!b.suggestedTime) return -1;
        return a.suggestedTime.localeCompare(b.suggestedTime);
      });

      dailyPlans.push({
        date: dateStr,
        dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        tasks: plannedTasks,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        energyLevel: dayEnergy,
      });
    }

    // Generate insights
    const insights: Array<{
      type: 'optimization' | 'warning' | 'encouragement' | 'suggestion';
      priority: 'high' | 'medium' | 'low';
      title: string;
      message: string;
      affectedDays?: string[];
    }> = [];

    // Check for overloaded days
    const overloadedDays = dailyPlans.filter(d => d.totalHours > 6);
    if (overloadedDays.length > 0) {
      insights.push({
        type: 'warning',
        priority: 'high',
        title: 'Heavy days detected',
        message: `${overloadedDays.length} days have 6+ hours of tasks. Consider spreading the load.`,
        affectedDays: overloadedDays.map(d => d.dayName),
      });
    }

    // Check for empty days
    const emptyDays = dailyPlans.filter(d => d.tasks.length === 0);
    if (emptyDays.length > 2) {
      insights.push({
        type: 'suggestion',
        priority: 'low',
        title: 'Open days available',
        message: `You have ${emptyDays.length} days with no planned tasks. Good for flexibility!`,
        affectedDays: emptyDays.map(d => d.dayName),
      });
    }

    // Epic focus reminder
    if (prioritizedEpicId && epics) {
      const prioritizedEpic = epics.find(e => e.id === prioritizedEpicId);
      if (prioritizedEpic) {
        insights.push({
          type: 'encouragement',
          priority: 'medium',
          title: `Focus: ${prioritizedEpic.title}`,
          message: `This week you're prioritizing "${prioritizedEpic.title}" (${Math.round(prioritizedEpic.progress_percentage || 0)}% complete).`,
        });
      }
    }

    // Calculate balance score
    const avgHours = dailyPlans.reduce((sum, d) => sum + d.totalHours, 0) / 7;
    const variance = dailyPlans.reduce((sum, d) => sum + Math.pow(d.totalHours - avgHours, 2), 0) / 7;
    const balanceScore = Math.max(0, Math.min(100, 100 - variance * 10));

    const totalPlannedHours = dailyPlans.reduce((sum, d) => sum + d.totalHours, 0);

    const response = {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      dailyPlans,
      insights,
      totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
      balanceScore: Math.round(balanceScore),
    };

    console.log('Weekly plan generated:', { 
      weekStart: response.weekStart, 
      weekEnd: response.weekEnd,
      daysPlanned: dailyPlans.length,
      totalHours: totalPlannedHours,
      insightsCount: insights.length,
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in optimize-weekly-plan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
