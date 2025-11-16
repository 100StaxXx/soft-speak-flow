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
    console.log('Starting daily push dispatch...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Get pending pushes that are due
    const { data: pendingPushes, error: fetchError } = await supabase
      .from('user_daily_pushes')
      .select(`
        id,
        user_id,
        daily_pep_talk_id,
        scheduled_at,
        daily_pep_talks (
          title,
          summary,
          audio_url,
          mentor_slug
        )
      `)
      .is('delivered_at', null)
      .lte('scheduled_at', now)
      .limit(100);

    if (fetchError) {
      console.error('Error fetching pending pushes:', fetchError);
      throw fetchError;
    }

    if (!pendingPushes || pendingPushes.length === 0) {
      console.log('No pending pushes to dispatch');
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: 'No pending pushes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingPushes.length} pending pushes`);

    let dispatched = 0;
    const errors = [];

    for (const push of pendingPushes) {
      try {
        // Here you would integrate with your notification system
        // For now, we'll just mark as delivered and log
        
        const pepTalk = Array.isArray(push.daily_pep_talks) ? push.daily_pep_talks[0] : push.daily_pep_talks;
        
        console.log(`Dispatching push ${push.id} to user ${push.user_id}`);
        console.log(`Pep talk: ${pepTalk?.title}`);

        // Mark as delivered
        const { error: updateError } = await supabase
          .from('user_daily_pushes')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', push.id);

        if (updateError) {
          console.error(`Error updating push ${push.id}:`, updateError);
          errors.push({ pushId: push.id, error: updateError.message });
          continue;
        }

        // TODO: Integrate with push notification service
        // await sendPushNotification(push.user_id, {
        //   title: push.daily_pep_talks?.title,
        //   body: push.daily_pep_talks?.summary,
        //   data: {
        //     type: 'daily_pep_talk',
        //     audio_url: push.daily_pep_talks?.audio_url
        //   }
        // });

        dispatched++;
        console.log(`✓ Dispatched push ${push.id}`);

      } catch (error: any) {
        console.error(`Error dispatching push ${push.id}:`, error);
        errors.push({ pushId: push.id, error: error.message });
      }
    }

    console.log(`Dispatch complete. Dispatched: ${dispatched}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        total_pending: pendingPushes.length,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal error in dispatch:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
