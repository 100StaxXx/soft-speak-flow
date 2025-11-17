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
    const errors: any[] = [];

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

        // Get user's push subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', push.user_id);

        if (subError) {
          console.error(`Error fetching subscriptions for user ${push.user_id}:`, subError);
          errors.push({ push_id: push.id, error: subError.message });
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`No push subscriptions for user ${push.user_id}`);
          // Still mark as delivered even if no subscriptions
          await supabase
            .from('user_daily_quote_pushes')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', push.id);
          skipped++;
          continue;
        }

        // Send push notification to each subscription
        for (const subscription of subscriptions) {
          try {
            const pushPayload = {
              notification: {
                title: "Your Daily Quote",
                body: `"${quote.text}" - ${quote.author || 'Unknown'}`,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: {
                  url: '/inspire?tab=quotes'
                }
              }
            };

            // Send push notification using Web Push
            const webPushResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY') || ''}`
              },
              body: JSON.stringify({
                to: subscription.endpoint,
                ...pushPayload
              })
            });

            if (!webPushResponse.ok) {
              console.error(`Push notification failed for subscription:`, await webPushResponse.text());
            } else {
              console.log(`Push notification sent successfully`);
            }
          } catch (subError) {
            console.error(`Error sending to subscription:`, subError);
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
