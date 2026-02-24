import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
if (!internalSecret) {
  throw new Error('INTERNAL_FUNCTION_SECRET is not configured');
}

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching pending native push notifications...');

    const now = new Date().toISOString();
    const { data: pendingPushes, error: fetchError } = await supabaseClient
      .from('user_daily_pushes')
      .select('*')
      .eq('delivered', false)
      .lte('scheduled_for', now);

    if (fetchError) {
      console.error('Error fetching pending pushes:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingPushes?.length || 0} pending pushes`);

    const results = [];
    const errors = [];

    for (const push of pendingPushes || []) {
      try {
        const { data: deviceTokens, error: tokenError } = await supabaseClient
          .from('push_device_tokens')
          .select('device_token')
          .eq('user_id', push.user_id)
          .eq('platform', 'ios');

        if (tokenError || !deviceTokens || deviceTokens.length === 0) {
          console.log(`No device tokens found for user ${push.user_id}`);
          continue;
        }

        for (const { device_token } of deviceTokens) {
          try {
            const { error: sendError } = await supabaseClient.functions.invoke(
              'send-apns-notification',
              {
                body: {
                  deviceToken: device_token,
                  title: push.title || 'Daily Pep Talk 🎯',
                  body: push.summary || 'Your daily motivation is ready!',
                  data: {
                    url: '/pep-talks',
                    pepTalkId: push.pep_talk_id
                  }
                },
                headers: {
                  'x-internal-key': internalSecret,
                }
              }
            );

            if (sendError) {
              console.error('Error sending to device:', device_token, sendError);
              errors.push({ userId: push.user_id, error: String(sendError) });
            } else {
              console.log('Notification sent to device:', device_token);
            }
          } catch (sendError) {
            console.error('Error sending notification:', sendError);
            errors.push({ userId: push.user_id, error: sendError instanceof Error ? sendError.message : String(sendError) });
          }
        }

        const { error: updateError } = await supabaseClient
          .from('user_daily_pushes')
          .update({ delivered: true, delivered_at: new Date().toISOString() })
          .eq('id', push.id);

        if (updateError) {
          console.error('Error marking push as delivered:', updateError);
        } else {
          results.push({ userId: push.user_id, success: true });
        }

      } catch (error) {
        console.error('Error processing push:', error);
        errors.push({ userId: push.user_id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    console.log(`Dispatched ${results.length} notifications with ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dispatched: results.length,
        errors: errors.length,
        details: { results, errors }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in dispatch-daily-pushes-native:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
