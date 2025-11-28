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
    const { identityToken, nonce } = await req.json();

    if (!identityToken) {
      throw new Error('Identity token is required');
    }

    if (!nonce) {
      throw new Error('Nonce is required');
    }

    console.log('Validating Apple identity token...');

    // Decode the JWT to get the payload (Apple identity tokens are JWTs)
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid identity token format');
    }

    const payload = JSON.parse(atob(parts[1]));
    console.log('Token payload received:', { 
      aud: payload.aud,
      sub: payload.sub,
      email: payload.email,
      iss: payload.iss
    });

    // Verify issuer is Apple
    if (payload.iss !== 'https://appleid.apple.com') {
      console.error('Invalid issuer:', payload.iss);
      throw new Error('Token issuer is not Apple');
    }

    // Verify audience is either Service ID or Bundle ID
    const serviceId = Deno.env.get('APPLE_SERVICE_ID');
    const bundleId = 'com.darrylgraham.revolution'; // iOS Bundle ID

    const validAudience = 
      payload.aud === serviceId || 
      payload.aud === bundleId;

    if (!validAudience) {
      console.error('Invalid audience:', payload.aud);
      console.error('Expected:', { serviceId, bundleId });
      throw new Error('Token audience does not match expected Service ID or Bundle ID');
    }

    console.log('Audience validated successfully');

    // Verify nonce matches (if present in token)
    if (payload.nonce) {
      // Hash the provided nonce to compare with token nonce
      const encoder = new TextEncoder();
      const data = encoder.encode(nonce);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (payload.nonce !== hashedNonce) {
        console.error('Nonce mismatch');
        throw new Error('Nonce validation failed');
      }
      console.log('Nonce validated successfully');
    }

    // Verify token is not expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Extract email (may not always be present on subsequent sign-ins)
    const email = payload.email;
    if (!email) {
      // On subsequent sign-ins, Apple doesn't always provide email
      // We need to look up the user by their Apple sub ID
      console.log('No email in token, will look up by Apple sub ID');
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists by email or Apple sub ID
    console.log('Looking up user...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Failed to list users:', listError);
      throw new Error('Failed to look up user');
    }

    // Try to find user by email first (if available), then by Apple sub ID in metadata
    let existingUser = null;
    if (email) {
      existingUser = users?.users?.find(u => u.email === email);
      console.log('Looking up by email:', email);
    }
    
    // If not found by email, try to find by Apple sub ID
    if (!existingUser) {
      existingUser = users?.users?.find(u => 
        u.user_metadata?.apple_sub === payload.sub ||
        u.app_metadata?.provider === 'apple' && u.app_metadata?.provider_user_id === payload.sub
      );
      console.log('Looking up by Apple sub:', payload.sub);
    }

    let userId: string;

    if (!existingUser) {
      console.log('User not found, creating new user...');
      
      if (!email) {
        throw new Error('Cannot create new user without email. Email is only provided on first sign-in.');
      }

      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: {
          provider: 'apple',
          apple_sub: payload.sub,
        }
      });

      // Handle race condition: user might have been created between lookup and creation
      if (createError) {
        if (createError.message?.includes('already exists') || createError.message?.includes('duplicate')) {
          console.log('User was created by concurrent request, looking up again...');
          const { data: retryUsers, error: retryError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (retryError) {
            console.error('Failed to retry user lookup:', retryError);
            throw new Error('Failed to create or find user');
          }
          
          const retryUser = retryUsers?.users?.find(u => u.email === email);
          if (!retryUser) {
            console.error('User still not found after race condition');
            throw new Error('Failed to create or find user');
          }
          
          userId = retryUser.id;
          console.log('Found user after race condition:', userId);
        } else {
          console.error('Failed to create user:', createError);
          throw new Error('Failed to create user: ' + createError.message);
        }
      } else if (!newUser.user) {
        throw new Error('Failed to create user: No user returned');
      } else {
        userId = newUser.user.id;
        console.log('New user created:', userId);
      }
    } else {
      userId = existingUser.id;
      console.log('Existing user found:', userId);
      
      // Update user metadata with Apple sub if not already set
      if (!existingUser.user_metadata?.apple_sub || existingUser.user_metadata.apple_sub !== payload.sub) {
        console.log('Updating user metadata with Apple sub');
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingUser.user_metadata,
            apple_sub: payload.sub,
          }
        });
      }
    }

    // Generate magic link for the user
    const userEmail = email || existingUser?.email;
    if (!userEmail) {
      throw new Error('No email available for user');
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
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
    console.error('Error in apple-native-auth:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
