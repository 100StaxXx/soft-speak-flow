import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";
import {
  applyAbuseProtection,
  createAbuseAdminClient,
  createSafeErrorResponse,
  getClientIpAddress,
} from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

type SocialAuthIntent = "sign_in" | "sign_up";

type AppleUserMetadata = {
  apple_user_id?: string;
  provider?: string;
  [key: string]: unknown;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: AppleUserMetadata | null;
};

type AppleNativeAuthRequest = {
  identityToken?: string;
  rawNonce?: string;
  intent?: SocialAuthIntent;
};

type AdminClientLike = any;

type AnonClientLike = any;

type AppleNativeAuthDeps = {
  createAdminClient: (supabaseUrl: string, serviceKey: string) => AdminClientLike;
  createAnonClient: (supabaseUrl: string, anonKey: string) => AnonClientLike;
  verifyIdentityToken: (
    identityToken: string,
    appleServiceId: string,
    iosBundleId: string,
  ) => Promise<Record<string, unknown>>;
  sha256HexFn: (value: string) => Promise<string>;
  applyAbuseProtectionFn: (...args: any[]) => Promise<Response | { requestId: string; ipAddress: string | null; protection: unknown }>;
};

const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

function jsonSuccess(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

const sha256Hex = async (value: string): Promise<string> => {
  const encoded = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const defaultDeps: AppleNativeAuthDeps = {
  createAdminClient: (supabaseUrl: string, serviceKey: string) =>
    createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
  createAnonClient: (supabaseUrl: string, anonKey: string) =>
    createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
  verifyIdentityToken: async (identityToken: string, appleServiceId: string, iosBundleId: string) => {
    const verification = await jwtVerify(identityToken, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: [appleServiceId, iosBundleId],
    });
    return verification.payload as Record<string, unknown>;
  },
  sha256HexFn: sha256Hex,
  applyAbuseProtectionFn: applyAbuseProtection,
};

const resolveIntent = (intent: SocialAuthIntent | undefined): SocialAuthIntent =>
  intent === "sign_in" || intent === "sign_up" ? intent : "sign_up";

const getAppleAccountNotFoundResponse = (req: Request, requestId: string): Response =>
  createSafeErrorResponse(req, {
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
    error: "We couldn't find an existing account for this Apple sign-in.",
    requestId,
  });

export async function handleAppleNativeAuth(
  req: Request,
  deps: AppleNativeAuthDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const requestId = crypto.randomUUID();
  const ipAddress = getClientIpAddress(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appleServiceId = Deno.env.get("APPLE_SERVICE_ID");
    const iosBundleId = "com.darrylgraham.revolution";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !appleServiceId) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "APPLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Apple right now.",
        requestId,
      });
    }

    const preAuthProtection = await deps.applyAbuseProtectionFn(req, createAbuseAdminClient(), {
      profileKey: "auth.sign_in",
      endpointName: "apple-native-auth",
      requestId,
      ipAddress,
      blockedMessage: "Too many sign-in attempts. Please try again later.",
      metadata: {
        flow: "apple_native_auth",
        phase: "pre_auth",
      },
    });

    if (preAuthProtection instanceof Response) {
      return preAuthProtection;
    }

    const { identityToken, rawNonce, intent: rawIntent } = await req.json() as AppleNativeAuthRequest;
    const intent = resolveIntent(rawIntent);

    if (!identityToken) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple.",
        requestId,
      });
    }

    if (!rawNonce) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "APPLE_NONCE_MISSING",
        error: "Apple Sign-In security verification failed. Please try again.",
        requestId,
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = await deps.verifyIdentityToken(identityToken, appleServiceId, iosBundleId);
    } catch (jwtError) {
      console.error("[apple-native-auth] JWT verification failed", jwtError);
      return createSafeErrorResponse(req, {
        status: 401,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple.",
        requestId,
      });
    }

    const tokenNonce = typeof payload.nonce === "string" ? payload.nonce : null;
    if (!tokenNonce) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "APPLE_NONCE_MISSING",
        error: "Apple Sign-In security verification failed. Please try again.",
        requestId,
      });
    }

    const expectedNonce = await deps.sha256HexFn(rawNonce);
    if (tokenNonce !== expectedNonce) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "APPLE_NONCE_MISMATCH",
        error: "Apple Sign-In security verification failed. Please try again.",
        requestId,
      });
    }

    const tokenInfo = {
      sub: typeof payload.sub === "string" ? payload.sub : "",
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    };

    const supabaseAdmin = deps.createAdminClient(supabaseUrl, supabaseServiceKey);

    const fetchUser = async (matchFn: (user: SupabaseAuthUser) => boolean) => {
      let page = 1;
      const perPage = 1000;

      while (true) {
        const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error("[apple-native-auth] Failed to list users", listError);
          return null;
        }

        const users = (data?.users ?? []) as SupabaseAuthUser[];
        if (!users.length) {
          return null;
        }

        const match = users.find(matchFn);
        if (match) {
          return match;
        }

        if (users.length < perPage) {
          return null;
        }

        page += 1;
      }
    };

    let existingUser: SupabaseAuthUser | null = null;

    if (tokenInfo.email) {
      existingUser = await fetchUser((user) => user.email?.toLowerCase() === tokenInfo.email);
    }

    if (!existingUser && tokenInfo.sub) {
      existingUser = await fetchUser((user) => user.user_metadata?.apple_user_id === tokenInfo.sub);
    }

    let userId: string;
    let userEmail: string | null = null;

    if (!existingUser) {
      if (intent === "sign_in") {
        return getAppleAccountNotFoundResponse(req, requestId);
      }

      if (!tokenInfo.email) {
        return createSafeErrorResponse(req, {
          status: 400,
          code: "APPLE_EMAIL_MISSING",
          error: "Apple did not share an email for this account. Remove this app from Sign in with Apple settings, then try again.",
          requestId,
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: tokenInfo.email,
        email_confirm: true,
        user_metadata: {
          provider: "apple",
          ...(tokenInfo.sub ? { apple_user_id: tokenInfo.sub } : {}),
        },
      });

      if (createError && !(createError.message?.includes("already registered") || createError.message?.includes("already exists"))) {
        console.error("[apple-native-auth] Failed to create user", createError);
        return createSafeErrorResponse(req, {
          status: 500,
          code: "APPLE_AUTH_FAILED",
          error: "Unable to sign in with Apple right now.",
          requestId,
        });
      }

      if (createError) {
        existingUser = await fetchUser((user) => user.email?.toLowerCase() === tokenInfo.email);
        if (!existingUser) {
          return createSafeErrorResponse(req, {
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
            requestId,
          });
        }

        userId = existingUser.id;
        userEmail = existingUser.email?.toLowerCase() ?? tokenInfo.email;
      } else {
        const createdUser = newUser?.user;
        if (!createdUser) {
          return createSafeErrorResponse(req, {
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
            requestId,
          });
        }

        userId = createdUser.id;
        userEmail = tokenInfo.email;
      }
    } else {
      userId = existingUser.id;
      userEmail = existingUser.email?.toLowerCase() ?? tokenInfo.email;

      if (tokenInfo.sub && existingUser.user_metadata?.apple_user_id !== tokenInfo.sub) {
        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            apple_user_id: tokenInfo.sub,
          },
        });

        if (metadataError) {
          console.error("[apple-native-auth] Failed to update Apple metadata", metadataError);
          return createSafeErrorResponse(req, {
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
            requestId,
          });
        }
      }
    }

    if (!userEmail) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "APPLE_ACCOUNT_EMAIL_MISSING",
        error: "Unable to determine the email for this Apple account.",
        requestId,
      });
    }

    const postAuthProtection = await deps.applyAbuseProtectionFn(req, createAbuseAdminClient(), {
      profileKey: "auth.sign_in",
      endpointName: "apple-native-auth",
      requestId: crypto.randomUUID(),
      userId,
      ipAddress: null,
      emailTarget: userEmail,
      blockedMessage: "Too many sign-in attempts. Please try again later.",
      metadata: {
        flow: "apple_native_auth",
        phase: "post_auth",
      },
    });

    if (postAuthProtection instanceof Response) {
      return postAuthProtection;
    }

    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (magicLinkError || !magicLinkData?.properties?.action_link) {
      console.error("[apple-native-auth] Failed to generate magic link", magicLinkError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
        requestId,
      });
    }

    const actionLink = new URL(magicLinkData.properties.action_link);
    const verificationToken = actionLink.searchParams.get("token_hash") ?? actionLink.searchParams.get("token");
    const verificationType = actionLink.searchParams.get("type") || "magiclink";

    if (!verificationToken) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
        requestId,
      });
    }

    const supabaseClient = deps.createAnonClient(supabaseUrl, supabaseAnonKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- native Apple flow uses generated verification types
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.verifyOtp({
      token_hash: verificationToken,
      type: verificationType as any,
    });

    const verifiedSession = sessionData?.session;
    if (sessionError || !verifiedSession) {
      console.error("[apple-native-auth] Failed to create session", sessionError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
        requestId,
      });
    }

    return jsonSuccess(req, {
      access_token: verifiedSession.access_token,
      refresh_token: verifiedSession.refresh_token,
      user: sessionData?.user,
    });
  } catch (error) {
    console.error("[apple-native-auth] Unexpected error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "APPLE_AUTH_FAILED",
      error: "Unable to sign in with Apple right now.",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleAppleNativeAuth(req));
}
