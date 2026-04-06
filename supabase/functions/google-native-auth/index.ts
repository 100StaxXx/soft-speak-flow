import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";
import {
  applyAbuseProtection,
  createSafeErrorResponse,
  getClientIpAddress,
} from "../_shared/abuseProtection.ts";
import { findMissingRequiredEnv, logAuthEvent, logAuthSafeError, readSafeErrorResponseContext, toAuthErrorMessage } from "../_shared/authLogging.ts";
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
const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

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
  let intent: SocialAuthIntent | undefined;

  const createLoggedSafeErrorResponse = (
    options: {
      status: number;
      code: string;
      error: string;
      retryAfterSeconds?: number | null;
    },
    context: Record<string, unknown> = {},
  ): Response => {
    logAuthSafeError("google-native-auth", {
      requestId,
      status: options.status,
      code: options.code,
      error: options.error,
      context,
    });

    return createSafeErrorResponse(req, {
      requestId,
      ...options,
    });
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webClientId = Deno.env.get("GOOGLE_WEB_CLIENT_ID");
    const iosClientId = Deno.env.get("GOOGLE_IOS_CLIENT_ID");
    const missingEnvKeys = findMissingRequiredEnv([...REQUIRED_ENV_KEYS]);

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || (!webClientId && !iosClientId) || missingEnvKeys.length > 0) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Google right now.",
      }, {
        clientIpKnown: ipAddress !== "unknown",
        missingEnvKeys: [...missingEnvKeys, ...(!webClientId && !iosClientId ? ["GOOGLE_WEB_CLIENT_ID|GOOGLE_IOS_CLIENT_ID"] : [])].join(","),
      });
    }

    let supabaseAdmin: any;
    try {
      supabaseAdmin = deps.createAdminClient(supabaseUrl, supabaseServiceKey);
      logAuthEvent("google-native-auth", "info", "Admin client ready", {
        requestId,
        clientIpKnown: ipAddress !== "unknown",
      });
    } catch (error) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Google right now.",
      }, {
        clientIpKnown: ipAddress !== "unknown",
        errorMessage: toAuthErrorMessage(error),
      });
    }

    const preAuthProtection = await deps.applyAbuseProtectionFn(req, supabaseAdmin, {
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
      logAuthEvent("google-native-auth", preAuthProtection.status >= 500 ? "error" : "warn", "Pre-auth abuse protection blocked request", {
        requestId,
        clientIpKnown: ipAddress !== "unknown",
        phase: "pre_auth",
        ...(await readSafeErrorResponseContext(preAuthProtection)),
      });
      return preAuthProtection;
    }

    const { idToken, intent: rawIntent } = await req.json() as GoogleNativeAuthRequest;
    intent = resolveIntent(rawIntent);
    const requestContext = {
      intent,
      clientIpKnown: ipAddress !== "unknown",
      idTokenProvided: typeof idToken === "string" && idToken.length > 0,
    };

    if (!idToken) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
      }, requestContext);
    }

    const validAudiences = [webClientId, iosClientId].filter((value): value is string => Boolean(value));

    let payload: Record<string, unknown>;
    try {
      payload = await deps.verifyIdToken(idToken, validAudiences);
    } catch (jwtError) {
      logAuthEvent("google-native-auth", "error", "JWT verification failed", {
        ...requestContext,
        requestId,
        errorMessage: toAuthErrorMessage(jwtError),
      });
      return createLoggedSafeErrorResponse({
        status: 401,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
      }, requestContext);
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.iat === "number" && (now - payload.iat) > 600) {
      return createLoggedSafeErrorResponse({
        status: 401,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
      }, requestContext);
    }

    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!email) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
      }, requestContext);
    }

    const googleUserId = typeof payload.sub === "string" ? payload.sub : "";

    const fetchUser = async (matchFn: (user: SupabaseAuthUser) => boolean) => {
      let page = 1;
      const perPage = 1000;

      while (true) {
        const { data: userPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          throw new Error(`Failed to list users: ${listError.message}`);
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

    let existingUser: SupabaseAuthUser | null = null;
    try {
      existingUser = await fetchUser((user) => user.email?.toLowerCase() === email);

      if (!existingUser && googleUserId) {
        existingUser = await fetchUser((user) => user.user_metadata?.google_user_id === googleUserId);
      }
    } catch (error) {
      logAuthEvent("google-native-auth", "error", "Failed to look up Google account", {
        ...requestContext,
        requestId,
        email,
        providerSubjectPresent: Boolean(googleUserId),
        errorMessage: toAuthErrorMessage(error),
      });
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Google right now.",
      }, {
        ...requestContext,
        phase: "account_lookup",
      });
    }

    let userId: string;
    let userEmail: string = email;
    if (!existingUser) {
      if (intent === "sign_in") {
        logAuthSafeError("google-native-auth", {
          requestId,
          status: 404,
          code: "ACCOUNT_NOT_FOUND",
          error: "We couldn't find an existing account for this Google sign-in.",
          context: requestContext,
        });
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
        logAuthEvent("google-native-auth", "error", "Failed to create Google auth user", {
          ...requestContext,
          requestId,
          email,
          providerSubjectPresent: Boolean(googleUserId),
          errorMessage: createError.message,
        });
        return createLoggedSafeErrorResponse({
          status: 500,
          code: "GOOGLE_AUTH_FAILED",
          error: "Unable to sign in with Google right now.",
        }, {
          ...requestContext,
          phase: "create_user",
        });
      }

      if (createError) {
        try {
          existingUser = await fetchUser((user) => user.email?.toLowerCase() === email);
        } catch (error) {
          logAuthEvent("google-native-auth", "error", "Failed to reload Google account after duplicate create", {
            ...requestContext,
            requestId,
            email,
            errorMessage: toAuthErrorMessage(error),
          });
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "GOOGLE_AUTH_UNAVAILABLE",
            error: "Unable to sign in with Google right now.",
          }, {
            ...requestContext,
            phase: "reload_user",
          });
        }
        if (!existingUser) {
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
          }, {
            ...requestContext,
            phase: "reload_user",
          });
        }

        userId = existingUser.id;
        userEmail = existingUser.email?.toLowerCase() ?? email;
      } else {
        const createdUser = newUser?.user;
        if (!createdUser) {
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
          }, {
            ...requestContext,
            phase: "create_user",
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
          logAuthEvent("google-native-auth", "error", "Failed to update Google account metadata", {
            ...requestContext,
            requestId,
            userId,
            errorMessage: metadataError.message,
          });
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
          }, {
            ...requestContext,
            phase: "metadata_sync",
            userId,
          });
        }
      }
    }

    const postAuthProtection = await deps.applyAbuseProtectionFn(req, supabaseAdmin, {
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
      logAuthEvent("google-native-auth", postAuthProtection.status >= 500 ? "error" : "warn", "Post-auth abuse protection blocked request", {
        ...requestContext,
        requestId,
        phase: "post_auth",
        userId,
        ...(await readSafeErrorResponseContext(postAuthProtection)),
      });
      return postAuthProtection;
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkError || !linkData?.properties?.action_link) {
      logAuthEvent("google-native-auth", "error", "Failed to generate Google magic link", {
        ...requestContext,
        requestId,
        userId,
        errorMessage: linkError?.message,
      });
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
      }, {
        ...requestContext,
        phase: "magic_link",
        userId,
      });
    }

    const actionUrl = new URL(linkData.properties.action_link);
    const tokenHash = actionUrl.searchParams.get("token_hash") ?? actionUrl.searchParams.get("token");
    const verificationType = actionUrl.searchParams.get("type") || "magiclink";

    if (!tokenHash) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
      }, {
        ...requestContext,
        phase: "magic_link",
        userId,
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
      logAuthEvent("google-native-auth", "error", "Failed to create Google session", {
        ...requestContext,
        requestId,
        userId,
        errorMessage: verifyError?.message,
      });
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
      }, {
        ...requestContext,
        phase: "session_create",
        userId,
      });
    }

    return jsonSuccess(req, {
      access_token: verifiedSession.access_token,
      refresh_token: verifiedSession.refresh_token,
      user: verifyData?.user,
    });
  } catch (error) {
    return createLoggedSafeErrorResponse({
      status: 500,
      code: "GOOGLE_AUTH_FAILED",
      error: "Unable to sign in with Google right now.",
    }, {
      intent,
      clientIpKnown: ipAddress !== "unknown",
      errorMessage: toAuthErrorMessage(error),
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGoogleNativeAuth(req));
}
