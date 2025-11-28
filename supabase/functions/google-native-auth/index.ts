import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken } = await req.json();

    if (!idToken) {
      throw new Error('ID token is required');
    }

    console.log('Validating Google ID token...');

    // Validate token with Google
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!tokenInfoResponse.ok) {
      const error = await tokenInfoResponse.text();
      console.error('Google token validation failed:', error);
      throw new Error('Invalid Google ID token');
    }

    const tokenInfo = await tokenInfoResponse.json();
    console.log('Token info received:', { 
      aud: tokenInfo.aud, 
      email: tokenInfo.email,
      sub: tokenInfo.sub 
    });

    // Verify audience is either Web or iOS Client ID
    const webClientId = Deno.env.get('VITE_GOOGLE_WEB_CLIENT_ID');
    const iosClientId = Deno.env.get('VITE_GOOGLE_IOS_CLIENT_ID');

    const validAudience = 
      tokenInfo.aud === webClientId || 
      tokenInfo.aud === iosClientId;

    if (!validAudience) {
      console.error('Invalid audience:', tokenInfo.aud);
      throw new Error('Token audience does not match expected client IDs');
    }

    console.log('Audience validated successfully');

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists
    const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(tokenInfo.sub);

    let userId: string;

    if (userError || !existingUser.user) {
      console.log('Creating new user...');
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: tokenInfo.email,
        email_confirm: true,
        user_metadata: {
          provider: 'google',
          full_name: tokenInfo.name,
          avatar_url: tokenInfo.picture,
        }
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        throw new Error('Failed to create user');
      }

      userId = newUser.user.id;
      console.log('New user created:', userId);
    } else {
      userId = existingUser.user.id;
      console.log('Existing user found:', userId);
    }

    // Generate magic link for the user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: tokenInfo.email,
    });

    if (linkError || !linkData) {
      console.error('Failed to generate magic link:', linkError);
      throw new Error('Failed to generate magic link');
    }

    console.log('Magic link generated, extracting token...');

    // Extract token from the magic link URL
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type') || 'magiclink';

    if (!token) {
      throw new Error('Failed to extract token from magic link');
    }

    console.log('Token extracted, verifying OTP...');

    // Create a client (not admin) to verify OTP and get session
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      token_hash: token,
      type: type as any,
    });

    if (verifyError || !verifyData.session) {
      console.error('Failed to verify OTP:', verifyError);
      throw new Error('Failed to create session');
    }

    console.log('Session created successfully');

    return new Response(
      JSON.stringify({
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        user: verifyData.user,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in google-native-auth:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
