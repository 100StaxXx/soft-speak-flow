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

function calculateScheduledTime(window: string, customTime: string | null, timezone: string): string {
  const now = new Date();
  let targetTime: Date;

  if (window === 'custom' && customTime) {
    const [hours, minutes] = customTime.split(':').map(Number);
    targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);
  } else {
    // Default times for windows
    const windowTimes = {
      morning: { hour: 8, minute: 0 },
      afternoon: { hour: 14, minute: 0 },
      evening: { hour: 19, minute: 0 },
    };

    const time = windowTimes[window as keyof typeof windowTimes] || windowTimes.afternoon;
    targetTime = new Date(now);
    targetTime.setHours(time.hour, time.minute, 0, 0);
    
    // Add random variance of ±30 minutes for natural distribution
    const variance = Math.floor(Math.random() * 61) - 30;
    targetTime.setMinutes(targetTime.getMinutes() + variance);
  }

  // If the time has already passed today, schedule for tomorrow
  if (targetTime < now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime.toISOString();
}
