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

type GoogleUserMetadata = {
  google_user_id?: string;
  provider?: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: GoogleUserMetadata | null;
};

type GoogleNativeAuthRequest = {
  idToken?: string;
  intent?: SocialAuthIntent;
};

type AdminClientLike = any;

type AnonClientLike = any;

type GoogleNativeAuthDeps = {
  createAdminClient: (supabaseUrl: string, serviceKey: string) => AdminClientLike;
  createAnonClient: (supabaseUrl: string, anonKey: string) => AnonClientLike;
  verifyIdToken: (idToken: string, validAudiences: string[]) => Promise<Record<string, unknown>>;
  applyAbuseProtectionFn: (...args: any[]) => Promise<Response | { requestId: string; ipAddress: string | null; protection: unknown }>;
};

const googleJWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function jsonSuccess(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

const defaultDeps: GoogleNativeAuthDeps = {
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
  verifyIdToken: async (idToken: string, validAudiences: string[]) => {
    const verification = await jwtVerify(idToken, googleJWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: validAudiences,
    });
    return verification.payload as Record<string, unknown>;
  },
  applyAbuseProtectionFn: applyAbuseProtection,
};

const resolveIntent = (intent: SocialAuthIntent | undefined): SocialAuthIntent =>
  intent === "sign_in" || intent === "sign_up" ? intent : "sign_up";

const getGoogleAccountNotFoundResponse = (req: Request, requestId: string): Response =>
  createSafeErrorResponse(req, {
    status: 404,
    code: "ACCOUNT_NOT_FOUND",
    error: "We couldn't find an existing account for this Google sign-in.",
    requestId,
  });

export async function handleGoogleNativeAuth(
  req: Request,
  deps: GoogleNativeAuthDeps = defaultDeps,
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
    const webClientId = Deno.env.get("GOOGLE_WEB_CLIENT_ID");
    const iosClientId = Deno.env.get("GOOGLE_IOS_CLIENT_ID");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || (!webClientId && !iosClientId)) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "GOOGLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Google right now.",
        requestId,
      });
    }

    const preAuthProtection = await deps.applyAbuseProtectionFn(req, createAbuseAdminClient(), {
      profileKey: "auth.sign_in",
      endpointName: "google-native-auth",
      requestId,
      ipAddress,
      blockedMessage: "Too many sign-in attempts. Please try again later.",
      metadata: {
        flow: "google_native_auth",
        phase: "pre_auth",
      },
    });

    if (preAuthProtection instanceof Response) {
      return preAuthProtection;
    }

    const { idToken, intent: rawIntent } = await req.json() as GoogleNativeAuthRequest;
    const intent = resolveIntent(rawIntent);

    if (!idToken) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
        requestId,
      });
    }

    const validAudiences = [webClientId, iosClientId].filter((value): value is string => Boolean(value));

    let payload: Record<string, unknown>;
    try {
      payload = await deps.verifyIdToken(idToken, validAudiences);
    } catch (jwtError) {
      console.error("[google-native-auth] JWT verification failed", jwtError);
      return createSafeErrorResponse(req, {
        status: 401,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
        requestId,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.iat === "number" && (now - payload.iat) > 600) {
      return createSafeErrorResponse(req, {
        status: 401,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
        requestId,
      });
    }

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
        requestId,
      });
    }

    const googleUserId = typeof payload.sub === "string" ? payload.sub : "";
    const supabaseAdmin = deps.createAdminClient(supabaseUrl, supabaseServiceKey);

    const fetchUser = async (matchFn: (user: SupabaseAuthUser) => boolean) => {
      let page = 1;
      const perPage = 1000;

      while (true) {
        const { data: userPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error("[google-native-auth] Failed to list users", listError);
          return null;
        }

        const users = (userPage?.users ?? []) as SupabaseAuthUser[];
        if (users.length === 0) {
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

    let existingUser: SupabaseAuthUser | null = await fetchUser((user) => user.email?.toLowerCase() === email);

    if (!existingUser && googleUserId) {
      existingUser = await fetchUser((user) => user.user_metadata?.google_user_id === googleUserId);
    }

    let userId: string;
    let userEmail: string = email;
    if (!existingUser) {
      if (intent === "sign_in") {
        return getGoogleAccountNotFoundResponse(req, requestId);
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          provider: "google",
          ...(googleUserId ? { google_user_id: googleUserId } : {}),
          full_name: typeof payload.name === "string" ? payload.name : undefined,
          avatar_url: typeof payload.picture === "string" ? payload.picture : undefined,
        },
      });

      if (createError && !(createError.message?.includes("already registered") || createError.message?.includes("already exists"))) {
        console.error("[google-native-auth] Failed to create user", createError);
        return createSafeErrorResponse(req, {
          status: 500,
          code: "GOOGLE_AUTH_FAILED",
          error: "Unable to sign in with Google right now.",
          requestId,
        });
      }

      if (createError) {
        existingUser = await fetchUser((user) => user.email?.toLowerCase() === email);
        if (!existingUser) {
          return createSafeErrorResponse(req, {
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
            requestId,
          });
        }

        userId = existingUser.id;
        userEmail = existingUser.email?.toLowerCase() ?? email;
      } else {
        const createdUser = newUser?.user;
        if (!createdUser) {
          return createSafeErrorResponse(req, {
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
            requestId,
          });
        }

        userId = createdUser.id;
      }
    } else {
      userId = existingUser.id;
      userEmail = existingUser.email?.toLowerCase() ?? email;

      if (googleUserId && existingUser.user_metadata?.google_user_id !== googleUserId) {
        const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            google_user_id: googleUserId,
          },
        });

        if (metadataError) {
          console.error("[google-native-auth] Failed to update Google metadata", metadataError);
          return createSafeErrorResponse(req, {
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
            requestId,
          });
        }
      }
    }

    const postAuthProtection = await deps.applyAbuseProtectionFn(req, createAbuseAdminClient(), {
      profileKey: "auth.sign_in",
      endpointName: "google-native-auth",
      requestId: crypto.randomUUID(),
      userId,
      ipAddress: null,
      emailTarget: userEmail,
      blockedMessage: "Too many sign-in attempts. Please try again later.",
      metadata: {
        flow: "google_native_auth",
        phase: "post_auth",
      },
    });

    if (postAuthProtection instanceof Response) {
      return postAuthProtection;
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[google-native-auth] Failed to generate magic link", linkError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
        requestId,
      });
    }

    const actionUrl = new URL(linkData.properties.action_link);
    const tokenHash = actionUrl.searchParams.get("token_hash") ?? actionUrl.searchParams.get("token");
    const verificationType = actionUrl.searchParams.get("type") || "magiclink";

    if (!tokenHash) {
      return createSafeErrorResponse(req, {
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
        requestId,
      });
    }

    const supabaseClient = deps.createAnonClient(supabaseUrl, supabaseAnonKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase verifyOtp typing does not cover native magiclink usage cleanly
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: verificationType as any,
    });

    const verifiedSession = verifyData?.session;
    if (verifyError || !verifiedSession) {
      console.error("[google-native-auth] Failed to create session", verifyError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
        requestId,
      });
    }

    return jsonSuccess(req, {
      access_token: verifiedSession.access_token,
      refresh_token: verifiedSession.refresh_token,
      user: verifyData?.user,
    });
  } catch (error) {
    console.error("[google-native-auth] Unexpected error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "GOOGLE_AUTH_FAILED",
      error: "Unable to sign in with Google right now.",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGoogleNativeAuth(req));
}
