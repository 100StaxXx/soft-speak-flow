import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface APNsPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { deviceToken, title, body, data } = await req.json() as APNsPayload;

    if (!deviceToken || !title || !body) {
      throw new Error('Missing required fields: deviceToken, title, body');
    }

    // APNs configuration
    const apnsKeyId = Deno.env.get('APNS_KEY_ID');
    const apnsTeamId = Deno.env.get('APNS_TEAM_ID');
    const apnsBundleId = Deno.env.get('APNS_BUNDLE_ID');
    const apnsKey = Deno.env.get('APNS_AUTH_KEY');

    if (!apnsKeyId || !apnsTeamId || !apnsBundleId || !apnsKey) {
      console.error('Missing APNs configuration');
      throw new Error('APNs not configured. Please add APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, and APNS_AUTH_KEY secrets.');
    }

    // Construct APNs payload
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

    // Generate JWT for APNs authentication
    const jwt = await generateAPNsJWT(apnsKeyId, apnsTeamId, apnsKey);

    // Send to APNs
    const apnsUrl = `https://api.push.apple.com/3/device/${deviceToken}`;
    
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

    console.log('Push notification sent successfully to:', deviceToken);

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
  // Import jose for JWT generation
  const { SignJWT } = await import('https://deno.land/x/jose@v5.2.0/index.ts');

  // Parse the private key (P8 format)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(privateKey), c => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Create JWT
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  return jwt;
}
