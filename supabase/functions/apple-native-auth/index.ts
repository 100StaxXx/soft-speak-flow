import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.8.0";
import {
  applyAbuseProtection,
  createSafeErrorResponse,
  getClientIpAddress,
} from "../_shared/abuseProtection.ts";
import {
  findMissingRequiredEnv,
  logAuthEvent,
  logAuthSafeError,
  readSafeErrorResponseContext,
  toAuthErrorMessage,
} from "../_shared/authLogging.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

type SocialAuthIntent = "sign_in" | "sign_up";
type AppleProductMode = "graceward" | "cosmiq";

type AppleUserMetadata = {
  apple_user_id?: string;
  apple_audience?: string;
  auth_product_mode?: AppleProductMode;
  account_email?: string;
  provider?: string;
  [key: string]: unknown;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: AppleUserMetadata | null;
  user_metadata?: AppleUserMetadata | null;
};

type AppleNativeAuthRequest = {
  identityToken?: string;
  rawNonce?: string;
  intent?: SocialAuthIntent;
  productMode?: AppleProductMode;
};

type AdminClientLike = any;

type AnonClientLike = any;

type AppleNativeAuthDeps = {
  createAdminClient: (
    supabaseUrl: string,
    serviceKey: string,
  ) => AdminClientLike;
  createAnonClient: (supabaseUrl: string, anonKey: string) => AnonClientLike;
  verifyIdentityToken: (
    identityToken: string,
    appleServiceId: string,
    iosBundleIds: string[],
  ) => Promise<Record<string, unknown>>;
  sha256HexFn: (value: string) => Promise<string>;
  applyAbuseProtectionFn: (
    ...args: any[]
  ) => Promise<
    Response | {
      requestId: string;
      ipAddress: string | null;
      protection: unknown;
    }
  >;
};

const appleJWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APPLE_SERVICE_ID",
] as const;

const APPLE_PRODUCT_BY_AUDIENCE: Readonly<Record<string, AppleProductMode>> = {
  "com.darrylgraham.graceward": "graceward",
  "com.darrylgraham.revolution": "cosmiq",
};

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const getAppleAudience = (payload: Record<string, unknown>): string | null => {
  if (typeof payload.aud === "string") return payload.aud;
  if (!Array.isArray(payload.aud)) return null;
  return payload.aud.find((value): value is string =>
    typeof value === "string"
  ) ?? null;
};

const getUserProductMode = (
  user: SupabaseAuthUser,
): AppleProductMode | null => {
  const trustedMetadata = user.app_metadata;
  if (
    trustedMetadata?.auth_product_mode === "graceward" ||
    trustedMetadata?.auth_product_mode === "cosmiq"
  ) {
    return trustedMetadata.auth_product_mode;
  }

  const trustedAudience = typeof trustedMetadata?.apple_audience === "string"
    ? trustedMetadata.apple_audience
    : null;
  if (trustedAudience) {
    return APPLE_PRODUCT_BY_AUDIENCE[trustedAudience] ?? null;
  }
  return null;
};

const getUserAppleId = (user: SupabaseAuthUser): string | null => {
  const trustedAppleId = user.app_metadata?.apple_user_id;
  return typeof trustedAppleId === "string" && trustedAppleId.length > 0
    ? trustedAppleId
    : null;
};

const getLegacyDefaultProductMode = (): AppleProductMode =>
  Deno.env.get("APPLE_LEGACY_PRODUCT_MODE")?.trim().toLowerCase() ===
      "graceward"
    ? "graceward"
    : "cosmiq";

