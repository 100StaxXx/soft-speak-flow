import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SchedulingPatterns {
  avgCompletionHour: { hard?: number; medium?: number; easy?: number };
  commonStartTimes: number[];
  commonEndTimes: number[];
  lunchBreakPattern: { detected: boolean; start?: number; end?: number };
  eveningProductivity: number;
  morningProductivity: number;
  taskBatchingScore: number;
  weekdayVsWeekend: { weekday: number; weekend: number };
}

interface TaskCompletionData {
  taskId: string;
  completedAt: string;
  difficulty: string;
  scheduledTime: string | null;
  actualCompletionHour: number;
  dayOfWeek: number;
  wasOnTime: boolean | null;
  category?: string;
}

interface ScheduleModificationData {
  suggestedTime: string;
  actualTime: string;
  taskDifficulty: string;
}

interface TaskCreationData {
  scheduledTime: string | null;
  difficulty: string;
  createdAt: string;
  hour: number;
}

interface MentorChatSignal {
  chatHour: number;
  dayOfWeek: number;
  mentionsEnergy: 'low' | 'high' | null;
  mentionsOverwhelm: boolean;
  mentionsWorkStyle: string | null;
}

function inferWorkStyle(patterns: SchedulingPatterns): { style: string; confidence: number } {
  let traditional9to5Score = 0;
  let entrepreneurScore = 0;

  // Safely access arrays with defaults
  const startTimes = patterns.commonStartTimes || [];
  const endTimes = patterns.commonEndTimes || [];

  // 9-5 indicators
  if (patterns.lunchBreakPattern?.detected) traditional9to5Score += 25;
  if (startTimes.includes(9)) traditional9to5Score += 20;
  if (endTimes.includes(17) || endTimes.includes(18)) traditional9to5Score += 20;
  if ((patterns.eveningProductivity || 0) < 0.2) traditional9to5Score += 15;
  if ((patterns.weekdayVsWeekend?.weekday || 0) > 0.7 && (patterns.weekdayVsWeekend?.weekend || 0) < 0.3) traditional9to5Score += 20;

  // Entrepreneur indicators
  if ((patterns.eveningProductivity || 0) > 0.5) entrepreneurScore += 25;
  if (startTimes.some(t => t > 10 || t < 7)) entrepreneurScore += 20;
  if ((patterns.weekdayVsWeekend?.weekend || 0) > 0.5) entrepreneurScore += 15;
  if ((patterns.taskBatchingScore || 0) > 0.7) entrepreneurScore += 20;
  if ((patterns.avgCompletionHour?.hard || 12) > 14) entrepreneurScore += 20;

  const total = traditional9to5Score + entrepreneurScore;
  const confidence = Math.min(100, total);

  if (traditional9to5Score > entrepreneurScore + 20) return { style: 'traditional', confidence };
  if (entrepreneurScore > traditional9to5Score + 20) return { style: 'entrepreneur', confidence };
  if (total > 40) return { style: 'hybrid', confidence };
  return { style: 'flexible', confidence: Math.max(30, confidence) };
}

