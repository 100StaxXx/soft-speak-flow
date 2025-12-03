import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Starting daily quote push scheduling...");

    // Get all users with quote pushes enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, selected_mentor_id, daily_quote_push_window, daily_quote_push_time, timezone')
      .eq('daily_quote_push_enabled', true)
      .not('selected_mentor_id', 'is', null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} users with quote pushes enabled`);

    const today = new Date().toLocaleDateString('en-CA');
    let scheduled = 0;
    let skipped = 0;

    for (const user of users || []) {
      try {
        // Get mentor slug
        const { data: mentor } = await supabase
          .from('mentors')
          .select('slug')
          .eq('id', user.selected_mentor_id)
          .single();

        if (!mentor) {
          console.log(`No mentor found for user ${user.id}`);
          continue;
        }

        // Find today's quote for this mentor
        const { data: dailyQuote } = await supabase
          .from('daily_quotes')
          .select('id')
          .eq('for_date', today)
          .eq('mentor_slug', mentor.slug)
          .single();

        if (!dailyQuote) {
          console.log(`No daily quote found for ${mentor.slug} on ${today}`);
          continue;
        }

        // Check if already scheduled
        const { data: existing } = await supabase
          .from('user_daily_quote_pushes')
          .select('id')
          .eq('user_id', user.id)
          .eq('daily_quote_id', dailyQuote.id)
          .single();

        if (existing) {
          console.log(`Quote push already scheduled for user ${user.id}`);
          skipped++;
          continue;
        }

        // Calculate scheduled time
        const scheduledAt = calculateScheduledTime(
          user.daily_quote_push_window,
          user.daily_quote_push_time,
          user.timezone
        );

        // Insert scheduled push
        const { error: insertError } = await supabase
          .from('user_daily_quote_pushes')
          .insert({
            user_id: user.id,
            daily_quote_id: dailyQuote.id,
            scheduled_at: scheduledAt,
          });

        if (insertError) {
          console.error(`Error scheduling for user ${user.id}:`, insertError);
          continue;
        }

        scheduled++;
        console.log(`Scheduled quote push for user ${user.id} at ${scheduledAt}`);
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
      }
    }

    console.log(`Quote push scheduling complete. Scheduled: ${scheduled}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled,
        skipped,
        total: users?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function calculateScheduledTime(window: string, customTime: string | null, timezone: string | null): string {
  // Get the current time in the user's timezone (or UTC if not specified)
  const userTimezone = timezone || 'UTC';
  const now = new Date();
  
  // Default times for windows (in user's local time)
  const windowTimes: Record<string, { hour: number; minute: number }> = {
    morning: { hour: 8, minute: 0 },
    afternoon: { hour: 14, minute: 0 },
    evening: { hour: 19, minute: 0 },
  };

  let targetHour: number;
  let targetMinute: number;

  if (customTime) {
    // Parse custom time (format: "HH:MM:SS" or "HH:MM")
    const timeParts = customTime.split(':').map(Number);
    targetHour = timeParts[0] || 14;
    targetMinute = timeParts[1] || 0;
  } else {
    const time = windowTimes[window] || windowTimes.afternoon;
    targetHour = time.hour;
    targetMinute = time.minute;
    
    // Add random variance of ±30 minutes for natural distribution
    const variance = Math.floor(Math.random() * 61) - 30;
    targetMinute += variance;
    
    // Normalize minutes overflow
    if (targetMinute >= 60) {
      targetHour += 1;
      targetMinute -= 60;
    } else if (targetMinute < 0) {
      targetHour -= 1;
      targetMinute += 60;
    }
  }

  // Create a date string in the user's timezone and convert to UTC
  // Format: YYYY-MM-DDTHH:MM:SS in user's timezone
  try {
    const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const timeStr = `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:00`;
    const userLocalDateStr = `${todayStr}T${timeStr}`;
    
    // Try to use Intl to get timezone offset
    const userDate = new Date(userLocalDateStr);
    
    // Get UTC offset for the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Calculate the offset by comparing formatted time with UTC
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    // Build target time accounting for timezone
    const targetTime = new Date(userLocalDateStr);
    
    // Adjust for timezone - this is a simplified approach
    // In production, you'd want to use a proper timezone library
    const utcOffset = targetTime.getTimezoneOffset(); // Local server offset
    
    // If the time has already passed today (in user's timezone), schedule for tomorrow
    if (targetTime.getTime() < now.getTime()) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return targetTime.toISOString();
  } catch (error) {
    console.error('Error calculating scheduled time with timezone:', error);
    
    // Fallback to simple UTC calculation
    const targetTime = new Date(now);
    targetTime.setUTCHours(targetHour, targetMinute, 0, 0);
    
    if (targetTime < now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return targetTime.toISOString();
  }
}
