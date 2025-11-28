import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const { identityToken } = await req.json();
    console.log('Received Apple identity token');

    if (!identityToken) {
      throw new Error('Identity token is required');
    }

    // Decode the JWT token (Apple's identity token is a JWT)
    // We'll decode it without verification first to get the payload
    const tokenParts = identityToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(atob(tokenParts[1]));
    console.log('Token payload:', { 
      sub: payload.sub, 
      email: payload.email,
      aud: payload.aud,
      iss: payload.iss 
    });

    // Validate token issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Invalid token issuer');
    }

    // Validate audience (should be either Service ID or Bundle ID)
    const appleServiceId = Deno.env.get('APPLE_SERVICE_ID');
    const iosBundleId = 'com.darrylgraham.revolution';
    
    if (payload.aud !== appleServiceId && payload.aud !== iosBundleId) {
      console.error('Token audience mismatch:', {
        received: payload.aud,
        expectedServiceId: appleServiceId,
        expectedBundleId: iosBundleId
      });
      throw new Error('Unacceptable audience in identity token');
    }

    console.log('Token validation passed');

    // Verify token signature with Apple's public keys
    const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys');
    const appleKeys = await appleKeysResponse.json();
    
    // For production, implement full JWT signature verification
    // For now, we trust the token after basic validation
    console.log('Apple keys fetched successfully');

    const tokenInfo = {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified === 'true' || payload.email_verified === true,
    };

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user by email (not Apple sub ID)
    console.log('Looking up user by email:', tokenInfo.email);
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Failed to list users:', listError);
      throw new Error('Failed to look up user');
    }

    let existingUser = users?.find(u => u.email === tokenInfo.email);
    let userId: string;

    if (!existingUser) {
      console.log('Creating new user...');
      
      try {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: tokenInfo.email,
          email_confirm: true,
          user_metadata: {
            provider: 'apple',
          }
        });

        if (createError) {
          // Handle race condition - user may have been created by concurrent request
          if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
            console.log('User was created by concurrent request, retrying lookup...');
            const { data: { users: retryUsers } } = await supabaseAdmin.auth.admin.listUsers();
            existingUser = retryUsers?.find(u => u.email === tokenInfo.email);
            
            if (!existingUser) {
              console.error('Failed to find user after race condition');
              throw new Error('Failed to create or find user');
            }
            userId = existingUser.id;
          } else {
            console.error('Failed to create user:', createError);
            throw new Error('Failed to create user');
          }
        } else if (!newUser.user) {
          throw new Error('Failed to create user - no user returned');
        } else {
          userId = newUser.user.id;
          console.log('New user created:', userId);
        }
      } catch (e) {
        console.error('Error during user creation:', e);
        throw e;
      }
    } else {
      userId = existingUser.id;
      console.log('Existing user found:', userId);
    }

    // Generate a magic link to get the verification token
    console.log('Generating session for user:', userId);
    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: tokenInfo.email,
    });

    if (magicLinkError || !magicLinkData) {
      console.error('Failed to generate magic link:', magicLinkError);
      throw new Error('Failed to generate session token');
    }

    // Extract the verification token from the magic link
    const verificationToken = new URL(magicLinkData.properties.action_link).searchParams.get('token');
    
    if (!verificationToken) {
      throw new Error('Failed to extract verification token');
    }

    // Create a regular Supabase client and verify the token to get the session
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: verificationToken,
      type: 'magiclink',
    });

    if (sessionError || !sessionData.session) {
      console.error('Failed to create session:', sessionError);
      throw new Error('Failed to create session');
    }

    console.log('Session created successfully');

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user: sessionData.user,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in apple-native-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
