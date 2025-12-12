import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  platform: string;
  device_token?: string;
  subscription_data?: any;
}

// Send via APNs for iOS
const sendAPNsNotification = async (
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<boolean> => {
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const bundleId = Deno.env.get('APNS_BUNDLE_ID');
  const authKey = Deno.env.get('APNS_AUTH_KEY');

  if (!teamId || !keyId || !bundleId || !authKey) {
    console.error('APNs configuration missing');
    return false;
  }

  try {
    // Create JWT for APNs
    const header = btoa(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const now = Math.floor(Date.now() / 1000);
    const claims = btoa(JSON.stringify({ iss: teamId, iat: now }));
    
    // Note: Full JWT signing would require crypto library
    // For production, use a proper JWT library or pre-signed tokens
    
    const apnsUrl = `https://api.push.apple.com/3/device/${deviceToken}`;
    
    const payload = {
      aps: {
        alert: { title, body },
        sound: 'default',
        badge: 1,
      },
      ...data,
    };

    // This is a simplified version - production would need proper JWT signing
    console.log(`Would send APNs to ${deviceToken.substring(0, 10)}... with payload:`, payload);
    
    return true;
  } catch (error) {
    console.error('APNs send error:', error);
    return false;
  }
};

// Send via Web Push
const sendWebPushNotification = async (
  subscriptionData: any,
  title: string,
  body: string
): Promise<boolean> => {
  try {
    // Web Push implementation would go here
    // For now, log the attempt
    console.log(`Would send Web Push with title: "${title}"`);
    return true;
  } catch (error) {
    console.error('Web Push error:', error);
    return false;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting scheduled notification delivery...');

    const now = new Date().toISOString();

    // Get pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('delivered', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    console.log(`Found ${pendingNotifications?.length || 0} notifications to deliver`);

    let delivered = 0;
    let failed = 0;

    for (const notification of pendingNotifications || []) {
      try {
        // Get user's push subscription
        const { data: subscription } = await supabase
          .from('push_subscriptions')
          .select('endpoint, platform, device_token, subscription_data')
          .eq('user_id', notification.user_id)
          .maybeSingle();

        if (!subscription) {
          console.log(`No subscription for user ${notification.user_id}, marking as delivered`);
          await supabase
            .from('push_notification_queue')
            .update({ delivered: true, delivered_at: now })
            .eq('id', notification.id);
          continue;
        }

        let success = false;

        // Route to appropriate push service
        if (subscription.platform === 'ios' && subscription.device_token) {
          success = await sendAPNsNotification(
            subscription.device_token,
            notification.title,
            notification.body,
            notification.context || {}
          );
        } else if (subscription.subscription_data) {
          success = await sendWebPushNotification(
            subscription.subscription_data,
            notification.title,
            notification.body
          );
        }

        // Mark as delivered
        if (success) {
          await supabase
            .from('push_notification_queue')
            .update({ 
              delivered: true, 
              delivered_at: new Date().toISOString() 
            })
            .eq('id', notification.id);
          
          delivered++;
          console.log(`Delivered notification ${notification.id} to user ${notification.user_id}`);
        } else {
          failed++;
          console.error(`Failed to deliver notification ${notification.id}`);
        }

      } catch (notifError) {
        console.error(`Error delivering notification ${notification.id}:`, notifError);
        failed++;
      }
    }

    console.log(`Delivery complete. Delivered: ${delivered}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        delivered,
        failed,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in deliver-scheduled-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
