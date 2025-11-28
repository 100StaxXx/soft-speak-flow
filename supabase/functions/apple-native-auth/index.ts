/**
 * Apple Native Authentication Edge Function
 * 
 * NOTE: This edge function is currently NOT used by the frontend.
 * The frontend uses Supabase's built-in signInWithIdToken for Apple Sign-In (Auth.tsx line 277).
 * This function is kept as a reference implementation for custom Apple authentication.
 * 
 * Current Apple Sign-In Flow:
 * 1. Frontend gets identity token from Apple via @capacitor-community/apple-sign-in
 * 2. Frontend calls supabase.auth.signInWithIdToken() with the token
 * 3. Supabase validates the token with Apple directly
 * 4. User is authenticated
 * 
 * If you need to use this custom edge function instead:
 * 1. Complete the JWT signature verification (see TODO at line 62)
 * 2. Update Auth.tsx to call this function instead of signInWithIdToken
 * 3. Deploy this function: npx supabase functions deploy apple-native-auth
 */

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
    
    // TODO: Complete JWT signature verification before using this function in production
    // The keys are fetched but signature is not verified. See AUTH_LOGIN_QUICK_FIXES.md
    // for implementation details. This is safe for now since this function is not used.
    // The frontend uses Supabase's built-in signInWithIdToken which handles verification.
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
