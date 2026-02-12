import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

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

interface LearningContext {
  peakHours: number[];
  preferredTaskCount: number;
  avoidHours: number[];
  successfulCategories: string[];
  dayOfWeekPatterns: Record<string, { avgTasks: number; completionRate: number }>;
}

function buildLearningContext(aiLearning: Record<string, unknown> | null): LearningContext {
  const defaultContext: LearningContext = {
    peakHours: [9, 10, 11, 14, 15],
    preferredTaskCount: 5,
    avoidHours: [12, 13, 22, 23],
    successfulCategories: [],
    dayOfWeekPatterns: {},
  };

  if (!aiLearning) return defaultContext;

  // Extract peak hours from energy_by_hour
  const energyByHour = aiLearning.energy_by_hour as Record<string, number> | undefined;
  if (energyByHour) {
    const sorted = Object.entries(energyByHour)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    defaultContext.peakHours = sorted.map(([hour]) => parseInt(hour));
    
    // Avoid hours are the bottom performers
    const avoid = Object.entries(energyByHour)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 4);
    defaultContext.avoidHours = avoid.map(([hour]) => parseInt(hour));
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      weeklyGoal,
    } = body;

    console.log('Generating weekly plan for user:', user.id, 'with params:', { energyLevel, prioritizedEpicId, protectStreaks, focusDays, weeklyGoal });

    // Calculate week boundaries
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
    console.log('Learning context:', learningContext);

    // Fetch existing tasks for the week
    const { data: existingTasks } = await supabase
      .from('daily_tasks')
      .select('id, task_date, task_text')
      .eq('user_id', user.id)
      .gte('task_date', formatDate(weekStart))
      .lte('task_date', formatDate(weekEnd));

    // Group existing tasks by date
    const tasksByDate = new Map<string, string[]>();
    existingTasks?.forEach(t => {
      const existing = tasksByDate.get(t.task_date) || [];
      existing.push(t.task_text);
      tasksByDate.set(t.task_date, existing);
    });

    // Fetch habits for streak protection
    const { data: habits } = await supabase
      .from('habits')
      .select('id, title, current_streak, frequency, preferred_time, estimated_duration, category')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const habitsAtRisk = habits?.filter(h => (h.current_streak || 0) > 3) || [];

    // Fetch active epics
    const { data: epics } = await supabase
      .from('epics')
      .select('id, title, progress_percentage, target_date')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const prioritizedEpic = epics?.find(e => e.id === prioritizedEpicId);

    // Build daily task counts based on learning + preferences
    const dailyPlans: Array<{ date: string; dayName: string; taskCount: number; energyLevel: 'low' | 'medium' | 'high' }> = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      const dayName = getDayName(date);
      
      let dayEnergy: 'low' | 'medium' | 'high' = 'medium';
      let taskCount = learningContext.preferredTaskCount || 5;
      
      // Apply user preferences
      if (focusDays.includes(dayName)) {
        dayEnergy = 'high';
        taskCount = Math.min(8, taskCount + 2);
      } else if (lightDays.includes(dayName)) {
        dayEnergy = 'low';
        taskCount = Math.max(2, taskCount - 2);
      }
      
      // Weekend defaults
      if ((dayName === 'saturday' || dayName === 'sunday') && !focusDays.includes(dayName)) {
        dayEnergy = dayEnergy === 'high' ? 'medium' : 'low';
        taskCount = Math.max(2, Math.floor(taskCount * 0.6));
      }
      
      // Apply learned patterns
      const dayPattern = learningContext.dayOfWeekPatterns[dayName];
      if (dayPattern && dayPattern.completionRate < 0.5) {
        // User historically struggles on this day - reduce load
        taskCount = Math.max(2, Math.floor(taskCount * 0.7));
      }
      
      dailyPlans.push({ date: dateStr, dayName, taskCount, energyLevel: dayEnergy });
    }

    // Generate tasks using AI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are a weekly planning assistant. Generate a balanced week of tasks based on user context.

