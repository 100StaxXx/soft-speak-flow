import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushError {
  push_id: string;
  error: string;
  attempt?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log("Starting daily quote push dispatch (iOS native)...");

    const now = new Date().toISOString();

    // Get all pending quote pushes that are due
    const { data: pendingPushes, error: fetchError } = await supabase
      .from('user_daily_quote_pushes')
      .select(`
        *,
        daily_quotes!inner (
          id,
          quote_id,
          mentor_slug,
          for_date
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
    let skipped = 0;
    const errors: PushError[] = [];

    for (const push of pendingPushes || []) {
      try {
        console.log(`Dispatching quote push ${push.id} to user ${push.user_id}`);
        
        // Fetch the actual quote using the quote_id from daily_quotes
        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', push.daily_quotes.quote_id)
          .single();

        if (quoteError || !quote) {
          console.error(`No quote found for push ${push.id}:`, quoteError);
          continue;
        }

        // Get user's iOS device tokens
        const { data: deviceTokens, error: tokenError } = await supabase
          .from('push_device_tokens')
          .select('device_token')
          .eq('user_id', push.user_id)
          .eq('platform', 'ios');

        if (tokenError) {
          console.error(`Error fetching device tokens for user ${push.user_id}:`, tokenError);
          errors.push({ push_id: push.id, error: tokenError.message });
          continue;
        }

        if (!deviceTokens || deviceTokens.length === 0) {
          console.log(`No iOS devices for user ${push.user_id}`);
          // Still mark as delivered even if no devices
          await supabase
            .from('user_daily_quote_pushes')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', push.id);
          skipped++;
          continue;
        }

        // Send to all user's iOS devices
        for (const token of deviceTokens) {
          try {
            const { error: sendError } = await supabase.functions.invoke('send-apns-notification', {
              body: {
                deviceToken: token.device_token,
                title: "Your Daily Quote",
                body: `"${quote.text}" - ${quote.author || 'Unknown'}`,
                data: {
                  type: 'daily_quote',
                  quote_id: quote.id,
                  url: '/inspire?tab=quotes'
                }
              }
            });

            if (sendError) {
              console.error(`Failed to send to device:`, sendError);
            } else {
              console.log(`Sent quote push to iOS device`);
            }
          } catch (deviceError) {
            console.error(`Error sending to device:`, deviceError);
          }
        }

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
        skipped,
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
