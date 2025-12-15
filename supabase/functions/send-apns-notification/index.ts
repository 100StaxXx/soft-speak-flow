import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Strict schema validation for APNs payload
const APNsPayloadSchema = z.object({
  deviceToken: z.string().min(64).max(200).regex(/^[a-fA-F0-9]+$/, 'Invalid device token format'),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  data: z.record(z.any()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  try {
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    if (!internalSecret) {
      throw new Error('INTERNAL_FUNCTION_SECRET is not configured');
    }

    const providedSecret = req.headers.get('x-internal-key');
    
    // Enhanced auth validation with audit logging
    if (providedSecret !== internalSecret) {
      // Log failed authentication attempt (fire-and-forget, non-blocking)
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Use void to ignore the promise result
        void supabase.from('security_audit_log').insert({
          event_type: 'auth_failure',
          function_name: 'send-apns-notification',
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          details: { reason: 'Invalid internal key' },
        });
      }
      
      console.error('Unauthorized access attempt to send-apns-notification');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = APNsPayloadSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Invalid payload:', parseResult.error.errors);
      return new Response(JSON.stringify({ 
        error: 'Invalid payload', 
        details: parseResult.error.errors.map(e => e.message) 
      }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const { deviceToken, title, body, data } = parseResult.data;

    const apnsKeyId = Deno.env.get('APNS_KEY_ID');
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID');
    const apnsBundleId = Deno.env.get('APNS_BUNDLE_ID');
    const apnsKey = Deno.env.get('APNS_AUTH_KEY');
    const apnsEnvironment = Deno.env.get('APNS_ENVIRONMENT') || 'sandbox';

    if (!apnsKeyId || !apnsTeamId || !apnsBundleId || !apnsKey) {
      console.error('Missing APNs configuration');
      throw new Error('APNs not configured. Please add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_AUTH_KEY secrets.');
    }

    const payload = {
      aps: {
        alert: {
          title,
          body
        },
        sound: 'default',
        badge: 1
      },
      ...data
    };

    const jwt = await generateAPNsJWT(apnsKeyId, apnsTeamId, apnsKey);

    const apnsHost = apnsEnvironment === 'production' 
      ? 'api.push.apple.com' 
      : 'api.sandbox.push.apple.com';
    const apnsUrl = `https://${apnsHost}/3/device/${deviceToken}`;
    
    console.log(`Sending push notification to ${apnsEnvironment} APNs`);
    
    const apnsResponse = await fetch(apnsUrl, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': apnsBundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10'
      },
      body: JSON.stringify(payload)
    });

    if (!apnsResponse.ok) {
      const errorText = await apnsResponse.text();
      console.error('APNs error:', errorText);
      throw new Error(`APNs request failed: ${apnsResponse.status} ${errorText}`);
    }

    console.log('Push notification sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Notification sent' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-apns-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function generateAPNsJWT(keyId: string, teamId: string, privateKey: string): Promise<string> {
  const { SignJWT } = await import('https://deno.land/x/jose@v5.2.0/index.ts');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(privateKey), c => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  return jwt;
}
