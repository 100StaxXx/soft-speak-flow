import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SuggestedSlot {
  time: string;
  score: number;
  reason: string;
}

interface RequestBody {
  task_date: string;
  estimated_duration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { task_date, estimated_duration = 30, difficulty = 'medium' } = body;

    if (!task_date) {
      return new Response(JSON.stringify({ error: 'task_date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch existing tasks for the date
    const { data: existingTasks } = await supabaseClient
      .from('daily_tasks')
      .select('id, task_text, scheduled_time, estimated_duration')
      .eq('user_id', user.id)
      .eq('task_date', task_date)
      .not('scheduled_time', 'is', null)
      .order('scheduled_time');

    // Fetch user's AI learning profile for peak times
    const { data: aiLearning } = await supabaseClient
      .from('user_ai_learning')
      .select('peak_productivity_times, preferred_task_times')
      .eq('user_id', user.id)
      .single();

    // Fetch habits for the day to know preferred times
    const dayOfWeek = new Date(task_date).getDay();
    const { data: habits } = await supabaseClient
      .from('habits')
      .select('preferred_time')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .contains('frequency_days', [dayOfWeek]);

    // Build occupied time slots
    const occupiedSlots: { start: number; end: number; name: string }[] = [];
    
    if (existingTasks) {
      for (const task of existingTasks) {
        if (task.scheduled_time) {
          const [hours, minutes] = task.scheduled_time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const duration = task.estimated_duration || 30;
          occupiedSlots.push({
            start: startMinutes,
            end: startMinutes + duration,
            name: task.task_text || 'Task',
          });
        }
      }
    }

    // Add habit preferred times as soft blocks
    const habitTimes: number[] = [];
    if (habits) {
      for (const habit of habits) {
        if (habit.preferred_time) {
          const [hours, minutes] = habit.preferred_time.split(':').map(Number);
          habitTimes.push(hours * 60 + minutes);
        }
      }
    }

    // Parse peak productivity times
    const peakHours: number[] = [];
    if (aiLearning?.peak_productivity_times) {
      const times = aiLearning.peak_productivity_times;
      if (Array.isArray(times)) {
        for (const time of times) {
          if (typeof time === 'string' && time.includes(':')) {
            const [hours] = time.split(':').map(Number);
            peakHours.push(hours);
          } else if (typeof time === 'number') {
            peakHours.push(time);
          }
        }
      }
    }

    // Generate candidate time slots (every 30 minutes from 6 AM to 10 PM)
    const candidates: SuggestedSlot[] = [];
    const now = new Date();
    const isToday = task_date === now.toISOString().split('T')[0];
    const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

    for (let minutes = 6 * 60; minutes <= 22 * 60 - estimated_duration; minutes += 30) {
      // Skip past times if it's today
      if (isToday && minutes < currentMinutes + 15) continue;

      const slotEnd = minutes + estimated_duration;
      
      // Check for conflicts
      let hasConflict = false;
      for (const occupied of occupiedSlots) {
        if (minutes < occupied.end && slotEnd > occupied.start) {
          hasConflict = true;
          break;
        }
      }
      
      if (hasConflict) continue;

      // Score this slot
      let score = 50;
      const reasons: string[] = [];
      const hour = Math.floor(minutes / 60);

      // Difficulty-based scoring
      if (difficulty === 'hard') {
        if (hour >= 8 && hour <= 11) {
          score += 20;
          reasons.push('Morning focus time');
        } else if (hour >= 14 && hour <= 16) {
          score -= 10;
        }
      } else if (difficulty === 'easy') {
        if (hour >= 14 && hour <= 17) {
          score += 10;
          reasons.push('Good for light tasks');
        }
      }

      // Peak productivity times
      if (peakHours.includes(hour)) {
        score += 25;
        reasons.push('Your peak productivity');
      }

      // Buffer from existing tasks
      let minBuffer = Infinity;
      for (const occupied of occupiedSlots) {
        const bufferBefore = minutes - occupied.end;
        const bufferAfter = occupied.start - slotEnd;
        minBuffer = Math.min(minBuffer, Math.max(bufferBefore, 0), Math.max(bufferAfter, 0));
      }
      
      if (minBuffer >= 30 && minBuffer !== Infinity) {
        score += 15;
        reasons.push('Good buffer time');
      } else if (minBuffer >= 15 && minBuffer !== Infinity) {
        score += 5;
      }

      // Avoid habit times (soft penalty)
      for (const habitTime of habitTimes) {
        if (Math.abs(minutes - habitTime) < 30) {
          score -= 10;
        }
      }

      // Time of day general preferences
      if (hour >= 9 && hour <= 11) {
        score += 5;
        if (!reasons.length) reasons.push('Morning slot');
      } else if (hour >= 19) {
        score -= 5;
      }

      const timeStr = `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      
      candidates.push({
        time: timeStr,
        score: Math.min(100, Math.max(0, score)),
        reason: reasons.length > 0 ? reasons[0] : 'Available slot',
      });
    }

    // Sort by score and take top 5
    candidates.sort((a, b) => b.score - a.score);
    const suggestedSlots = candidates.slice(0, 5);

    console.log(`[suggest-task-times] Generated ${suggestedSlots.length} suggestions for ${task_date}`);

    return new Response(JSON.stringify({ suggestedSlots }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[suggest-task-times] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
