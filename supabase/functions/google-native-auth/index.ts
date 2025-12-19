import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@5.8.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create Google JWKS for token verification
const googleJWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);

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

    console.log('Validating Google ID token with jose library...');

    // Get client IDs from environment
    const webClientId = Deno.env.get('GOOGLE_WEB_CLIENT_ID');
    const iosClientId = Deno.env.get('GOOGLE_IOS_CLIENT_ID');

    // Validate client IDs are configured
    if (!webClientId && !iosClientId) {
      console.error('Missing Google Client ID secrets. Set GOOGLE_WEB_CLIENT_ID and GOOGLE_IOS_CLIENT_ID via `supabase secrets set`');
      throw new Error('Google OAuth not configured - missing client IDs');
    }

    // Build valid audiences array
    const validAudiences: string[] = [];
    if (webClientId) validAudiences.push(webClientId);
    if (iosClientId) validAudiences.push(iosClientId);

    // Verify JWT with Google's JWKS - this automatically validates:
    // - exp (expiration)
    // - iat (issued at)
    // - signature
    // - issuer
    // - audience
    let payload;
    try {
      const result = await jwtVerify(idToken, googleJWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: validAudiences,
      });
      payload = result.payload;
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      throw new Error('Invalid or expired Google ID token');
    }

    // Additional timestamp validation for defense-in-depth
    const now = Math.floor(Date.now() / 1000);
    
    // Ensure token is not too old (max 10 minutes since issued)
    if (payload.iat && (now - (payload.iat as number)) > 600) {
      console.error('Token issued too long ago:', now - (payload.iat as number), 'seconds');
      throw new Error('Token issued too long ago');
    }

    console.log('Token verified successfully:', { 
      aud: payload.aud, 
      email: payload.email,
      sub: payload.sub,
      iss: payload.iss
    });

    const tokenInfo = {
      email: payload.email as string,
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
      sub: payload.sub as string,
    };

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user by email with pagination
    console.log('Looking up user by email:', tokenInfo.email);
    let existingUser = null;
    let page = 1;
    const perPage = 1000;

    // Paginate through users to find by email
    while (!existingUser) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (listError) {
        console.error('Failed to list users:', listError);
        throw new Error('Failed to look up user');
      }

      if (!users || users.length === 0) {
        break; // No more users to check
      }

      existingUser = users.find(u => u.email?.toLowerCase() === tokenInfo.email?.toLowerCase());
      
      if (users.length < perPage) {
        break; // Last page
      }
      page++;
    }
    let userId: string;

    if (!existingUser) {
      console.log('Creating new user...');
      
      try {
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
    const tokenHash = url.searchParams.get('token_hash') ?? url.searchParams.get('token');
    const type = url.searchParams.get('type') || 'magiclink';

    if (!tokenHash) {
      throw new Error('Failed to extract token hash from magic link');
    }

    console.log('Token extracted, verifying OTP...');

    // Create a client (not admin) to verify OTP and get session
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
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

  } catch (error) {
    console.error('Error in google-native-auth:', error);
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