function analyzeCompletionTimes(completions: TaskCompletionData[]): SchedulingPatterns {
  const patterns: SchedulingPatterns = {
    avgCompletionHour: {},
    commonStartTimes: [],
    commonEndTimes: [],
    lunchBreakPattern: { detected: false },
    eveningProductivity: 0,
    morningProductivity: 0,
    taskBatchingScore: 0,
    weekdayVsWeekend: { weekday: 0, weekend: 0 },
  };

  if (completions.length < 5) return patterns;

  // Group by difficulty
  const byDifficulty: Record<string, number[]> = { hard: [], medium: [], easy: [] };
  const hourCounts: Record<number, number> = {};
  let morningCount = 0;
  let eveningCount = 0;
  let weekdayCount = 0;
  let weekendCount = 0;
  const lunchHourGaps: number[] = [];

  completions.forEach((c, idx) => {
    const hour = c.actualCompletionHour;
    const diff = c.difficulty || 'medium';
    
    if (byDifficulty[diff]) byDifficulty[diff].push(hour);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    
    if (hour < 12) morningCount++;
    if (hour >= 18) eveningCount++;
    
    if (c.dayOfWeek === 0 || c.dayOfWeek === 6) {
      weekendCount++;
    } else {
      weekdayCount++;
    }

    // Detect lunch break (gap between 11am-2pm completions)
    if (hour >= 11 && hour <= 14) {
      lunchHourGaps.push(hour);
    }
  });

  // Calculate averages
  for (const [diff, hours] of Object.entries(byDifficulty)) {
    if (hours.length > 0) {
      patterns.avgCompletionHour[diff as 'hard' | 'medium' | 'easy'] = 
        hours.reduce((a, b) => a + b, 0) / hours.length;
    }
  }

  // Find common start/end times (top 3 hours)
  const sortedHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([h]) => parseInt(h));
  
  patterns.commonStartTimes = sortedHours.filter(h => h < 14);
  patterns.commonEndTimes = sortedHours.filter(h => h >= 14);

  // Productivity scores
  const total = completions.length;
  patterns.morningProductivity = morningCount / total;
  patterns.eveningProductivity = eveningCount / total;

  // Weekday vs weekend
  const weekdayTotal = weekdayCount + weekendCount;
  if (weekdayTotal > 0) {
    patterns.weekdayVsWeekend = {
      weekday: weekdayCount / weekdayTotal,
      weekend: weekendCount / weekdayTotal,
    };
  }

  // Detect lunch break pattern
  const hasNoLunchCompletions = !lunchHourGaps.includes(12) && !lunchHourGaps.includes(13);
  if (hasNoLunchCompletions && completions.length > 10) {
    patterns.lunchBreakPattern = { detected: true, start: 12, end: 13 };
  }

  // Task batching score (consecutive same-category tasks)
  let batchCount = 0;
  for (let i = 1; i < completions.length; i++) {
    if (completions[i].category && completions[i].category === completions[i - 1].category) {
      batchCount++;
    }
  }
  patterns.taskBatchingScore = completions.length > 1 ? batchCount / (completions.length - 1) : 0;

  return patterns;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { type, data } = body;

    console.log(`[analyze-user-patterns] Processing ${type} for user ${user.id}`);

    // Fetch current learning profile
    const { data: learning, error: fetchError } = await supabase
      .from('user_ai_learning')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-user-patterns] Error fetching learning:', fetchError);
      throw fetchError;
    }

    // Initialize if not exists
    let currentCompletions: TaskCompletionData[] = learning?.task_completion_times || [];
    let currentPatterns: SchedulingPatterns = learning?.scheduling_patterns || {};
    let dayPatterns = learning?.day_of_week_patterns || {};

    // Process based on event type
    // Initialize successful patterns
    let successfulPatterns = learning?.successful_patterns || {};

    if (type === 'task_completion') {
      const completion = data as TaskCompletionData;
      
      // Add to completions (keep last 100)
      currentCompletions = [...currentCompletions, completion].slice(-100);
      
      // Update day patterns
      const dayKey = String(completion.dayOfWeek);
      if (!dayPatterns[dayKey]) {
        dayPatterns[dayKey] = { peakHours: [], completionCount: 0 };
      }
      dayPatterns[dayKey].completionCount = (dayPatterns[dayKey].completionCount || 0) + 1;
      
      // Track peak hours per day
      const peakHours = dayPatterns[dayKey].peakHours || [];
      if (!peakHours.includes(completion.actualCompletionHour)) {
        peakHours.push(completion.actualCompletionHour);
        dayPatterns[dayKey].peakHours = peakHours.slice(-10);
      }
      
      // Track task text patterns for learning what tasks user creates
      if ((completion as any).taskText) {
        const taskText = (completion as any).taskText;
        
        // Track recurring task texts (for replication)
        const recurringTasks: string[] = successfulPatterns.recurring_tasks || [];
        if (!recurringTasks.includes(taskText) && recurringTasks.length < 30) {
          recurringTasks.push(taskText);
          successfulPatterns.recurring_tasks = recurringTasks;
        }
        
        // Track category + difficulty combos that succeed
        const comboKey = `${completion.category || 'uncategorized'}_${completion.difficulty}`;
        const comboCounts: Record<string, number> = successfulPatterns.category_difficulty || {};
        comboCounts[comboKey] = (comboCounts[comboKey] || 0) + 1;
        successfulPatterns.category_difficulty = comboCounts;
      }
    } else if (type === 'schedule_modification') {
      const mod = data as ScheduleModificationData;
      // Track when users prefer different times than suggested
      const suggestedHour = parseInt(mod.suggestedTime.split(':')[0]);
      const actualHour = parseInt(mod.actualTime.split(':')[0]);
      
      if (suggestedHour !== actualHour) {
        // User prefers a different time - learn from this
        const commonTimes = currentPatterns.commonStartTimes || [];
        if (!commonTimes.includes(actualHour)) {
          currentPatterns.commonStartTimes = [...commonTimes, actualHour].slice(-5);
        }
      }
    } else if (type === 'task_creation') {
      const creation = data as TaskCreationData;
      // Learn from when users manually schedule tasks
      if (creation.scheduledTime) {
        const hour = parseInt(creation.scheduledTime.split(':')[0]);
        const commonTimes = currentPatterns.commonStartTimes || [];
        if (!commonTimes.includes(hour)) {
          currentPatterns.commonStartTimes = [...commonTimes, hour].slice(-5);
        }
      }
    } else if (type === 'mentor_chat_signal') {
      // Learn from mentor chat interactions
      const signal = data as MentorChatSignal;
      
      // Track engagement hours (when user actively uses app)
      let engagementHours: number[] = learning?.engagement_hours || [];
      if (!engagementHours.includes(signal.chatHour)) {
        engagementHours = [...engagementHours, signal.chatHour].slice(-10);
      }
      
      // Track energy mentions by hour
      let energyByHour: Record<string, { low: number; high: number }> = learning?.energy_by_hour || {};
      if (signal.mentionsEnergy) {
        const hourKey = String(signal.chatHour);
        if (!energyByHour[hourKey]) {
          energyByHour[hourKey] = { low: 0, high: 0 };
        }
        energyByHour[hourKey][signal.mentionsEnergy]++;
      }
      
      // Track overwhelm signals
      let overwhelmSignals: number = learning?.overwhelm_signals || 0;
      if (signal.mentionsOverwhelm) {
        overwhelmSignals++;
      }
      
      // Track work style signals with high confidence (explicit mentions)
      let workStyleSignals: Array<{ source: string; style: string; weight: number }> = learning?.work_style_signals || [];
      if (signal.mentionsWorkStyle) {
        workStyleSignals.push({
          source: 'explicit_mention',
          style: signal.mentionsWorkStyle,
          weight: 3, // Worth 3x a normal completion signal
        });
        workStyleSignals = workStyleSignals.slice(-20); // Keep last 20
      }
      
      // Update learning with mentor chat signals
      const { error: chatSignalError } = await supabase
        .from('user_ai_learning')
        .upsert({
          user_id: user.id,
          engagement_hours: engagementHours,
          energy_by_hour: energyByHour,
          overwhelm_signals: overwhelmSignals,
          work_style_signals: workStyleSignals,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (chatSignalError) {
        console.error('[analyze-user-patterns] Error upserting chat signals:', chatSignalError);
        throw chatSignalError;
      }
      
      console.log(`[analyze-user-patterns] Processed mentor_chat_signal: energy=${signal.mentionsEnergy}, overwhelm=${signal.mentionsOverwhelm}, workStyle=${signal.mentionsWorkStyle}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'plan_saved') {
      // Learn from successful plan generations - what tasks the user accepted
      const planData = data as { 
        energyLevel: string; 
        dayShape: string; 
        taskCount: number; 
        tasks: Array<{ title: string; category?: string; priority?: string; scheduledTime?: string }>; 
        hour: number; 
        dayOfWeek: number;
      };
      
      console.log(`[analyze-user-patterns] Processing plan_saved: ${planData.taskCount} tasks at hour ${planData.hour}`);
      
      // Track which task titles the AI generated that user accepted
      const aiAcceptedTasks: string[] = successfulPatterns.ai_accepted || [];
      planData.tasks.forEach(task => {
        if (!aiAcceptedTasks.includes(task.title) && aiAcceptedTasks.length < 50) {
          aiAcceptedTasks.push(task.title);
        }
      });
      successfulPatterns.ai_accepted = aiAcceptedTasks;
      
      // Track energy + day shape combos that worked
      const planKey = `${planData.energyLevel}_${planData.dayShape}`;
      const planCounts: Record<string, number> = successfulPatterns.plan_types || {};
      planCounts[planKey] = (planCounts[planKey] || 0) + 1;
      successfulPatterns.plan_types = planCounts;
      
      // Update day-of-week task count averages
      const dayKey = String(planData.dayOfWeek);
      if (!dayPatterns[dayKey]) {
        dayPatterns[dayKey] = { peakHours: [], completionCount: 0, planCount: 0, avgTaskCount: 0 };
      }
      const prevPlanCount = dayPatterns[dayKey].planCount || 0;
      const prevAvgTaskCount = dayPatterns[dayKey].avgTaskCount || 0;
      dayPatterns[dayKey].planCount = prevPlanCount + 1;
      dayPatterns[dayKey].avgTaskCount = 
        (prevAvgTaskCount * prevPlanCount + planData.taskCount) / (prevPlanCount + 1);
      
      // Track plan generation hours
      const planGenHours: number[] = dayPatterns[dayKey].planGenerationHours || [];
      if (!planGenHours.includes(planData.hour)) {
        planGenHours.push(planData.hour);
        dayPatterns[dayKey].planGenerationHours = planGenHours.slice(-5);
      }
    }

    // Re-analyze patterns if we have enough data
    if (currentCompletions.length >= 5) {
      currentPatterns = analyzeCompletionTimes(currentCompletions);
    }

    // Infer work style
    const { style, confidence } = inferWorkStyle(currentPatterns);

    // Upsert learning profile
    const { error: upsertError } = await supabase
      .from('user_ai_learning')
      .upsert({
        user_id: user.id,
        task_completion_times: currentCompletions,
        scheduling_patterns: currentPatterns,
        day_of_week_patterns: dayPatterns,
        successful_patterns: successfulPatterns,
        inferred_work_style: style,
        work_style_confidence: confidence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[analyze-user-patterns] Error upserting:', upsertError);
      throw upsertError;
    }

    console.log(`[analyze-user-patterns] Updated patterns. Inferred style: ${style} (${confidence}% confidence)`);

    return new Response(JSON.stringify({ 
      success: true, 
      inferredStyle: style,
      confidence,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[analyze-user-patterns] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

