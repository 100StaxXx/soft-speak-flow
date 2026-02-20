import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppleUserMetadata = {
  apple_user_id?: string;
  [key: string]: unknown;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: AppleUserMetadata | null;
};

class AppleAuthError extends Error {
  code: string;
  
  constructor(message: string, code = 'APPLE_NATIVE_AUTH_ERROR') {
    super(message);
    this.code = code;
  }
}

// Cache Apple's JWKS. jose handles caching + kid selection internally.
const appleJWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const sha256Hex = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identityToken, rawNonce } = await req.json();
    console.log('Received Apple identity token');

    if (!identityToken) {
      throw new Error('Identity token is required');
    }

    if (!rawNonce) {
      throw new AppleAuthError('Nonce is required for Apple native auth', 'APPLE_NONCE_MISSING');
    }

    const appleServiceId = Deno.env.get('APPLE_SERVICE_ID');
    const iosBundleId = 'com.darrylgraham.revolution';

    if (!appleServiceId) {
      console.error('Missing APPLE_SERVICE_ID secret. Set it via `supabase secrets set APPLE_SERVICE_ID="com.darrylgraham.revolution.web"`');
      throw new Error('Apple OAuth not configured - missing APPLE_SERVICE_ID secret');
    }

    // Fully verify the identity token signature/claims with Apple's JWKS
    const { payload } = await jwtVerify(identityToken, appleJWKS, {
      issuer: 'https://appleid.apple.com',
      audience: [appleServiceId, iosBundleId],
    });

    const tokenNonce = typeof payload.nonce === "string" ? payload.nonce : null;
    if (!tokenNonce) {
      throw new AppleAuthError('Apple token missing nonce claim', 'APPLE_NONCE_MISSING');
    }

    const expectedNonce = await sha256Hex(rawNonce);
    if (tokenNonce !== expectedNonce) {
      console.error('Apple token nonce mismatch', {
        tokenNoncePrefix: tokenNonce.substring(0, 12),
        expectedNoncePrefix: expectedNonce.substring(0, 12),
      });
      throw new AppleAuthError('Apple token nonce validation failed', 'APPLE_NONCE_MISMATCH');
    }

    if (!payload.email) {
      console.warn('Apple token missing email claim; falling back to Apple ID lookup');
    }

    const tokenInfo = {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      email_verified: payload.email_verified === 'true' || payload.email_verified === true,
    };

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const fetchUser = async (matchFn: (user: SupabaseAuthUser) => boolean) => {
      let page = 1;
      const perPage = 1000;

      while (true) {
        const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error('Failed to list users:', listError);
          throw new AppleAuthError('Failed to look up user', 'APPLE_USER_LOOKUP_FAILED');
        }

        const users = data?.users ?? [];

        if (!users.length) {
          break;
        }

        const match = users.find(matchFn);
        if (match) {
          return match as SupabaseAuthUser;
        }

        if (users.length < perPage) {
          break;
        }

        page++;
      }

      return null;
    };

    let existingUser: SupabaseAuthUser | null = null;

    if (tokenInfo.email) {
      console.log('Looking up user by email:', tokenInfo.email);
      existingUser = await fetchUser(u => u.email?.toLowerCase() === tokenInfo.email?.toLowerCase());
    }

    if (!existingUser) {
      console.log('Looking up user by Apple ID sub:', tokenInfo.sub);
      existingUser = await fetchUser(u => u.user_metadata?.apple_user_id === tokenInfo.sub);
    }

    let userId: string;
    let userEmail: string | null = null;

    if (!existingUser) {
      console.log('No existing user found');
      
      if (!tokenInfo.email) {
        throw new AppleAuthError(
          'Apple did not share an email address for this account. Remove Revolution from Settings → Apple ID → Password & Security → Sign in with Apple, then try again.',
          'APPLE_EMAIL_MISSING'
        );
      }

      const normalizedEmail = tokenInfo.email.toLowerCase();
      console.log('Creating new user with email:', normalizedEmail);
      
      try {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            provider: 'apple',
            apple_user_id: tokenInfo.sub,
          }
        });

        if (createError) {
          if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
            console.log('User was created by concurrent request, retrying lookup...');
            const retryUser = await fetchUser(u => u.email?.toLowerCase() === normalizedEmail);
            
            if (!retryUser) {
              console.error('Failed to find user after race condition');
              throw new AppleAuthError('Failed to create or find user', 'APPLE_USER_CREATE_FAILED');
            }
            userId = retryUser.id;
            userEmail = retryUser.email?.toLowerCase() ?? null;
            existingUser = retryUser;
          } else {
            console.error('Failed to create user:', createError);
            throw new AppleAuthError('Failed to create user', 'APPLE_USER_CREATE_FAILED');
          }
        } else if (!newUser?.user) {
          throw new AppleAuthError('Failed to create user - no user returned', 'APPLE_USER_CREATE_FAILED');
        } else {
          userId = newUser.user.id;
          userEmail = normalizedEmail;
          console.log('New user created:', userId);
        }
      } catch (e) {
        console.error('Error during user creation:', e);
        throw e;
      }
    } else {
      userId = existingUser.id;
      userEmail = existingUser.email?.toLowerCase() ?? null;
      console.log('Existing user found:', userId);

      if (existingUser.user_metadata?.apple_user_id !== tokenInfo.sub) {
        console.log('Linking Apple ID to existing user metadata');
        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            apple_user_id: tokenInfo.sub,
          }
        });

        if (metadataError) {
          console.error('Failed to update user metadata:', metadataError);
          throw new AppleAuthError('Failed to link Apple ID to user account', 'APPLE_METADATA_UPDATE_FAILED');
        }
      }
    }

    if (!userEmail) {
      throw new AppleAuthError(
        'Unable to determine the email associated with this Apple ID. Please contact support.',
        'APPLE_ACCOUNT_EMAIL_MISSING'
      );
    }

    // Generate a magic link to get the verification token
    console.log('Generating session for user:', userId);
    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (magicLinkError || !magicLinkData) {
      console.error('Failed to generate magic link:', magicLinkError);
      throw new Error('Failed to generate session token');
    }

    // Extract the verification token from the magic link
    const actionLink = new URL(magicLinkData.properties.action_link);
    const verificationToken = actionLink.searchParams.get('token_hash') ?? actionLink.searchParams.get('token');
    const verificationType = actionLink.searchParams.get('type') || 'magiclink';
    
    if (!verificationToken) {
      throw new Error('Failed to extract verification token hash');
    }

    // Create a regular Supabase client and verify the token to get the session
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom verification type from native auth flow
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: verificationToken,
      type: verificationType as any,
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
    const errorCode = error instanceof AppleAuthError ? error.code : 'APPLE_NATIVE_AUTH_ERROR';
    return new Response(
      JSON.stringify({ error: errorMessage, code: errorCode }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
