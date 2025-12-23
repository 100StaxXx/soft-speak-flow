import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getShoutByKey } from "../_shared/shoutMessages.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface ShoutNotificationPayload {
  shoutId: string;
  senderId: string;
  recipientId?: string;
  epicId?: string;
  communityId?: string;
  senderName?: string;
  shoutType?: string;
  messageText?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: ShoutNotificationPayload = await req.json();

    if (payload.senderId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: shout, error: shoutError } = await supabase
      .from('guild_shouts')
      .select('sender_id, recipient_id, epic_id, community_id, shout_type, message_key')
      .eq('id', payload.shoutId)
      .single();

    if (shoutError || !shout) {
      throw shoutError ?? new Error('Shout not found');
    }

    if (shout.sender_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientId = shout.recipient_id;
    const epicId = shout.epic_id;
    const communityId = shout.community_id;
    const shoutType = shout.shout_type;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, onboarding_data')
      .eq('id', user.id)
      .maybeSingle();

    // Get display name from onboarding_data or email
    const onboardingData = profile?.onboarding_data as Record<string, unknown> | null;
    const userName = onboardingData?.userName as string | undefined;
    const senderName = userName || (profile?.email ? profile.email.split('@')[0] : 'A guild member');
    
    const shoutMessage = getShoutByKey(shout.message_key);
    const messageText = shoutMessage?.text || payload.messageText || 'Someone sent you a shout!';
    const messageEmoji = shoutMessage?.emoji || '📢';

    console.log(`Processing shout notification from ${user.id} to ${recipientId} (epic: ${epicId}, community: ${communityId})`);

    // Check if recipient has muted the sender
    let muteQuery = supabase
      .from('muted_guild_users')
      .select('id')
      .eq('user_id', recipientId)
      .eq('muted_user_id', user.id)
      .limit(1);

    // Filter by context (epic or community)
    if (epicId) {
      muteQuery = muteQuery.or(`epic_id.eq.${epicId},epic_id.is.null`);
    } else if (communityId) {
      muteQuery = muteQuery.or(`community_id.eq.${communityId},community_id.is.null`);
    }

    const { data: muteCheck } = await muteQuery;

    if (muteCheck && muteCheck.length > 0) {
      console.log(`Recipient ${recipientId} has muted sender ${user.id}, skipping notification`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'muted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: 1 push per sender per recipient per context per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let rateLimitQuery = supabase
      .from('shout_push_log')
      .select('id')
      .eq('sender_id', user.id)
      .eq('recipient_id', recipientId)
      .gte('sent_at', today.toISOString())
      .limit(1);

    // Filter by context
    if (epicId) {
      rateLimitQuery = rateLimitQuery.eq('epic_id', epicId);
    } else if (communityId) {
      rateLimitQuery = rateLimitQuery.eq('community_id', communityId);
    }

    const { data: recentPush } = await rateLimitQuery;

    if (recentPush && recentPush.length > 0) {
      console.log(`Rate limit: Already sent push from ${user.id} to ${recipientId} today for this context`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'rate_limited' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient's device tokens
    const { data: deviceTokens } = await supabase
      .from('push_device_tokens')
      .select('device_token, platform')
      .eq('user_id', recipientId);

    if (!deviceTokens || deviceTokens.length === 0) {
      console.log(`No device tokens found for recipient ${recipientId}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_device_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ token: string; platform: string; success: boolean; error?: string }> = [];

    for (const { device_token, platform } of deviceTokens) {
      try {
        // Currently only iOS is supported via APNs
        if (platform !== 'ios') {
          console.log(`Skipping unsupported platform: ${platform}`);
          results.push({ token: device_token, platform, success: false, error: 'unsupported_platform' });
          continue;
        }

        const { error } = await supabase.functions.invoke('send-apns-notification', {
          body: {
            deviceToken: device_token,
            title: `${messageEmoji} Guild Shout from ${senderName}`,
            body: messageText,
            data: {
              type: 'guild_shout',
              epicId: epicId || null,
              communityId: communityId || null,
              shoutType,
            },
          },
          headers: {
            'x-internal-key': internalSecret,
          },
        });

        if (error) {
          console.error(`Failed to send push to token ${device_token}:`, error);
          results.push({ token: device_token, platform, success: false, error: error.message });
        } else {
          results.push({ token: device_token, platform, success: true });
        }
      } catch (err) {
        console.error(`Error sending push to token ${device_token}:`, err);
        results.push({ token: device_token, platform, success: false, error: String(err) });
      }
    }

    // Log successful push for rate limiting
    const anySuccess = results.some(r => r.success);
    if (anySuccess) {
      const logData: Record<string, unknown> = {
        sender_id: user.id,
        recipient_id: recipientId,
      };
      
      if (epicId) {
        logData.epic_id = epicId;
      }
      if (communityId) {
        logData.community_id = communityId;
      }

      await supabase
        .from('shout_push_log')
        .insert(logData);
    }

    console.log(`Shout notification results:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-shout-notification:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});