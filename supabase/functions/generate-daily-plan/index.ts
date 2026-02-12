import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  energyLevel: 'low' | 'medium' | 'high';
  dayType: 'workday' | 'dayoff' | 'mixed';
  focusArea: 'progress' | 'order' | 'health' | 'connection' | 'survival';
}

interface GeneratedTask {
  task_text: string;
  category: 'mind' | 'body' | 'soul';
  task_category: 'basic' | 'work' | 'health' | 'connection' | 'quick_win' | 'order' | 'habit' | 'epic';
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_minutes: number;
  suggested_time: string;
  xp_reward: number;
  epic_id?: string;
  habit_source_id?: string;
}

interface LearningContext {
  peakHours: string[];
  avoidHours: string[];
  preferredTaskCount: number | null;
  successfulCategories: string[];
  dayOfWeekPattern: string | null;
}

// Build personalization context from AI learning data
function buildLearningContext(aiLearning: any): LearningContext {
  const context: LearningContext = {
    peakHours: [],
    avoidHours: [],
    preferredTaskCount: null,
    successfulCategories: [],
    dayOfWeekPattern: null,
  };

  // Extract peak productivity hours from energy_by_hour
  const energyByHour = aiLearning.energy_by_hour as Record<string, number> | null;
  if (energyByHour) {
    const sorted = Object.entries(energyByHour).sort(([, a], [, b]) => b - a);
    context.peakHours = sorted.slice(0, 3).map(([hour]) => `${hour}:00`);
    context.avoidHours = sorted.slice(-2).map(([hour]) => `${hour}:00`);
  }

  // Extract preferred task count from successful patterns
  const successfulPatterns = aiLearning.successful_patterns as Record<string, number> | null;
  if (successfulPatterns) {
    const taskCounts = Object.keys(successfulPatterns)
      .filter(k => k.startsWith('task_count_'))
      .map(k => ({ count: parseInt(k.replace('task_count_', '')), success: successfulPatterns[k] }));
    if (taskCounts.length > 0) {
      const best = taskCounts.sort((a, b) => b.success - a.success)[0];
      context.preferredTaskCount = best.count;
    }
  }

  // Extract successful categories
  const preferenceWeights = aiLearning.preference_weights as Record<string, Record<string, number>> | null;
  if (preferenceWeights?.categories) {
    const cats = Object.entries(preferenceWeights.categories)
      .filter(([, weight]) => weight > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);
    context.successfulCategories = cats;
  }

  // Day-of-week patterns
  const dayPatterns = aiLearning.day_of_week_patterns as Record<string, number> | null;
  if (dayPatterns) {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayCompletion = dayPatterns[today];
    if (todayCompletion !== undefined) {
      if (todayCompletion < 50) {
        context.dayOfWeekPattern = `User typically completes ${todayCompletion}% on ${today}s - suggest fewer/easier tasks`;
      } else if (todayCompletion > 80) {
        context.dayOfWeekPattern = `User is highly productive on ${today}s (${todayCompletion}% completion) - can handle more`;
      }
    }
  }

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { energyLevel, dayType, focusArea } = body;
    const today = new Date().toISOString().split('T')[0];

    console.log(`Generating daily plan for user ${user.id}: energy=${energyLevel}, dayType=${dayType}, focus=${focusArea}`);

    // Fetch existing data in parallel
    const [
      existingTasksRes,
      epicsRes,
      habitsRes,
      aiLearningRes,
    ] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('user_id', user.id).eq('task_date', today),
      supabase.from('epics').select('*, epic_milestones(*)').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('habits').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('user_ai_learning').select('*').eq('user_id', user.id).single(),
    ]);

    const existingTasks = existingTasksRes.data || [];
    const epics = epicsRes.data || [];
    const habits = habitsRes.data || [];
    const aiLearning = aiLearningRes.data;

    // Determine task count based on energy
    const taskCounts = { low: { min: 5, max: 6 }, medium: { min: 6, max: 8 }, high: { min: 8, max: 10 } };
    const { min: minTasks, max: maxTasks } = taskCounts[energyLevel];

    // Build context for AI
    const existingTaskTexts = existingTasks.map(t => t.task_text.toLowerCase());
    const epicContext = epics.map(e => ({
      id: e.id,
      title: e.title,
      progress: e.progress_percentage || 0,
      milestones: (e.epic_milestones || []).filter((m: any) => !m.completed_at).slice(0, 2),
    }));
    const habitContext = habits.map(h => ({
      id: h.id,
      title: h.title,
      streak: h.current_streak || 0,
      preferredTime: h.preferred_time,
      category: h.category,
    }));

    // Identify habits with streaks to protect (streak >= 3)
    const habitsToProtect = habitContext.filter(h => h.streak >= 3);

    // Identify epics behind schedule (progress < expected based on time)
    const epicsBehind = epicContext.filter(e => e.progress < 50 && e.milestones.length > 0);

    // Build personalization context from AI learning data
    const learningContext = aiLearning ? buildLearningContext(aiLearning) : null;

    // Build system prompt with hard rules
    const systemPrompt = `You are an opinionated daily planner AI. Generate a realistic, achievable daily plan.

HARD RULES (non-negotiable):
1. Generate ${minTasks}-${maxTasks} tasks total
2. ALWAYS include:
   - 2 basics (hygiene + environment/tidying)
   - 1 work/life anchor task (even on days off - can be light planning)
   - 1 health task (scaled to energy level)
   - 1 relationship/social touch (unless survival mode)
   - 1 quick win (≤5 min task)

ENERGY SCALING:
- LOW: Very simple tasks. "Brush teeth", "5-min tidy", "Text someone"
- MEDIUM: Moderate tasks. "30-min focused work", "Walk outside", "Laundry"
- HIGH: Challenging tasks. "Deep work block", "Workout", "Batch chores"

DAY TYPE:
- WORKDAY: Include work-focused tasks, respect typical work hours
- DAY OFF: Lighter, personal tasks, but still include 1 anchor
- MIXED: Balance of both

FOCUS AREA PRIORITY:
- PROGRESS: More work/goal tasks, include epic milestones
- ORDER: More cleaning/organizing tasks
- HEALTH: More exercise/self-care tasks
- CONNECTION: More social/relationship tasks
- SURVIVAL: Bare minimum only - stick to basics + 1 anchor

USER CONTEXT:
${epicsBehind.length > 0 ? `Epics behind schedule: ${epicsBehind.map(e => e.title).join(', ')}` : 'No epics behind schedule'}
${habitsToProtect.length > 0 ? `Streaks to protect (>=3 days): ${habitsToProtect.map(h => `${h.title} (${h.streak}d)`).join(', ')}` : 'No significant streaks'}
${existingTaskTexts.length > 0 ? `Already scheduled today: ${existingTaskTexts.slice(0, 5).join(', ')}` : 'No tasks yet today'}
${learningContext ? `
PERSONALIZATION (learned from user behavior):
${learningContext.peakHours.length > 0 ? `- Peak productivity hours: ${learningContext.peakHours.join(', ')}` : ''}
${learningContext.preferredTaskCount ? `- Preferred daily task count: ${learningContext.preferredTaskCount}` : ''}
${learningContext.avoidHours.length > 0 ? `- Low energy hours to avoid difficult tasks: ${learningContext.avoidHours.join(', ')}` : ''}
${learningContext.successfulCategories.length > 0 ? `- Categories with high completion: ${learningContext.successfulCategories.join(', ')}` : ''}
${learningContext.dayOfWeekPattern ? `- ${learningContext.dayOfWeekPattern}` : ''}
` : ''}

AVOID duplicating tasks already scheduled. Be specific and actionable.`;

    const userPrompt = `Generate a daily plan with these parameters:
- Energy: ${energyLevel}
- Day Type: ${dayType}
- Focus: ${focusArea}

Available epics to link tasks to: ${epicContext.length > 0 ? epicContext.map(e => `${e.title} (${e.progress}%)`).join(', ') : 'None'}
Available habits with streaks: ${habitsToProtect.length > 0 ? habitsToProtect.map(h => `${h.title} (${h.streak}d streak, preferred: ${h.preferredTime || 'anytime'})`).join(', ') : 'None'}`;

    // Call OpenAI with tool calling
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_daily_plan",
            description: "Generate a structured daily plan with tasks",
            parameters: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task_text: { type: "string", description: "Short task description (max 60 chars)" },
                      category: { type: "string", enum: ["mind", "body", "soul"] },
                      task_category: { type: "string", enum: ["basic", "work", "health", "connection", "quick_win", "order", "habit", "epic"] },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      estimated_minutes: { type: "number", description: "Time in minutes" },
                      suggested_time: { type: "string", description: "HH:MM format" },
                    },
                    required: ["task_text", "category", "task_category", "difficulty", "estimated_minutes", "suggested_time"],
                  },
                },
                summary_message: { type: "string", description: "Brief summary of the plan" },
                optional_bonus: { type: "string", description: "Optional bonus task if time permits" },
              },
              required: ["tasks", "summary_message"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_daily_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData, null, 2));

    // Parse tool call response
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const planData = JSON.parse(toolCall.function.arguments);
    const generatedTasks: GeneratedTask[] = planData.tasks || [];

    // Calculate XP rewards based on difficulty
    const xpByDifficulty = { easy: 10, medium: 25, hard: 50 };

    // Insert tasks into database
    const tasksToInsert = generatedTasks.map(task => ({
      user_id: user.id,
      task_date: today,
      task_text: task.task_text.slice(0, 200),
      category: task.category,
      difficulty: task.difficulty,
      estimated_duration: task.estimated_minutes,
      scheduled_time: task.suggested_time,
      xp_reward: xpByDifficulty[task.difficulty] || 15,
      ai_generated: true,
      source: 'plan_my_day',
      completed: false,
      is_main_quest: false,
      energy_level: energyLevel,
    }));

    const { data: insertedTasks, error: insertError } = await supabase
      .from('daily_tasks')
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting tasks:", insertError);
      throw insertError;
    }

    console.log(`Inserted ${insertedTasks?.length || 0} tasks for user ${user.id}`);

    // Find which habits were protected
    const protectedStreaks = habitsToProtect.map(h => ({
      habitId: h.id,
      title: h.title,
      streak: h.streak,
    }));

    // Build response
    const response = {
      plan: {
        energyLevel,
        dayType,
        focusArea,
        taskCount: insertedTasks?.length || 0,
      },
      tasks: insertedTasks || [],
      preservedTasks: existingTasks.map(t => ({ id: t.id, task_text: t.task_text })),
      protectedStreaks,
      optionalBonus: planData.optional_bonus || null,
      summaryMessage: planData.summary_message || `${energyLevel.charAt(0).toUpperCase() + energyLevel.slice(1)} energy · ${dayType} · ${focusArea} focus`,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-daily-plan:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
