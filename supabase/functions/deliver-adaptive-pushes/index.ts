import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createErrorResponse, logError } from "../_shared/errorHandler.ts";

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

    const now = new Date().toISOString();

    // Fetch due pushes
    const { data: duePushes, error: fetchError } = await supabase
      .from('adaptive_push_queue')
      .select('*')
      .eq('delivered', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      logError(fetchError, "adaptive_push_queue query");
      if (fetchError.code === "42P01") {
        return createErrorResponse(fetchError, req, corsHeaders);
      }
      console.error('Error fetching due pushes:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch pushes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!duePushes || duePushes.length === 0) {
      return new Response(JSON.stringify({ message: 'No due pushes', delivered: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let deliveredCount = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const push of duePushes) {
      // Check rate limits: max 1 per day, max 5 per week
      const { count: dailyCount, error: dailyError } = await supabase
        .from('adaptive_push_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', push.user_id)
        .eq('delivered', true)
        .gte('created_at', oneDayAgo);

      if (dailyError && dailyError.code === "42P01") {
        logError(dailyError, "adaptive_push_queue daily count query");
        continue;
      }

      if ((dailyCount || 0) >= 1) {
        console.log(`User ${push.user_id} hit daily limit, skipping`);
        continue;
      }

      const { count: weeklyCount, error: weeklyError } = await supabase
        .from('adaptive_push_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', push.user_id)
        .eq('delivered', true)
        .gte('created_at', sevenDaysAgo);

      if (weeklyError && weeklyError.code === "42P01") {
        logError(weeklyError, "adaptive_push_queue weekly count query");
        continue;
      }

      if ((weeklyCount || 0) >= 5) {
        console.log(`User ${push.user_id} hit weekly limit, skipping`);
        continue;
      }

      // Mark as delivered
      const { error: updateError } = await supabase
        .from('adaptive_push_queue')
        .update({ delivered: true })
        .eq('id', push.id);

      if (updateError) {
        logError(updateError, "adaptive_push_queue update");
        if (updateError.code === "42P01") {
          continue;
        }
        console.error(`Error marking push ${push.id} as delivered:`, updateError);
        continue;
      }

      // Here you would integrate with your push notification service
      // For now, just log
      console.log(`Delivered push to user ${push.user_id}: ${push.message}`);
      deliveredCount++;

      // Schedule next push for non-event-based frequencies
      const { data: settings, error: settingsError } = await supabase
        .from('adaptive_push_settings')
        .select('*')
        .eq('user_id', push.user_id)
        .eq('enabled', true)
        .single();

      if (settingsError && settingsError.code === "42P01") {
        logError(settingsError, "adaptive_push_settings query");
        continue;
      }

      if (settings && settings.frequency !== 'event_based') {
        await supabase.functions.invoke('schedule-adaptive-pushes', {
          body: { userId: push.user_id, settingsId: settings.id }
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        delivered: deliveredCount,
        total: duePushes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError(error, "deliver-adaptive-pushes edge function");
    return createErrorResponse(error, req, corsHeaders);
  }
});
