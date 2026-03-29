import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";
import { applyAbuseProtection, createAbuseAdminClient, createSafeErrorResponse, getClientIpAddress } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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

serve(async (req) => {
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

    const preAuthProtection = await applyAbuseProtection(req, createAbuseAdminClient(), {
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

    const { idToken } = await req.json() as { idToken?: string };
    if (!idToken) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google.",
        requestId,
      });
    }

    const validAudiences = [webClientId, iosClientId].filter((value): value is string => Boolean(value));

    let payload;
    try {
      const verification = await jwtVerify(idToken, googleJWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: validAudiences,
      });
      payload = verification.payload;
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
    if (payload.iat && (now - (payload.iat as number)) > 600) {
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let existingUser = null;
    let page = 1;
    const perPage = 1000;

    while (!existingUser) {
      const { data: userPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        console.error("[google-native-auth] Failed to list users", listError);
        return createSafeErrorResponse(req, {
          status: 500,
          code: "GOOGLE_AUTH_FAILED",
          error: "Unable to sign in with Google right now.",
          requestId,
        });
      }

      const users = userPage?.users ?? [];
      if (users.length === 0) {
        break;
      }

      existingUser = users.find((user) => user.email?.toLowerCase() === email) ?? null;
      if (users.length < perPage) {
        break;
      }
      page += 1;
    }

    let userId: string;
    if (!existingUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          provider: "google",
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
        const { data: retryPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        existingUser = retryPage?.users?.find((user) => user.email?.toLowerCase() === email) ?? null;
        if (!existingUser) {
          return createSafeErrorResponse(req, {
            status: 500,
            code: "GOOGLE_AUTH_FAILED",
            error: "Unable to sign in with Google right now.",
            requestId,
          });
        }
        userId = existingUser.id;
      } else if (!newUser.user) {
        return createSafeErrorResponse(req, {
          status: 500,
          code: "GOOGLE_AUTH_FAILED",
          error: "Unable to sign in with Google right now.",
          requestId,
        });
      } else {
        userId = newUser.user.id;
      }
    } else {
      userId = existingUser.id;
    }

    const postAuthProtection = await applyAbuseProtection(req, createAbuseAdminClient(), {
      profileKey: "auth.sign_in",
      endpointName: "google-native-auth",
      requestId: crypto.randomUUID(),
      userId,
      ipAddress: null,
      emailTarget: email,
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
      email,
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

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase verifyOtp typing does not cover native magiclink usage cleanly
    const { data: verifyData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: verificationType as any,
    });

    if (verifyError || !verifyData.session) {
      console.error("[google-native-auth] Failed to create session", verifyError);
      return createSafeErrorResponse(req, {
        status: 500,
        code: "GOOGLE_AUTH_FAILED",
        error: "Unable to sign in with Google right now.",
        requestId,
      });
    }

    return jsonSuccess(req, {
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
      user: verifyData.user,
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
});
