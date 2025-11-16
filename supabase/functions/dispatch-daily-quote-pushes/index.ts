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

    console.log("Starting daily quote push dispatch...");

    const now = new Date().toISOString();

    // Get all pending quote pushes that are due
    const { data: pendingPushes, error: fetchError } = await supabase
      .from('user_daily_quote_pushes')
      .select(`
        *,
        daily_quotes:daily_quote_id (
          *,
          quotes:quote_id (*)
        )
      `)
      .lte('scheduled_at', now)
      .is('delivered_at', null);

    if (fetchError) {
      console.error("Error fetching pending pushes:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingPushes?.length || 0} quote pushes to dispatch`);

    let dispatched = 0;
    const errors: any[] = [];

    for (const push of pendingPushes || []) {
      try {
        console.log(`Dispatching quote push ${push.id} to user ${push.user_id}`);
        
        // TODO: Integrate with actual push notification service
        // For now, we'll just log that it was dispatched
        // In a real implementation, this would call your push notification provider
        
        const quote = push.daily_quotes?.quotes;
        console.log(`Quote: "${quote?.text}" - ${quote?.author || 'Unknown'}`);

        // Mark as delivered
        const { error: updateError } = await supabase
          .from('user_daily_quote_pushes')
          .update({ delivered_at: new Date().toISOString() })
          .eq('id', push.id);

        if (updateError) {
          console.error(`Error updating push ${push.id}:`, updateError);
          errors.push({ push_id: push.id, error: updateError.message });
          continue;
        }

        dispatched++;
        console.log(`Successfully dispatched quote push ${push.id}`);
      } catch (error) {
        console.error(`Error dispatching push ${push.id}:`, error);
        errors.push({ push_id: push.id, error: String(error) });
      }
    }

    console.log(`Quote push dispatch complete. Dispatched: ${dispatched}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        errors: errors.length > 0 ? errors : undefined,
        total: pendingPushes?.length || 0,
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
