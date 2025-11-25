import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendToMultipleSubscriptions, PushSubscription, PushNotificationPayload } from "../_shared/webPush.ts";

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

    // Load VAPID keys for Web Push
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@revolution.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'Push notification system not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        const pepTalk = Array.isArray(push.daily_pep_talks) ? push.daily_pep_talks[0] : push.daily_pep_talks;
        
        console.log(`Dispatching push ${push.id} to user ${push.user_id}`);
        console.log(`Pep talk: ${pepTalk?.title}`);

        // Get user's push subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', push.user_id);

        if (subError) {
          console.error(`Error fetching subscriptions for user ${push.user_id}:`, subError);
          errors.push({ pushId: push.id, error: subError.message });
          continue;
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`No push subscriptions for user ${push.user_id}`);
          // Mark as delivered anyway (user has no devices registered)
          await supabase
            .from('user_daily_pushes')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', push.id);
          dispatched++;
          continue;
        }

        // Prepare notification payload
        const payload: PushNotificationPayload = {
          title: pepTalk?.title || 'Your Daily Pep Talk',
          body: pepTalk?.summary || 'A new message from your mentor',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `pep-talk-${push.daily_pep_talk_id}`,
          data: {
            type: 'daily_pep_talk',
            pep_talk_id: push.daily_pep_talk_id,
            audio_url: pepTalk?.audio_url,
            url: '/pep-talks'
          }
        };

        // Send to all user's devices
        const pushSubscriptions: PushSubscription[] = subscriptions.map(sub => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string }
        }));

        const results = await sendToMultipleSubscriptions(
          pushSubscriptions,
          payload,
          {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
            subject: vapidSubject
          }
        );

        // Remove expired subscriptions
        const expiredSubs = results
          .filter(r => r.result.error === 'SUBSCRIPTION_EXPIRED')
          .map(r => r.subscription.endpoint);

        if (expiredSubs.length > 0) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .in('endpoint', expiredSubs);
          console.log(`Removed ${expiredSubs.length} expired subscriptions`);
        }

        // Check if at least one notification was sent successfully
        const successCount = results.filter(r => r.result.success).length;
        
        if (successCount > 0) {
          // Mark as delivered
          await supabase
            .from('user_daily_pushes')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', push.id);
          dispatched++;
          console.log(`✓ Dispatched push ${push.id} to ${successCount}/${results.length} devices`);
        } else {
          errors.push({ 
            pushId: push.id, 
            error: `Failed to send to all ${results.length} devices` 
          });
        }

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
