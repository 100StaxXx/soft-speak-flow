import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichedContext {
  // Current workload
  activeEpics: Array<{
    id: string;
    title: string;
    progress: number;
    daysRemaining: number;
    habitCount: number;
    storyType: string | null;
    themeColor: string | null;
  }>;
  activeHabits: Array<{
    id: string;
    title: string;
    currentStreak: number;
    difficulty: string;
    frequency: string;
    category: string | null;
  }>;
  pendingQuestsCount: number;
  
  // Performance metrics
  currentStreaks: {
    maxHabitStreak: number;
    dailyTaskStreak: number;
  };
  completionRates: {
    thisWeek: number;
    thisMonth: number;
  };
  averageHabitsPerDay: number;
  
  // Learned preferences
  preferredDifficulty: string;
  preferredEpicDuration: number;
  preferredHabitFrequency: string;
  commonContexts: string[];
  preferenceWeights: Record<string, Record<string, number>>;
  
  // AI preferences from profile
  tonePreference: string | null;
  
  // Capacity signals
  atEpicLimit: boolean;
  overloaded: boolean;
  suggestedWorkload: 'light' | 'normal' | 'heavy';
  
  // Recent activity
  recentCompletedEpics: number;
  recentAbandonedEpics: number;
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
    console.log(`Enriching context for user: ${userId}`);

    // Fetch all data in parallel
    const [
      epicsResult,
      habitsResult,
      questsResult,
      learningResult,
      profileResult,
      recentTasksResult,
      recentEpicsResult
    ] = await Promise.all([
      // Active epics with habit counts
      supabase
        .from('epics')
        .select(`
          id,
          title,
          progress_percentage,
          start_date,
          target_days,
          story_type_slug,
          theme_color,
          epic_habits(count)
        `)
        .eq('user_id', userId)
        .eq('status', 'active'),
      
      // Active habits with streaks
      supabase
        .from('habits')
        .select('id, title, current_streak, difficulty, frequency, category')
        .eq('user_id', userId)
        .eq('is_active', true),
      
      // Pending quests count
      supabase
        .from('quests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active'),
      
      // AI learning profile
      supabase
        .from('user_ai_learning')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // User profile for AI preferences
      supabase
        .from('user_ai_preferences')
        .select('tone_preference')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // Recent tasks for completion rate (last 30 days)
      supabase
        .from('daily_tasks')
        .select('id, completed, task_date')
        .eq('user_id', userId)
        .gte('task_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      
      // Recent epic completions/abandonments (last 90 days)
      supabase
        .from('epics')
        .select('id, status, completed_at')
        .eq('user_id', userId)
        .in('status', ['completed', 'abandoned'])
        .gte('completed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // Process active epics
    const activeEpics = (epicsResult.data || []).map(epic => {
      const startDate = new Date(epic.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + epic.target_days);
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      
      return {
        id: epic.id,
        title: epic.title,
        progress: epic.progress_percentage || 0,
        daysRemaining,
        habitCount: epic.epic_habits?.[0]?.count || 0,
        storyType: epic.story_type_slug,
        themeColor: epic.theme_color
      };
    });

    // Process active habits
    const activeHabits = (habitsResult.data || []).map(habit => ({
      id: habit.id,
      title: habit.title,
      currentStreak: habit.current_streak || 0,
      difficulty: habit.difficulty || 'medium',
      frequency: habit.frequency || 'daily',
      category: habit.category
    }));

    // Calculate streaks
    const maxHabitStreak = activeHabits.reduce((max, h) => Math.max(max, h.currentStreak), 0);

    // Calculate completion rates
    const recentTasks = recentTasksResult.data || [];
    const thisWeekTasks = recentTasks.filter(t => {
      const taskDate = new Date(t.task_date);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return taskDate >= weekAgo;
    });
    const thisMonthTasks = recentTasks;

    const weekCompletionRate = thisWeekTasks.length > 0 
      ? (thisWeekTasks.filter(t => t.completed).length / thisWeekTasks.length) * 100 
      : 0;
    const monthCompletionRate = thisMonthTasks.length > 0 
      ? (thisMonthTasks.filter(t => t.completed).length / thisMonthTasks.length) * 100 
      : 0;

    // Calculate average habits per day
    const daysWithTasks = new Set(recentTasks.map(t => t.task_date)).size;
    const averageHabitsPerDay = daysWithTasks > 0 ? recentTasks.length / daysWithTasks : 0;

    // Get learning profile with defaults
    const learning = learningResult.data || {
      preferred_epic_duration: 30,
      preferred_habit_difficulty: 'medium',
      preferred_habit_frequency: 'daily',
      common_contexts: [],
      preference_weights: { story_type: {}, theme_color: {}, categories: {} }
    };

    // Count recent epic outcomes
    const recentEpics = recentEpicsResult.data || [];
    const recentCompletedEpics = recentEpics.filter(e => e.status === 'completed').length;
    const recentAbandonedEpics = recentEpics.filter(e => e.status === 'abandoned').length;

    // Determine capacity signals
    const MAX_ACTIVE_EPICS = 2;
    const MAX_ACTIVE_HABITS = 10;
    const atEpicLimit = activeEpics.length >= MAX_ACTIVE_EPICS;
    const overloaded = activeHabits.length >= MAX_ACTIVE_HABITS || weekCompletionRate < 50;

    // Determine suggested workload based on current state
    let suggestedWorkload: 'light' | 'normal' | 'heavy' = 'normal';
    if (overloaded || weekCompletionRate < 40) {
      suggestedWorkload = 'light';
    } else if (weekCompletionRate > 80 && activeHabits.length < 5) {
      suggestedWorkload = 'heavy';
    }

    const enrichedContext: EnrichedContext = {
      activeEpics,
      activeHabits,
      pendingQuestsCount: questsResult.count || 0,
      
      currentStreaks: {
        maxHabitStreak,
        dailyTaskStreak: 0 // Would need streak calculation logic
      },
      completionRates: {
        thisWeek: Math.round(weekCompletionRate),
        thisMonth: Math.round(monthCompletionRate)
      },
      averageHabitsPerDay: Math.round(averageHabitsPerDay * 10) / 10,
      
      preferredDifficulty: learning.preferred_habit_difficulty,
      preferredEpicDuration: learning.preferred_epic_duration,
      preferredHabitFrequency: learning.preferred_habit_frequency,
      commonContexts: learning.common_contexts || [],
      preferenceWeights: learning.preference_weights || {},
      
      tonePreference: profileResult.data?.tone_preference || null,
      
      atEpicLimit,
      overloaded,
      suggestedWorkload,
      
      recentCompletedEpics,
      recentAbandonedEpics
    };

    console.log(`Context enriched successfully: ${activeEpics.length} epics, ${activeHabits.length} habits`);

    return new Response(
      JSON.stringify(enrichedContext),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enriching user context:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
