import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (!auth.isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log('Starting daily push scheduling...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    const todayDate = today.toLocaleDateString('en-CA');
    console.log(`Scheduling pushes for date: ${todayDate}`);

    // Get all users with daily pushes enabled
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, selected_mentor_id, daily_push_enabled, daily_push_window, daily_push_time, timezone')
      .eq('daily_push_enabled', true)
      .not('selected_mentor_id', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users with daily pushes enabled');
      return new Response(
        JSON.stringify({ success: true, scheduled: 0, message: 'No users to schedule for' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${profiles.length} users with daily pushes enabled`);

    let scheduled = 0;
    const errors = [];

    for (const profile of profiles) {
      try {
        // Get mentor slug from mentor_id
        const { data: mentor, error: mentorError } = await supabase
          .from('mentors')
          .select('slug')
          .eq('id', profile.selected_mentor_id)
          .maybeSingle();

        if (mentorError || !mentor) {
          console.error(`Error fetching mentor for user ${profile.id}:`, mentorError);
          errors.push({ userId: profile.id, error: 'Mentor not found' });
          continue;
        }

        // Get today's daily pep talk for this mentor
        const { data: dailyPepTalk, error: pepTalkError } = await supabase
          .from('daily_pep_talks')
          .select('id')
          .eq('mentor_slug', mentor.slug)
          .eq('for_date', todayDate)
          .maybeSingle();

        if (pepTalkError || !dailyPepTalk) {
          console.error(`No daily pep talk found for ${mentor.slug} on ${todayDate}`);
          errors.push({ userId: profile.id, error: 'No pep talk available' });
          continue;
        }

        // Check if already scheduled
        const { data: existing, error: existingError } = await supabase
          .from('user_daily_pushes')
          .select('id')
          .eq('user_id', profile.id)
          .eq('daily_pep_talk_id', dailyPepTalk.id)
          .maybeSingle();

        if (existing) {
          console.log(`Already scheduled for user ${profile.id}`);
          continue;
        }

        // Calculate scheduled time
        const scheduledAt = calculateScheduledTime(
          profile.daily_push_window || 'morning',
          profile.daily_push_time || '08:00',
          profile.timezone || 'UTC'
        );

        // Insert into user_daily_pushes
        const { error: insertError } = await supabase
          .from('user_daily_pushes')
          .insert({
            user_id: profile.id,
            daily_pep_talk_id: dailyPepTalk.id,
            scheduled_at: scheduledAt
          });

        if (insertError) {
          console.error(`Error scheduling push for user ${profile.id}:`, insertError);
          errors.push({ userId: profile.id, error: insertError.message });
          continue;
        }

        scheduled++;
        console.log(`✓ Scheduled push for user ${profile.id} at ${scheduledAt}`);

      } catch (error) {
        console.error(`Error processing user ${profile.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ userId: profile.id, error: errorMessage });
      }
    }

    console.log(`Scheduling complete. Scheduled: ${scheduled}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled,
        total_users: profiles.length,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Fatal error in scheduling:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateScheduledTime(window: string, time: string, timezone: string): string {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  // Create scheduled time for today
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  // Handle time windows with random offset
  let offsetMinutes = 0;
  switch (window) {
    case 'morning': // 6am-10am
      offsetMinutes = Math.floor(Math.random() * 240); // 0-240 minutes
      break;
    case 'afternoon': // 12pm-4pm
      offsetMinutes = Math.floor(Math.random() * 240);
      break;
    case 'evening': // 6pm-9pm
      offsetMinutes = Math.floor(Math.random() * 180);
      break;
    case 'custom':
      // Use exact time specified
      break;
  }

  scheduled.setMinutes(scheduled.getMinutes() + offsetMinutes);

  return scheduled.toISOString();
}