RULES:
1. Create practical, actionable tasks
2. Distribute workload across the week based on energy levels
3. Protect habit streaks by including them as tasks
4. Focus on the prioritized epic if specified
5. Respect the task count limits for each day
6. Schedule harder tasks during peak hours: ${learningContext.peakHours.join(', ')}
7. Avoid scheduling during: ${learningContext.avoidHours.join(', ')}

USER CONTEXT:
- Energy level preference: ${energyLevel}
- Weekly goal: ${weeklyGoal || 'No specific goal set'}
- Prioritized epic: ${prioritizedEpic ? `${prioritizedEpic.title} (${Math.round(prioritizedEpic.progress_percentage || 0)}% complete)` : 'None'}
- Focus days: ${focusDays.join(', ') || 'None'}
- Light days: ${lightDays.join(', ') || 'None'}
- Protect streaks: ${protectStreaks}
${protectStreaks && habitsAtRisk.length > 0 ? `- Habits to protect: ${habitsAtRisk.map(h => `${h.title} (${h.current_streak}-day streak)`).join(', ')}` : ''}
- Successful categories: ${learningContext.successfulCategories.join(', ') || 'Not enough data'}

DAILY BREAKDOWN:
${dailyPlans.map(d => `- ${d.dayName} (${d.date}): ${d.taskCount} tasks, ${d.energyLevel} energy${tasksByDate.get(d.date)?.length ? `, already has: ${tasksByDate.get(d.date)!.join(', ')}` : ''}`).join('\n')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a personalized weekly plan with tasks for each day.' }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_weekly_plan',
            description: 'Generate tasks for each day of the week',
            parameters: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string', description: 'YYYY-MM-DD format' },
                      title: { type: 'string', description: 'Task title' },
                      scheduled_time: { type: 'string', description: 'HH:MM format, optional' },
                      estimated_duration: { type: 'number', description: 'Minutes, default 30' },
                      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                      category: { type: 'string', enum: ['mind', 'body', 'soul', 'work', 'personal'] },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                    },
                    required: ['date', 'title', 'difficulty'],
                  },
                },
                summary: { type: 'string', description: 'Brief summary of the week plan' },
              },
              required: ['tasks', 'summary'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'generate_weekly_plan' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      throw new Error('Failed to generate weekly plan');
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('No plan generated');
    }

    const generatedPlan = JSON.parse(toolCall.function.arguments);
    console.log('Generated plan:', generatedPlan);

    // Insert tasks into database
    const tasksToInsert = generatedPlan.tasks.map((task: { date: string; title: string; scheduled_time?: string; estimated_duration?: number; difficulty?: string; category?: string; priority?: string }) => ({
      user_id: user.id,
      task_text: task.title,
      task_date: task.date,
      scheduled_time: task.scheduled_time || null,
      estimated_duration: task.estimated_duration || 30,
      difficulty: task.difficulty || 'medium',
      category: ['mind', 'body', 'soul'].includes(task.category || '') ? task.category : null,
      priority: task.priority || 'medium',
      ai_generated: true,
      xp_reward: task.difficulty === 'hard' ? 30 : task.difficulty === 'easy' ? 10 : 20,
    }));

    const { data: insertedTasks, error: insertError } = await supabase
      .from('daily_tasks')
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting tasks:', insertError);
      throw insertError;
    }

    // Calculate balance score
    const taskCounts = dailyPlans.map(d => {
      const count = insertedTasks?.filter(t => t.task_date === d.date).length || 0;
      return count + (tasksByDate.get(d.date)?.length || 0);
    });
    const avgTasks = taskCounts.reduce((a, b) => a + b, 0) / 7;
    const variance = taskCounts.reduce((sum, c) => sum + Math.pow(c - avgTasks, 2), 0) / 7;
    const balanceScore = Math.max(0, Math.min(100, 100 - variance * 5));

    const result = {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      weeklyTasks: insertedTasks || [],
      balanceScore: Math.round(balanceScore),
      summaryMessage: generatedPlan.summary,
      protectedStreaks: habitsAtRisk.map(h => ({ id: h.id, title: h.title, streak: h.current_streak || 0 })),
    };

    console.log('Weekly plan result:', { 
      weekStart: result.weekStart,
      tasksGenerated: result.weeklyTasks.length,
      balanceScore: result.balanceScore,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in generate-weekly-plan:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
