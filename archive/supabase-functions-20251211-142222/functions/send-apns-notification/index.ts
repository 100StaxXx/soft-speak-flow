import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
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
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
    if (!internalSecret) {
      throw new Error('INTERNAL_FUNCTION_SECRET is not configured');
    }

    const providedSecret = req.headers.get('x-internal-key');
    if (providedSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { deviceToken, title, body, data } = await req.json() as APNsPayload;

    if (!deviceToken || !title || !body) {
      throw new Error('Missing required fields: deviceToken, title, body');
    }

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
    
    console.log(`Sending push notification to ${apnsEnvironment} APNs:`, deviceToken);
    
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