function jsonSuccess(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
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

const buildProductScopedAuthEmail = async (
  productMode: AppleProductMode,
  appleUserId: string,
): Promise<string> => {
  const digest = await sha256Hex(`${productMode}:${appleUserId}`);
  const domain = productMode === "graceward"
    ? "accounts.graceward.app"
    : "accounts.cosmiq.app";
  return `apple-${digest.slice(0, 40)}@${domain}`;
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
  verifyIdentityToken: async (
    identityToken: string,
    appleServiceId: string,
    iosBundleIds: string[],
  ) => {
    const verification = await jwtVerify(identityToken, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: [appleServiceId, ...iosBundleIds],
    });
    return verification.payload as Record<string, unknown>;
  },
  sha256HexFn: sha256Hex,
  applyAbuseProtectionFn: applyAbuseProtection,
};

const resolveIntent = (
  intent: SocialAuthIntent | undefined,
): SocialAuthIntent =>
  intent === "sign_in" || intent === "sign_up" ? intent : "sign_up";

const getAppleAccountNotFoundResponse = (
  req: Request,
  requestId: string,
): Response =>
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
    logAuthSafeError("apple-native-auth", {
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
    const appleServiceId = Deno.env.get("APPLE_SERVICE_ID");
    const iosBundleIds = (Deno.env.get("APPLE_IOS_BUNDLE_IDS") ??
      "com.darrylgraham.graceward,com.darrylgraham.revolution")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const missingEnvKeys = findMissingRequiredEnv([...REQUIRED_ENV_KEYS]);

    if (
      !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey ||
      !appleServiceId || missingEnvKeys.length > 0
    ) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Apple right now.",
      }, {
        clientIpKnown: ipAddress !== "unknown",
        missingEnvKeys: missingEnvKeys.join(","),
      });
    }

    let supabaseAdmin: any;
    try {
      supabaseAdmin = deps.createAdminClient(supabaseUrl, supabaseServiceKey);
      logAuthEvent("apple-native-auth", "info", "Admin client ready", {
        requestId,
        clientIpKnown: ipAddress !== "unknown",
      });
    } catch (error) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Apple right now.",
      }, {
        clientIpKnown: ipAddress !== "unknown",
        errorMessage: toAuthErrorMessage(error),
      });
    }

    const preAuthProtection = await deps.applyAbuseProtectionFn(
      req,
      supabaseAdmin,
      {
        profileKey: "auth.sign_in",
        endpointName: "apple-native-auth",
        requestId,
        ipAddress,
        blockedMessage: "Too many sign-in attempts. Please try again later.",
        metadata: {
          flow: "apple_native_auth",
          phase: "pre_auth",
        },
      },
    );

    if (preAuthProtection instanceof Response) {
      logAuthEvent(
        "apple-native-auth",
        preAuthProtection.status >= 500 ? "error" : "warn",
        "Pre-auth abuse protection blocked request",
        {
          requestId,
          clientIpKnown: ipAddress !== "unknown",
          phase: "pre_auth",
          ...(await readSafeErrorResponseContext(preAuthProtection)),
        },
      );
      return preAuthProtection;
    }

    const {
      identityToken,
      rawNonce,
      intent: rawIntent,
      productMode: requestedProductMode,
    } = await req.json() as AppleNativeAuthRequest;
    intent = resolveIntent(rawIntent);
    const requestContext = {
      intent,
      clientIpKnown: ipAddress !== "unknown",
      identityTokenProvided: typeof identityToken === "string" &&
        identityToken.length > 0,
      rawNonceProvided: typeof rawNonce === "string" && rawNonce.length > 0,
    };

    if (!identityToken) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple.",
      }, requestContext);
    }

    if (!rawNonce) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "APPLE_NONCE_MISSING",
        error: "Apple Sign-In security verification failed. Please try again.",
      }, requestContext);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await deps.verifyIdentityToken(
        identityToken,
        appleServiceId,
        iosBundleIds,
      );
    } catch (jwtError) {
      logAuthEvent("apple-native-auth", "error", "JWT verification failed", {
        ...requestContext,
        requestId,
        errorMessage: toAuthErrorMessage(jwtError),
      });
      return createLoggedSafeErrorResponse({
        status: 401,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple.",
      }, requestContext);
    }

    const tokenNonce = typeof payload.nonce === "string" ? payload.nonce : null;
    if (!tokenNonce) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "APPLE_NONCE_MISSING",
        error: "Apple Sign-In security verification failed. Please try again.",
      }, requestContext);
    }

    const expectedNonce = await deps.sha256HexFn(rawNonce);
    if (tokenNonce !== expectedNonce) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "APPLE_NONCE_MISMATCH",
        error: "Apple Sign-In security verification failed. Please try again.",
      }, requestContext);
    }

    const tokenInfo = {
      sub: typeof payload.sub === "string" ? payload.sub : "",
      email: normalizeEmail(
        typeof payload.email === "string" ? payload.email : null,
      ),
      audience: getAppleAudience(payload),
    };

    const tokenProductMode = tokenInfo.audience
      ? APPLE_PRODUCT_BY_AUDIENCE[tokenInfo.audience] ?? null
      : null;

    if (!tokenInfo.sub || !tokenInfo.audience || !tokenProductMode) {
      return createLoggedSafeErrorResponse({
        status: 401,
        code: "APPLE_AUDIENCE_INVALID",
        error: "Unable to sign in with Apple.",
      }, {
        ...requestContext,
        audiencePresent: Boolean(tokenInfo.audience),
        providerSubjectPresent: Boolean(tokenInfo.sub),
      });
    }

    if (requestedProductMode && requestedProductMode !== tokenProductMode) {
      return createLoggedSafeErrorResponse({
        status: 401,
        code: "APPLE_PRODUCT_MISMATCH",
        error: "This Apple sign-in was issued for a different app.",
      }, {
        ...requestContext,
        requestedProductMode,
        tokenProductMode,
      });
    }

    const productMode = tokenProductMode;

    const fetchUsers = async (): Promise<SupabaseAuthUser[]> => {
      let page = 1;
      const perPage = 1000;
      const allUsers: SupabaseAuthUser[] = [];

      while (true) {
        const { data, error: listError } = await supabaseAdmin.auth.admin
          .listUsers({
            page,
            perPage,
          });

        if (listError) {
          throw new Error(`Failed to list users: ${listError.message}`);
        }

        const users = (data?.users ?? []) as SupabaseAuthUser[];
        if (!users.length) {
          return allUsers;
        }

        allUsers.push(...users);

        if (users.length < perPage) {
          return allUsers;
        }

        page += 1;
      }
    };

    const inferLegacyUserProductMode = async (
      user: SupabaseAuthUser,
    ): Promise<AppleProductMode> => {
      if (typeof supabaseAdmin.from !== "function") {
        return getLegacyDefaultProductMode();
      }

      try {
        const { data: companion, error: companionError } = await supabaseAdmin
          .from("user_companion")
          .select("product_mode, preset_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (companionError) {
          throw companionError;
        }

        if (
          companion?.product_mode === "graceward" ||
          companion?.product_mode === "cosmiq"
        ) {
          return companion.product_mode;
        }
        if (companion?.preset_id) {
          return "cosmiq";
        }
      } catch (error) {
        logAuthEvent(
          "apple-native-auth",
          "warn",
          "Legacy companion product lookup failed",
          {
            requestId,
            userId: user.id,
            errorMessage: toAuthErrorMessage(error),
          },
        );
        throw error;
      }

      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("onboarding_data")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) {
          throw profileError;
        }
        const onboardingProductMode = profile?.onboarding_data?.product_mode;

        if (
          onboardingProductMode === "graceward" ||
          onboardingProductMode === "christian"
        ) {
          return "graceward";
        }
        if (onboardingProductMode === "cosmiq") {
          return "cosmiq";
        }
      } catch (error) {
        logAuthEvent(
          "apple-native-auth",
          "warn",
          "Legacy profile product lookup failed",
          {
            requestId,
            userId: user.id,
            errorMessage: toAuthErrorMessage(error),
          },
        );
        throw error;
      }

      return getLegacyDefaultProductMode();
    };

    let existingUser: SupabaseAuthUser | null = null;
    let linkedAppleAccountEmail: string | null = null;
    let allUsers: SupabaseAuthUser[] = [];
    try {
      allUsers = await fetchUsers();
      const subjectMatches = allUsers.filter(
        (user) => getUserAppleId(user) === tokenInfo.sub,
      );
      linkedAppleAccountEmail = subjectMatches
        .map((user) =>
          normalizeEmail(user.app_metadata?.account_email) ??
            normalizeEmail(user.user_metadata?.account_email) ??
            normalizeEmail(user.email)
        )
        .find((email): email is string => Boolean(email)) ?? null;
      const emailMatches = tokenInfo.email
        ? allUsers.filter((user) =>
          normalizeEmail(user.email) === tokenInfo.email
        )
        : [];

      existingUser = subjectMatches.find((user) =>
        getUserProductMode(user) === productMode
      ) ?? null;

      if (!existingUser) {
        existingUser = emailMatches.find((user) =>
          !getUserAppleId(user) &&
          getUserProductMode(user) === productMode
        ) ?? null;
      }

      if (!existingUser) {
        const legacyCandidates = [
          ...subjectMatches,
          ...emailMatches.filter((user) =>
            !getUserAppleId(user)
          ),
        ].filter((user, index, candidates) =>
          getUserProductMode(user) === null &&
          candidates.findIndex((candidate) => candidate.id === user.id) ===
            index
        );

        for (const candidate of legacyCandidates) {
          if (await inferLegacyUserProductMode(candidate) === productMode) {
            existingUser = candidate;
            break;
          }
        }
      }
    } catch (error) {
      logAuthEvent(
        "apple-native-auth",
        "error",
        "Failed to look up Apple account",
        {
          ...requestContext,
          requestId,
          hasEmail: Boolean(tokenInfo.email),
          providerSubjectPresent: true,
          productMode,
          errorMessage: toAuthErrorMessage(error),
        },
      );
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_UNAVAILABLE",
        error: "Unable to sign in with Apple right now.",
      }, {
        ...requestContext,
        phase: "account_lookup",
      });
    }

    let userId: string;
    let authEmail: string | null = null;
    let accountEmail: string | null = tokenInfo.email ??
      linkedAppleAccountEmail;

    if (!existingUser) {
      if (intent === "sign_in") {
        logAuthSafeError("apple-native-auth", {
          requestId,
          status: 404,
          code: "ACCOUNT_NOT_FOUND",
          error: "We couldn't find an existing account for this Apple sign-in.",
          context: requestContext,
        });
        return getAppleAccountNotFoundResponse(req, requestId);
      }

      if (!accountEmail) {
        return createLoggedSafeErrorResponse({
          status: 400,
          code: "APPLE_EMAIL_MISSING",
          error:
            "Apple did not share an email for this account. Remove this app from Sign in with Apple settings, then try again.",
        }, requestContext);
      }

      const emailBelongsToAnotherProduct = allUsers.some(
        (user) => normalizeEmail(user.email) === accountEmail,
      );
      const productScopedEmail = emailBelongsToAnotherProduct
        ? await buildProductScopedAuthEmail(productMode, tokenInfo.sub)
        : accountEmail;

      const { data: newUser, error: createError } = await supabaseAdmin.auth
        .admin.createUser({
          email: productScopedEmail,
          email_confirm: true,
          user_metadata: {
            provider: "apple",
            apple_user_id: tokenInfo.sub,
            apple_audience: tokenInfo.audience,
            auth_product_mode: productMode,
            account_email: accountEmail,
          },
          app_metadata: {
            provider: "apple",
            apple_user_id: tokenInfo.sub,
            apple_audience: tokenInfo.audience,
            auth_product_mode: productMode,
            account_email: accountEmail,
          },
        });

      if (
        createError &&
        !(createError.message?.includes("already registered") ||
          createError.message?.includes("already exists"))
      ) {
        logAuthEvent(
          "apple-native-auth",
          "error",
          "Failed to create Apple auth user",
          {
            ...requestContext,
            requestId,
            hasEmail: Boolean(tokenInfo.email),
            providerSubjectPresent: true,
            productMode,
            errorMessage: createError.message,
          },
        );
        return createLoggedSafeErrorResponse({
          status: 500,
          code: "APPLE_AUTH_FAILED",
          error: "Unable to sign in with Apple right now.",
        }, {
          ...requestContext,
          phase: "create_user",
        });
      }

      if (createError) {
        try {
          const refreshedUsers = await fetchUsers();
          existingUser = refreshedUsers.find((user) =>
            getUserAppleId(user) === tokenInfo.sub &&
            getUserProductMode(user) === productMode
          ) ?? refreshedUsers.find((user) =>
            normalizeEmail(user.email) === productScopedEmail &&
            getUserProductMode(user) === productMode
          ) ?? null;
        } catch (error) {
          logAuthEvent(
            "apple-native-auth",
            "error",
            "Failed to reload Apple account after duplicate create",
            {
              ...requestContext,
              requestId,
              hasEmail: Boolean(tokenInfo.email),
              errorMessage: toAuthErrorMessage(error),
            },
          );
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "APPLE_AUTH_UNAVAILABLE",
            error: "Unable to sign in with Apple right now.",
          }, {
            ...requestContext,
            phase: "reload_user",
          });
        }
        if (!existingUser) {
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
          }, {
            ...requestContext,
            phase: "reload_user",
          });
        }

        userId = existingUser.id;
        authEmail = normalizeEmail(existingUser.email);
        accountEmail =
          normalizeEmail(existingUser.app_metadata?.account_email) ??
            normalizeEmail(existingUser.user_metadata?.account_email) ??
            tokenInfo.email ?? linkedAppleAccountEmail;
      } else {
        const createdUser = newUser?.user;
        if (!createdUser) {
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
          }, {
            ...requestContext,
            phase: "create_user",
          });
        }

        userId = createdUser.id;
        authEmail = productScopedEmail;
      }
    } else {
      userId = existingUser.id;
      authEmail = normalizeEmail(existingUser.email);
      accountEmail = tokenInfo.email ??
        normalizeEmail(existingUser.app_metadata?.account_email) ??
        normalizeEmail(existingUser.user_metadata?.account_email) ??
        authEmail;

      const existingMetadata = existingUser.user_metadata ?? {};
      const existingAppMetadata = existingUser.app_metadata ?? {};
      const metadataNeedsSync = existingAppMetadata.provider !== "apple" ||
        existingAppMetadata.apple_user_id !== tokenInfo.sub ||
        existingAppMetadata.apple_audience !== tokenInfo.audience ||
        existingAppMetadata.auth_product_mode !== productMode ||
        normalizeEmail(existingAppMetadata.account_email) !== accountEmail ||
        existingMetadata.provider !== "apple" ||
        existingMetadata.apple_user_id !== tokenInfo.sub ||
        existingMetadata.apple_audience !== tokenInfo.audience ||
        existingMetadata.auth_product_mode !== productMode ||
        normalizeEmail(existingMetadata.account_email) !== accountEmail;

      if (metadataNeedsSync) {
        const { error: metadataError } = await supabaseAdmin.auth.admin
          .updateUserById(userId, {
            user_metadata: {
              ...existingMetadata,
              provider: "apple",
              apple_user_id: tokenInfo.sub,
              apple_audience: tokenInfo.audience,
              auth_product_mode: productMode,
              ...(accountEmail ? { account_email: accountEmail } : {}),
            },
            app_metadata: {
              ...existingAppMetadata,
              provider: "apple",
              apple_user_id: tokenInfo.sub,
              apple_audience: tokenInfo.audience,
              auth_product_mode: productMode,
              ...(accountEmail ? { account_email: accountEmail } : {}),
            },
          });

        if (metadataError) {
          logAuthEvent(
            "apple-native-auth",
            "error",
            "Failed to update Apple account metadata",
            {
              ...requestContext,
              requestId,
              userId,
              errorMessage: metadataError.message,
            },
          );
          return createLoggedSafeErrorResponse({
            status: 500,
            code: "APPLE_AUTH_FAILED",
            error: "Unable to sign in with Apple right now.",
          }, {
            ...requestContext,
            phase: "metadata_sync",
            userId,
          });
        }
      }
    }

    if (!authEmail) {
      return createLoggedSafeErrorResponse({
        status: 400,
        code: "APPLE_ACCOUNT_EMAIL_MISSING",
        error: "Unable to determine the email for this Apple account.",
      }, requestContext);
    }

    const postAuthProtection = await deps.applyAbuseProtectionFn(
      req,
      supabaseAdmin,
      {
        profileKey: "auth.sign_in",
        endpointName: "apple-native-auth",
        requestId: crypto.randomUUID(),
        userId,
        ipAddress: null,
        emailTarget: accountEmail ?? authEmail,
        blockedMessage: "Too many sign-in attempts. Please try again later.",
        metadata: {
          flow: "apple_native_auth",
          phase: "post_auth",
        },
      },
    );

    if (postAuthProtection instanceof Response) {
      logAuthEvent(
        "apple-native-auth",
        postAuthProtection.status >= 500 ? "error" : "warn",
        "Post-auth abuse protection blocked request",
        {
          ...requestContext,
          requestId,
          phase: "post_auth",
          userId,
          ...(await readSafeErrorResponseContext(postAuthProtection)),
        },
      );
      return postAuthProtection;
    }

    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin
      .auth.admin.generateLink({
        type: "magiclink",
        email: authEmail,
      });

    if (magicLinkError || !magicLinkData?.properties?.action_link) {
      logAuthEvent(
        "apple-native-auth",
        "error",
        "Failed to generate Apple magic link",
        {
          ...requestContext,
          requestId,
          userId,
          errorMessage: magicLinkError?.message,
        },
      );
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
      }, {
        ...requestContext,
        phase: "magic_link",
        userId,
      });
    }

    const actionLink = new URL(magicLinkData.properties.action_link);
    const verificationToken = actionLink.searchParams.get("token_hash") ??
      actionLink.searchParams.get("token");
    const verificationType = actionLink.searchParams.get("type") || "magiclink";

    if (!verificationToken) {
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
      }, {
        ...requestContext,
        phase: "magic_link",
        userId,
      });
    }

    const supabaseClient = deps.createAnonClient(supabaseUrl, supabaseAnonKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- native Apple flow uses generated verification types
    const { data: sessionData, error: sessionError } = await supabaseClient.auth
      .verifyOtp({
        token_hash: verificationToken,
        type: verificationType as any,
      });

    const verifiedSession = sessionData?.session;
    if (sessionError || !verifiedSession) {
      logAuthEvent(
        "apple-native-auth",
        "error",
        "Failed to create Apple session",
        {
          ...requestContext,
          requestId,
          userId,
          errorMessage: sessionError?.message,
        },
      );
      return createLoggedSafeErrorResponse({
        status: 500,
        code: "APPLE_AUTH_FAILED",
        error: "Unable to sign in with Apple right now.",
      }, {
        ...requestContext,
        phase: "session_create",
        userId,
      });
    }

    return jsonSuccess(req, {
      access_token: verifiedSession.access_token,
      refresh_token: verifiedSession.refresh_token,
      user: sessionData?.user,
    });
  } catch (error) {
    return createLoggedSafeErrorResponse({
      status: 500,
      code: "APPLE_AUTH_FAILED",
      error: "Unable to sign in with Apple right now.",
    }, {
      intent,
      clientIpKnown: ipAddress !== "unknown",
      errorMessage: toAuthErrorMessage(error),
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleAppleNativeAuth(req));
}
