import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShoutNotificationPayload {
  shoutId: string;
  senderId: string;
  recipientId: string;
  epicId: string;
  senderName: string;
  shoutType: string;
  messageText: string;
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

    const payload: ShoutNotificationPayload = await req.json();
    const { senderId, recipientId, epicId, senderName, shoutType, messageText } = payload;

    console.log(`Processing shout notification from ${senderId} to ${recipientId}`);

    // Check if recipient has muted sender
    const { data: muteCheck } = await supabase
      .from('muted_guild_users')
      .select('id')
      .eq('user_id', recipientId)
      .eq('muted_user_id', senderId)
      .or(`epic_id.eq.${epicId},epic_id.is.null`)
      .limit(1);

    if (muteCheck && muteCheck.length > 0) {
      console.log(`Recipient ${recipientId} has muted sender ${senderId}, skipping notification`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'muted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit: 1 push per sender per recipient per epic per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: recentPush } = await supabase
      .from('shout_push_log')
      .select('id')
      .eq('sender_id', senderId)
      .eq('recipient_id', recipientId)
      .eq('epic_id', epicId)
      .gte('sent_at', today.toISOString())
      .limit(1);

    if (recentPush && recentPush.length > 0) {
      console.log(`Rate limit: Already sent push from ${senderId} to ${recipientId} today`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'rate_limited' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient's device tokens
    const { data: deviceTokens } = await supabase
      .from('push_device_tokens')
      .select('device_token')
      .eq('user_id', recipientId)
      .eq('platform', 'ios');

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log(`No device tokens found for recipient ${recipientId}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_device_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notification to each device
    const typeEmojis: Record<string, string> = {
      hype: '🔥',
      challenge: '⚔️',
      support: '💪',
      taunt: '😈',
    };
    const emoji = typeEmojis[shoutType] || '📢';

    const results: Array<{ token: string; success: boolean; error?: string }> = [];

    for (const { device_token } of deviceTokens) {
      try {
        const { error } = await supabase.functions.invoke('send-apns-notification', {
          body: {
            deviceToken: device_token,
            title: `${emoji} Guild Shout from ${senderName}`,
            body: messageText,
            data: {
              type: 'guild_shout',
              epicId,
              shoutType,
            },
          },
        });

        if (error) {
          console.error(`Failed to send push to token ${device_token}:`, error);
          results.push({ token: device_token, success: false, error: error.message });
        } else {
          results.push({ token: device_token, success: true });
        }
      } catch (err) {
        console.error(`Error sending push to token ${device_token}:`, err);
        results.push({ token: device_token, success: false, error: String(err) });
      }
    }

    // Log the push (for rate limiting)
    const anySuccess = results.some(r => r.success);
    if (anySuccess) {
      await supabase
        .from('shout_push_log')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          epic_id: epicId,
        });
    }

    console.log(`Shout notification results:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-shout-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
