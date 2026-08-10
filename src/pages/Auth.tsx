import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { safeNavigate } from "@/utils/nativeNavigation";
import { SignInWithApple, SignInWithAppleResponse } from '@capacitor-community/apple-sign-in';
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { getAuthRedirectPath, getProfileAwareAuthFallbackPath } from "@/utils/authRedirect";
import { logger } from "@/utils/logger";
import { hasWalkthroughCompleted } from "@/utils/profileOnboarding";
import { getRedirectUrlWithPath, getRedirectUrl } from '@/utils/redirectUrl';
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
  type ParsedFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";
import { retryWithBackoff } from "@/utils/retry";
import {
  clearPendingSocialAuthAttempt,
  getSocialAccountNotFoundMessage,
  getSocialAuthIntent,
  readPendingSocialAuthAttempt,
  storePendingSocialAuthAttempt,
  type PendingSocialAuthAttempt,
  type SocialAuthIntent,
} from "@/utils/socialAuth";
import { Eye, EyeOff } from "lucide-react";
import { loginPasswordSchema, newPasswordSchema } from "@/utils/passwordPolicy";
import {
  consumeAuthReturnPath,
  rememberAuthReturnPath,
} from "@/utils/authReturnPath";

const POST_AUTH_NAVIGATION_TIMEOUT_MS = 5000;
const POST_AUTH_DEFAULT_PATH = '/onboarding';
const AUTH_GATEWAY_RETRY_DELAY_MS = 350;
const FUNCTION_TRANSPORT_ERROR_MESSAGES = new Set([
  "edge function returned a non-2xx status code",
  "failed to send a request to the edge function",
  "relay error invoking the edge function",
]);
const AUTH_GATEWAY_OUTAGE_CODES = new Set([
  "SERVICE_MISCONFIGURED",
  "ABUSE_CHECK_FAILED",
  "AUTH_GATEWAY_FAILED",
]);
const SOCIAL_AUTH_OUTAGE_CODES = new Set([
  "ABUSE_CHECK_FAILED",
  "APPLE_AUTH_UNAVAILABLE",
  "GOOGLE_AUTH_UNAVAILABLE",
]);
const AUTH_TEMPORARY_OUTAGE_MESSAGE =
  "Authentication is temporarily unavailable. Please try again in a moment.";
const APPLE_AUTH_TEMPORARY_OUTAGE_MESSAGE =
  "Sign in with Apple is temporarily unavailable. Please try again in a moment.";
const ACCOUNT_CREATION_ERROR_TOAST_TITLE = "Couldn't create account";

type AuthGatewayAction = "sign_in_password" | "sign_up_password" | "reset_password";
type PostAuthProvider = "apple" | null;

interface PostAuthNavigationContext {
  provider: PostAuthProvider;
  intent: SocialAuthIntent | null;
  preferGuardedLanding: boolean;
}

const DEFAULT_POST_AUTH_NAVIGATION_CONTEXT: PostAuthNavigationContext = {
  provider: null,
  intent: null,
  preferGuardedLanding: false,
};

const hasOAuthCallbackParams = (): boolean => {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  return Boolean(url.searchParams.get("code") || url.hash.includes("access_token"));
};

const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .min(3, "Email too short")
  .max(255, "Email too long")
  .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email format");

const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

const signupSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  confirmPassword: z.string(),
}).refine((data) => {
  return data.password === data.confirmPassword;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (typeof error === "string") return error;
  return "Unknown error";
};

const getAppleErrorDescription = (error: unknown): string => {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("apple_email_missing")) {
    return "Apple did not share an email for this account. Remove Cosmiq from Sign in with Apple settings, then try again.";
  }

  if (normalized.includes("nonce") || normalized.includes("security check")) {
    return "Apple Sign-In security verification failed. Please try again.";
  }

  if (normalized.includes("session")) {
    return "Apple Sign-In completed, but we couldn't start your session. Please try again.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to send a request to the edge function") ||
    normalized.includes("relay error invoking the edge function") ||
    normalized.includes("functionsfetcherror")
  ) {
    return "Network issue while signing in with Apple. Check your connection and try again.";
  }

  return message || "Apple Sign-In failed. Please try again.";
};

const getAuthGatewayActionDescription = (action: AuthGatewayAction): string => {
  switch (action) {
    case "sign_in_password":
      return "sign you in";
    case "sign_up_password":
      return "create your account";
    case "reset_password":
      return "send the reset link";
  }
};

const isFunctionTransportErrorMessage = (message: string): boolean =>
  FUNCTION_TRANSPORT_ERROR_MESSAGES.has(message.trim().toLowerCase());

const getParsedFunctionErrorCode = (parsed: ParsedFunctionInvokeError): string | undefined =>
  parsed.code ?? parsed.responsePayload?.code;

const getParsedFunctionRequestId = (parsed: ParsedFunctionInvokeError): string | undefined =>
  parsed.requestId ?? parsed.responsePayload?.requestId;

const logAuthFunctionError = (
  label: string,
  parsed: ParsedFunctionInvokeError,
  extra: Record<string, unknown>,
) => {
  logger.error(label, {
    ...extra,
    category: parsed.category,
    status: parsed.status,
    code: getParsedFunctionErrorCode(parsed),
    requestId: getParsedFunctionRequestId(parsed),
    backendMessage: parsed.backendMessage,
    retryAfterSeconds: parsed.retryAfterSeconds,
    upstreamStatus: parsed.upstreamStatus,
    upstreamError: parsed.upstreamError,
  });
};

const getAuthGatewayErrorMessage = async (
  error: unknown,
  action: AuthGatewayAction,
): Promise<string> => {
  const parsed = await parseFunctionInvokeError(error);
  logAuthFunctionError("[Auth Gateway] Password auth request failed", parsed, {
    action,
  });
  const errorCode = getParsedFunctionErrorCode(parsed);

  if (errorCode && AUTH_GATEWAY_OUTAGE_CODES.has(errorCode)) {
    return AUTH_TEMPORARY_OUTAGE_MESSAGE;
  }

  if (typeof parsed.backendMessage === "string" && parsed.backendMessage.trim()) {
    return parsed.backendMessage;
  }

  const directMessage = getErrorMessage(error).trim();
  if (directMessage && !isFunctionTransportErrorMessage(directMessage)) {
    return directMessage;
  }

  return toUserFacingFunctionError(parsed, {
    action: getAuthGatewayActionDescription(action),
  });
};

const getAppleAuthActionDescription = (intent: SocialAuthIntent): string =>
  intent === "sign_in" ? "sign you in with Apple" : "create your account with Apple";

const getAppleAuthErrorMessage = async (
  error: unknown,
  intent: SocialAuthIntent,
): Promise<string> => {
  const parsed = await parseFunctionInvokeError(error);
  logAuthFunctionError("[Auth Apple] Social auth request failed", parsed, {
    intent,
  });
  const errorCode = getParsedFunctionErrorCode(parsed);

  if (errorCode && SOCIAL_AUTH_OUTAGE_CODES.has(errorCode)) {
    return APPLE_AUTH_TEMPORARY_OUTAGE_MESSAGE;
  }

  if (
    typeof parsed.backendMessage === "string" &&
    parsed.backendMessage.trim() &&
    !isFunctionTransportErrorMessage(parsed.backendMessage)
  ) {
    return parsed.backendMessage;
  }

  const directMessage = getErrorMessage(error).trim();
  if (
    directMessage &&
    !isFunctionTransportErrorMessage(directMessage) &&
    !directMessage.toLowerCase().includes("functionsfetcherror")
  ) {
    return directMessage;
  }

  return toUserFacingFunctionError(parsed, {
    action: getAppleAuthActionDescription(intent),
  });
};

interface AuthGatewayPayload {
  action: AuthGatewayAction;
  email?: string;
  password?: string;
  redirectTo?: string;
  timezone?: string;
}

const invokeAuthGateway = async (payload: AuthGatewayPayload) => {
  try {
    const data = await retryWithBackoff(
      async () => {
        const { data, error } = await supabase.functions.invoke("auth-gateway", {
          body: payload,
        });

        if (error) {
          throw error;
        }

        return (data ?? {}) as Record<string, unknown>;
      },
      {
        maxAttempts: 2,
        initialDelay: AUTH_GATEWAY_RETRY_DELAY_MS,
        maxDelay: AUTH_GATEWAY_RETRY_DELAY_MS,
        shouldRetry: isRetriableFunctionInvokeError,
      },
    );

    return data;
  } catch (error) {
    throw new Error(await getAuthGatewayErrorMessage(error, payload.action));
  }
};

const readFunctionErrorContext = async (error: unknown) => {
  const maybeErrorWithContext = error as { context?: { json?: () => Promise<Record<string, unknown>> } };
  if (!maybeErrorWithContext.context?.json) {
    return null;
  }

  try {
    return await maybeErrorWithContext.context.json();
  } catch {
    return null;
  }
};


const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const authSearchParams = new URLSearchParams(location.search);
  const requestedAuthMode = authSearchParams.get("mode");
  const requestedReturnPath = authSearchParams.get("returnTo");
  const [isLogin, setIsLogin] = useState(() => requestedAuthMode !== "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'apple' | null>(null);
  const { toast } = useToast();
  const navigationSafetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    rememberAuthReturnPath(requestedReturnPath);
  }, [requestedReturnPath]);
  const pendingPostAuthNavigationContextRef = useRef<
    (PostAuthNavigationContext & { userId: string }) | null
  >(null);
  const setPendingPostAuthNavigationContext = useCallback(
    (userId: string, context: PostAuthNavigationContext) => {
      pendingPostAuthNavigationContextRef.current = {
        ...context,
        userId,
      };
    },
    [],
  );

  const clearPendingPostAuthNavigationContext = useCallback((userId?: string | null) => {
    const pendingContext = pendingPostAuthNavigationContextRef.current;
    if (!pendingContext) return;
    if (!userId || pendingContext.userId === userId) {
      pendingPostAuthNavigationContextRef.current = null;
    }
  }, []);

  const resolvePostAuthNavigationContext = useCallback(
    (
      session: Session | null,
      context?: PostAuthNavigationContext,
    ): PostAuthNavigationContext => {
      if (context) {
        return context;
      }

      const pendingContext = pendingPostAuthNavigationContextRef.current;
      if (!session?.user?.id || !pendingContext || pendingContext.userId !== session.user.id) {
        return DEFAULT_POST_AUTH_NAVIGATION_CONTEXT;
      }

      return {
        provider: pendingContext.provider,
        intent: pendingContext.intent,
        preferGuardedLanding: pendingContext.preferGuardedLanding,
      };
    },
    [],
  );

  const normalizePostAuthPath = useCallback(
    (path: string, context: PostAuthNavigationContext): string => {
      if (context.preferGuardedLanding && path === POST_AUTH_DEFAULT_PATH) {
        return "/";
      }

      if (path !== POST_AUTH_DEFAULT_PATH) {
        return consumeAuthReturnPath() ?? path;
      }

      return path;
    },
    [],
  );

  const handlePostAuthNavigation = useCallback(async (
    session: Session | null,
    source: string,
    context?: PostAuthNavigationContext,
  ) => {
    const startTime = Date.now();
    const navigationContext = resolvePostAuthNavigationContext(session, context);
    logger.info(`[Auth ${source}] handlePostAuthNavigation START`, {
      hasSession: !!session,
      hasRedirected: hasRedirected.current,
      userId: session?.user?.id?.substring(0, 8),
      provider: navigationContext.provider,
      intent: navigationContext.intent,
      preferGuardedLanding: navigationContext.preferGuardedLanding,
    });

    // Synchronous guard - check and set IMMEDIATELY before any async work
    if (!session || hasRedirected.current) {
      logger.info(`[Auth ${source}] Skipping - session: ${!!session}, hasRedirected: ${hasRedirected.current}`);
      return;
    }
    hasRedirected.current = true;

    let navigationFinalized = false;
    const finalizeNavigation = (path: string, reason: string): boolean => {
      if (navigationFinalized) {
        logger.debug(`[Auth ${source}] Navigation already finalized, skipping ${reason}`);
        return false;
      }

      const normalizedPath = normalizePostAuthPath(path, navigationContext);
      navigationFinalized = true;
      logger.info(
        `[Auth ${source}] Finalizing navigation to ${normalizedPath} via ${reason} (total time: ${Date.now() - startTime}ms)`,
        {
          rawPath: path,
          normalizedPath,
          provider: navigationContext.provider,
          intent: navigationContext.intent,
          preferGuardedLanding: navigationContext.preferGuardedLanding,
        },
      );
      safeNavigate(navigate, normalizedPath);

      // Safety valve: if routing fails and we are still on /auth, allow retry.
      if (navigationSafetyTimeout.current) {
        clearTimeout(navigationSafetyTimeout.current);
      }
      navigationSafetyTimeout.current = setTimeout(() => {
        navigationSafetyTimeout.current = null;
        if (typeof window !== "undefined" && window.location.pathname === '/auth') {
          logger.warn(`[Auth ${source}] Navigation did not leave /auth, resetting redirect guard`);
          hasRedirected.current = false;
        }
      }, 1500);

      return true;
    };

    const emitTimeoutTelemetry = () => {
      void Promise.resolve((async () => {
        const telemetryStart = Date.now();
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed, onboarding_data")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          logger.warn(`[Auth ${source}] Timeout telemetry profile check failed`, { error: error.message });
          return;
        }

        logger.info(`[Auth ${source}] Timeout telemetry profile check completed`, {
          onboardingCompleted: data?.onboarding_completed,
          walkthroughCompleted: hasWalkthroughCompleted(data?.onboarding_data),
          durationMs: Date.now() - telemetryStart,
        });
      })()).catch((error: unknown) => {
        logger.warn(`[Auth ${source}] Timeout telemetry failed`, { error });
      });
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const deadlineTask = new Promise<"deadline">((resolve) => {
      timeoutId = setTimeout(() => {
        logger.warn(`[Auth ${source}] TIMEOUT after ${POST_AUTH_NAVIGATION_TIMEOUT_MS}ms - resolving profile-aware fallback path`);

        void Promise.resolve((async () => {
          let fallbackPath = POST_AUTH_DEFAULT_PATH;

          try {
            const fallbackStartTime = Date.now();
            fallbackPath = await getProfileAwareAuthFallbackPath(session.user.id, {
              email: session.user.email ?? null,
            });
            logger.info(`[Auth ${source}] Profile-aware timeout fallback resolved to "${fallbackPath}" in ${Date.now() - fallbackStartTime}ms`);
          } catch (error) {
            logger.warn(`[Auth ${source}] Profile-aware timeout fallback failed, defaulting to ${POST_AUTH_DEFAULT_PATH}`, { error });
          }

          finalizeNavigation(fallbackPath, "deadline-profile-aware");
          emitTimeoutTelemetry();
          resolve("deadline");
        })());
      }, POST_AUTH_NAVIGATION_TIMEOUT_MS);
    });

    const coreTask = (async (): Promise<"core"> => {
      try {
        logger.info(`[Auth ${source}] Calling getAuthRedirectPath...`);
        const redirectStartTime = Date.now();
        const path = await getAuthRedirectPath(session.user.id, {
          email: session.user.email ?? null,
        });
        logger.info(`[Auth ${source}] getAuthRedirectPath returned "${path}" in ${Date.now() - redirectStartTime}ms`);

        finalizeNavigation(path, "resolved-path");
      } catch (error) {
        logger.error(`[Auth ${source}] Navigation error after ${Date.now() - startTime}ms`, { error });
        finalizeNavigation(POST_AUTH_DEFAULT_PATH, "error");
      }

      return "core";
    })();

    const winner = await Promise.race([coreTask, deadlineTask]);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (winner === "deadline") {
      logger.warn(`[Auth ${source}] Navigation deadline won race; continuing in background if needed`);
    }
  }, [navigate, normalizePostAuthPath, resolvePostAuthNavigationContext, toast]);
  
  // Ref to track Apple OAuth fallback timeout (for cleanup)
  const appleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to track if initial session check has redirected
  const hasRedirected = useRef(false);
  
  // Ref to prevent re-renders during initialization
  const initializationComplete = useRef(false);
  const oauthCallbackInProgress = useRef(hasOAuthCallbackParams());

  const [appleNativeReady, setAppleNativeReady] = useState(false);

  const blockSocialSignIn = useCallback(
    async (attempt: PendingSocialAuthAttempt, source: string) => {
      logger.warn(`[Auth ${source}] Blocking social sign-in with no returning account match`, attempt);
      clearPendingSocialAuthAttempt();
      clearPendingPostAuthNavigationContext();

      try {
        await supabase.auth.signOut();
      } catch (error) {
        logger.warn(`[Auth ${source}] Failed to clear blocked social auth session`, { error });
      }

      hasRedirected.current = false;
      setIsLogin(true);
      setIsForgotPassword(false);
      setInlineError(getSocialAccountNotFoundMessage(attempt.provider));
    },
    [clearPendingPostAuthNavigationContext],
  );

  const handleResolvedSocialAuth = useCallback(
    async (session: Session | null, source: string, attempt: PendingSocialAuthAttempt | null) => {
      if (!session) {
        clearPendingSocialAuthAttempt();
        await handlePostAuthNavigation(session, source);
        return;
      }

      if (!attempt) {
        await handlePostAuthNavigation(session, source);
        return;
      }

      if (attempt.intent !== "sign_in") {
        clearPendingSocialAuthAttempt();
        await handlePostAuthNavigation(session, source);
        return;
      }

      try {
        const path = await getAuthRedirectPath(session.user.id);
        if (path === POST_AUTH_DEFAULT_PATH) {
          await blockSocialSignIn(attempt, source);
          return;
        }
      } catch (error) {
        logger.warn(`[Auth ${source}] Failed to preflight social sign-in redirect, continuing`, { error });
      }

      clearPendingSocialAuthAttempt();
      await handlePostAuthNavigation(session, source);
    },
    [blockSocialSignIn, handlePostAuthNavigation],
  );

  // If we ever land back on /auth, allow redirects to run again
  useEffect(() => {
    if (location.pathname === '/auth' && hasRedirected.current) {
      hasRedirected.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (requestedAuthMode === "signup") {
      setInlineError(null);
      setIsForgotPassword(false);
      setIsLogin(false);
    }
  }, [requestedAuthMode]);

  useEffect(() => {
    if (isLogin || isForgotPassword) {
      setShowSignupPassword(false);
      setShowSignupConfirmPassword(false);
    }
  }, [isLogin, isForgotPassword]);

  useEffect(() => {
    if (initializationComplete.current) return;
    initializationComplete.current = true;

    if (!Capacitor.isNativePlatform()) {
      setAppleNativeReady(false);
      return;
    }

    const platform = Capacitor.getPlatform?.() ?? 'web';
    if (platform !== 'ios') {
      setAppleNativeReady(false);
      return;
    }

    const pluginAvailable = Capacitor.isPluginAvailable?.('SignInWithApple') ?? false;
    if (!pluginAvailable) {
      logger.warn('[OAuth Init] SignInWithApple plugin unavailable - falling back to web OAuth for Apple');
    }
    setAppleNativeReady(pluginAvailable);
  }, []);

  // Handle OAuth callback parameters that return the user to /auth with a valid code/token
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (typeof window === "undefined" || hasRedirected.current || !oauthCallbackInProgress.current) return;

      const url = new URL(window.location.href);
      const hasAccessToken = url.hash.includes("access_token");
      const code = url.searchParams.get("code");
      const pendingAttempt = readPendingSocialAuthAttempt();

      // Only run when coming back from an OAuth provider
      if (!code && !hasAccessToken) return;

      try {
        // If Supabase didn't automatically exchange the code, do it manually
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await handleResolvedSocialAuth(data.session, "oauthCodeExchange", pendingAttempt);
        } else {
          // Hash-based tokens (implicit flow)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await handleResolvedSocialAuth(session, "oauthHashSession", pendingAttempt);
          }
        }
      } catch (error) {
        clearPendingSocialAuthAttempt();
        logger.error("[OAuth Callback] Failed to complete OAuth login", { error });
        toast({
          title: "Error",
          description: "Something went wrong signing you in. Please try again.",
          variant: "destructive",
        });
      } finally {
        // Clean up URL parameters to avoid re-processing on re-render
        if (code) {
          url.searchParams.delete("code");
          const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState(window.history.state, "", cleanedUrl);
        } else if (hasAccessToken) {
          window.location.hash = "";
        }

        oauthCallbackInProgress.current = false;
      }
    };

    handleOAuthCallback();
  }, [handleResolvedSocialAuth, toast]);

  // Separate effect for session check and auth state listener
  useEffect(() => {
    const checkSession = async () => {
      if (oauthCallbackInProgress.current) {
        logger.debug("[Auth checkSession] Deferring session redirect while OAuth callback is processing");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handlePostAuthNavigation(session, 'checkSession');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle all sign-in events including setSession() which triggers TOKEN_REFRESHED
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event) && session) {
        if (oauthCallbackInProgress.current) {
          logger.debug(`[Auth onAuthStateChange] Deferring ${event} while OAuth callback is processing`);
          return;
        }

        // Skip if already redirected by direct OAuth call, checkSession, or previous event
        if (hasRedirected.current) {
          logger.debug(`[Auth onAuthStateChange] Skipping ${event} - already redirected`);
          return;
        }
        
        const timestamp = Date.now();
        logger.info(`[Auth onAuthStateChange] Event: ${event} at ${timestamp}, redirecting...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        await handlePostAuthNavigation(session, `onAuthStateChange:${event}`);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (appleFallbackTimeout.current) {
        clearTimeout(appleFallbackTimeout.current);
      }
      if (navigationSafetyTimeout.current) {
        clearTimeout(navigationSafetyTimeout.current);
        navigationSafetyTimeout.current = null;
      }
    };
  }, [handlePostAuthNavigation]);

  // Removed redundant authContext effect - onAuthStateChange already handles this

  // Import the redirect URL helper at the top of the component
  // (moved to import statement)

  const showAccountCreationError = useCallback((message: string) => {
    toast({
      title: ACCOUNT_CREATION_ERROR_TOAST_TITLE,
      description: message,
      variant: "destructive",
    });
  }, [toast]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    clearPendingPostAuthNavigationContext();

    // Sanitize inputs before validation
    const sanitizedEmail = email.trim().toLowerCase();
    const result = isLogin
      ? loginSchema.safeParse({ email: sanitizedEmail, password })
      : signupSchema.safeParse({ email: sanitizedEmail, password, confirmPassword });
    if (!result.success) {
      const message = result.error.errors[0].message;
      setInlineError(message);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const authData = await invokeAuthGateway({
          action: "sign_in_password",
          email: sanitizedEmail,
          password,
        });

        const accessToken = typeof authData.access_token === "string" ? authData.access_token : null;
        const refreshToken = typeof authData.refresh_token === "string" ? authData.refresh_token : null;

        if (!accessToken || !refreshToken) {
          throw new Error("Invalid email or password.");
        }

        const { error: sessionError, data: { session } } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) throw sessionError;

        await handlePostAuthNavigation(session, 'passwordSignIn');
      } else {
        const authData = await invokeAuthGateway({
          action: "sign_up_password",
          email: sanitizedEmail,
          password,
          redirectTo: getRedirectUrlWithPath('/'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });

        const accessToken = typeof authData.access_token === "string" ? authData.access_token : null;
        const refreshToken = typeof authData.refresh_token === "string" ? authData.refresh_token : null;

        if (accessToken && refreshToken) {
          const { error: sessionError, data: { session } } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          await handlePostAuthNavigation(session, 'signUpImmediate');
        } else {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link to complete your registration.",
          });
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setInlineError(message);
      if (!isLogin) {
        showAccountCreationError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    
    const sanitizedEmail = email.trim().toLowerCase();
    
    if (!sanitizedEmail) {
      setInlineError("Please enter your email address.");
      return;
    }

    // Validate email format
    const emailValidation = z.string().email().safeParse(sanitizedEmail);
    if (!emailValidation.success) {
      setInlineError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await invokeAuthGateway({
        action: "reset_password",
        email: sanitizedEmail,
        redirectTo: getRedirectUrlWithPath('/auth/reset-password'),
      });

      toast({
        title: "Check your email",
        description: "We've sent you a password reset link",
      });
      setInlineError(null);
      setIsForgotPassword(false);
      setEmail("");
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'apple') => {
    const socialAuthIntent: SocialAuthIntent = getSocialAuthIntent(isLogin);
    let storedPendingSocialAuth = false;

    clearPendingPostAuthNavigationContext();
    setInlineError(null);
    setOauthLoading(provider);
    console.log(`[OAuth Debug] Starting ${provider} sign-in flow`);
    console.log(`[OAuth Debug] Platform: ${Capacitor.isNativePlatform() ? 'Native' : 'Web'}`);
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform?.() ?? 'web';
      const providerSupportsNative = isNative && platform === 'ios';

      // Native Apple Sign-In for iOS
      if (provider === 'apple' && providerSupportsNative && appleNativeReady) {
        const appleFlowStart = Date.now();
        const applePostAuthNavigationContext: PostAuthNavigationContext = {
          provider: "apple",
          intent: socialAuthIntent,
          preferGuardedLanding: socialAuthIntent === "sign_in",
        };
        console.log('[Apple OAuth] Initiating native Apple sign-in');
        
        // Generate secure random nonce (Supabase provides this method)
        const rawNonce = crypto.randomUUID();
        logger.debug('[Auth Apple] Nonce generated');
        
        // Hash the nonce for Apple (Apple requires SHA-256 hashed nonce)
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(rawNonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        logger.debug('[Auth Apple] Nonce prepared for authorization');

        console.log('[Apple OAuth] Calling SignInWithApple.authorize with clientId: com.darrylgraham.revolution');
        
        const authorizeStart = Date.now();
        const result: SignInWithAppleResponse = await SignInWithApple.authorize({
          clientId: 'com.darrylgraham.revolution', // Use bundle ID for native iOS
          redirectURI: 'com.darrylgraham.revolution://',
          scopes: 'email name',
          state: crypto.randomUUID(), // Random state for security
          nonce: hashedNonce, // Hashed nonce for Apple
        });
        console.log(`[Apple OAuth] authorize() completed in ${Date.now() - authorizeStart}ms`);

        console.log('[Apple OAuth] SignInWithApple result:', {
          hasIdentityToken: !!result.response.identityToken,
          hasEmail: !!result.response.email,
          hasUser: !!result.response.user
        });

        // Verify identity token exists
        if (!result.response.identityToken) {
          console.error('[Apple OAuth] No identity token in response');
          throw new Error('Apple Sign-In failed - no identity token returned');
        }

        console.log('[Apple OAuth] Calling apple-native-auth edge function');

        // Call our edge function to handle native Apple auth
        const edgeInvokeStart = Date.now();
        const { data: sessionData, error: functionError } = await supabase.functions.invoke('apple-native-auth', {
          body: {
            identityToken: result.response.identityToken,
            rawNonce,
            intent: socialAuthIntent,
          }
        });
        const functionErrorBody = functionError ? await readFunctionErrorContext(functionError) : null;
        console.log(`[Apple OAuth] apple-native-auth completed in ${Date.now() - edgeInvokeStart}ms`);

        console.log('[Apple OAuth] Edge function response:', { 
          hasAccessToken: !!sessionData?.access_token,
          hasRefreshToken: !!sessionData?.refresh_token,
          error: functionErrorBody?.error || functionError?.message,
          errorCode: functionErrorBody?.code
        });

        if (functionError) {
          if (functionErrorBody?.code === 'ACCOUNT_NOT_FOUND') {
            setInlineError(getSocialAccountNotFoundMessage('apple'));
            setIsLogin(true);
            setIsForgotPassword(false);
            return;
          }

          if (functionErrorBody?.code === 'APPLE_EMAIL_MISSING') {
            console.warn('[Apple OAuth] Missing email for Apple ID, prompting user to re-register');
            setInlineError("We couldn’t create an account with your Apple ID. Open Settings, remove Revolution from Sign in with Apple, then try again and share your email.");
            setIsLogin(true);
            setIsForgotPassword(false);
            return;
          }

          if (functionErrorBody?.code === 'APPLE_NONCE_MISSING' || functionErrorBody?.code === 'APPLE_NONCE_MISMATCH') {
            throw new Error('Apple Sign-In security check failed. Please try again.');
          }

          throw new Error(await getAppleAuthErrorMessage(functionError, socialAuthIntent));
        }
        if (!sessionData?.access_token || !sessionData?.refresh_token) {
          clearPendingPostAuthNavigationContext();
          throw new Error('Failed to get session tokens from edge function');
        }

        const nativeAppleSessionUserId =
          sessionData?.user && typeof sessionData.user === "object" && "id" in sessionData.user
            ? (sessionData.user.id as string | undefined)
            : undefined;

        if (nativeAppleSessionUserId) {
          setPendingPostAuthNavigationContext(
            nativeAppleSessionUserId,
            applePostAuthNavigationContext,
          );
        }

        // Set the session with tokens from edge function
        const setSessionStart = Date.now();
        const { error: sessionError, data: { session: newSession } } = await supabase.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });
        console.log(`[Apple OAuth] setSession completed in ${Date.now() - setSessionStart}ms`);

        if (sessionError) {
          clearPendingPostAuthNavigationContext(nativeAppleSessionUserId);
          throw sessionError;
        }

        // Ensure Supabase client state reflects the session before navigating
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const sessionToUse = newSession ?? currentSession;

        if (!sessionToUse) {
          clearPendingPostAuthNavigationContext(nativeAppleSessionUserId);
          throw new Error('Failed to establish Supabase session after Apple sign-in');
        }

        setPendingPostAuthNavigationContext(
          sessionToUse.user.id,
          applePostAuthNavigationContext,
        );

        const sessionSetTime = Date.now();
        console.log(`[Apple OAuth] Session set successfully at ${sessionSetTime}, proceeding to navigation`);
        console.log('[Apple OAuth] Triggering post-auth navigation');
        void handlePostAuthNavigation(
          sessionToUse,
          'appleNative',
          applePostAuthNavigationContext,
        );
        console.log(`[Apple OAuth] Total native flow completed in ${Date.now() - appleFlowStart}ms`);

        // Fallback: manually redirect if onAuthStateChange doesn't fire (increased to 800ms to avoid race conditions)
        if (sessionToUse.user) {
          appleFallbackTimeout.current = setTimeout(async () => {
            try {
              // Check if already redirected by onAuthStateChange
              if (window.location.pathname !== '/auth') {
                console.log(`[Apple OAuth Fallback] Already redirected, skipping (${Date.now() - sessionSetTime}ms since session set)`);
                return;
              }
              console.log(`[Apple OAuth Fallback] Executing manual redirect at ${Date.now()} (${Date.now() - sessionSetTime}ms since session set)`);
              await handlePostAuthNavigation(
                sessionToUse,
                'appleNativeFallback',
                applePostAuthNavigationContext,
              );
            } catch (error) {
              console.error('[Apple OAuth Fallback] Error during redirect:', error);
              // Fallback to guarded home for native Apple sign-in, or onboarding otherwise.
              navigate(applePostAuthNavigationContext.preferGuardedLanding ? '/' : '/onboarding');
            }
          }, 800);
        }
        return;
      }

      // Web OAuth fallback for Apple Sign-In
      if (providerSupportsNative && !appleNativeReady) {
        console.warn(`[${provider} OAuth] Native plugin unavailable - falling back to web flow`);
      }

      console.log(`[${provider} OAuth] Using web OAuth flow`);
      console.log(`[${provider} OAuth] Redirect URL:`, getRedirectUrl());

      // Use standard Supabase OAuth for Apple web fallback
      storedPendingSocialAuth = storePendingSocialAuthAttempt({
        provider,
        intent: socialAuthIntent,
      });
      const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectUrlWithPath('/auth'),
        },
      });

      console.log(`[${provider} OAuth] OAuth response:`, { 
        hasUrl: !!oauthData?.url, 
        provider: oauthData?.provider,
        error: error?.message 
      });

      if (error) throw error;
    } catch (error) {
      clearPendingPostAuthNavigationContext();
      if (storedPendingSocialAuth) {
        clearPendingSocialAuthAttempt();
      }

      const message = getErrorMessage(error);
      console.error(`[${provider} OAuth] Error caught:`, {
        message,
        code: (error as { code?: string })?.code,
        status: (error as { status?: number })?.status,
        fullError: error
      });
      
      // Handle user cancellation gracefully (don't show error toast)
      if (message.includes('1001') || message.toLowerCase().includes('cancel')) {
        console.log(`[${provider} OAuth] User cancelled sign-in`);
        return; // User cancelled, just return silently
      }

      setInlineError(getAppleErrorDescription(error));
    } finally {
      setOauthLoading(null);
    }
  };

  const fieldLabelClassName = "text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/[0.5]";
  const fieldInputClassName =
    "h-[3.35rem] rounded-[1.15rem] border border-[#2a1a49] bg-[#12091f] px-5 text-[0.98rem] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.01),0_10px_28px_rgba(5,2,16,0.45),inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-white/[0.34] focus-visible:border-[#4b2c7e] focus-visible:ring-[3px] focus-visible:ring-[#b86dff]/15 focus-visible:ring-offset-0";
  const passwordToggleButtonClassName =
    "absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/[0.58] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86dff]/35";
  const passwordInputClassName = `${fieldInputClassName} pr-14`;
  const switchMode = () => {
    setInlineError(null);
    if (isForgotPassword) {
      setIsForgotPassword(false);
      setEmail("");
      return;
    }

    const nextIsLogin = !isLogin;
    const nextSearchParams = new URLSearchParams(location.search);
    if (nextIsLogin) {
      nextSearchParams.delete("mode");
    } else {
      nextSearchParams.set("mode", "signup");
    }

    setIsLogin(nextIsLogin);
    setConfirmPassword("");
    setShowSignupPassword(false);
    setShowSignupConfirmPassword(false);
    navigate(
      {
        pathname: location.pathname,
        search: nextSearchParams.toString() ? `?${nextSearchParams.toString()}` : "",
      },
      { replace: true },
    );
  };

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[#090311] text-pure-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_82%,rgba(179,92,255,0.16),transparent_28%),radial-gradient(circle_at_50%_18%,rgba(39,18,71,0.3),transparent_38%),linear-gradient(180deg,#090311_0%,#0a0314_38%,#09020f_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[30vh] bg-[radial-gradient(circle_at_50%_100%,rgba(209,100,255,0.12),transparent_52%)]" />
      <section
        id="auth-form"
        className="relative flex min-h-[100svh] items-start justify-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top)+1rem)] sm:items-center sm:pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-[max(4.5rem,env(safe-area-inset-top)+2.75rem)]"
      >
        <div className="relative z-10 w-full max-w-[20.5rem] py-2 sm:max-w-[21.75rem] sm:py-4">
          <h1 className="sr-only">
            {isForgotPassword ? "Reset password" : isLogin ? "Sign in" : "Create account"}
          </h1>

          <div className="space-y-4 sm:space-y-5">
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2 pb-1">
                  <p className="text-sm leading-6 text-white/[0.72]">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="email" className={fieldLabelClassName}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setInlineError(null);
                      setEmail(e.target.value);
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="email"
                    required
                    className={fieldInputClassName}
                  />
                </div>
                <Button
                  type="submit"
                  className="h-[3.35rem] w-full rounded-[1.1rem] bg-gradient-to-r from-[#b254ea] via-[#c45ff3] to-[#df67dc] text-[0.98rem] font-semibold text-pure-white shadow-[0_20px_38px_rgba(143,54,224,0.34)] hover:brightness-105"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="space-y-3">
                  <Label htmlFor="email" className={fieldLabelClassName}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setInlineError(null);
                      setEmail(e.target.value);
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="email"
                    required
                    className={fieldInputClassName}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="password" className={fieldLabelClassName}>Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setInlineError(null);
                        setPassword(e.target.value);
                      }}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      className={passwordInputClassName}
                    />
                    <button
                      type="button"
                      aria-label={showSignupPassword ? "Hide password" : "Show password"}
                      aria-pressed={showSignupPassword}
                      onClick={() => setShowSignupPassword((isVisible) => !isVisible)}
                      className={passwordToggleButtonClassName}
                    >
                      {showSignupPassword ? (
                        <EyeOff aria-hidden="true" className="h-5 w-5" />
                      ) : (
                        <Eye aria-hidden="true" className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineError(null);
                        setIsForgotPassword(true);
                      }}
                      className="pl-1 pt-0.5 text-[0.74rem] font-medium text-white/[0.6] transition-colors hover:text-pure-white"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                {!isLogin && (
                  <div className="space-y-3">
                    <Label htmlFor="confirmPassword" className={fieldLabelClassName}>Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showSignupConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setInlineError(null);
                          setConfirmPassword(e.target.value);
                        }}
                        autoComplete="new-password"
                        required
                        className={`${fieldInputClassName} pr-14`}
                      />
                      <button
                        type="button"
                        aria-label={showSignupConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        aria-pressed={showSignupConfirmPassword}
                        onClick={() => setShowSignupConfirmPassword((isVisible) => !isVisible)}
                        className={passwordToggleButtonClassName}
                      >
                        {showSignupConfirmPassword ? (
                          <EyeOff aria-hidden="true" className="h-5 w-5" />
                        ) : (
                          <Eye aria-hidden="true" className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  className="h-[3.35rem] w-full rounded-[1.1rem] bg-gradient-to-r from-[#b254ea] via-[#c45ff3] to-[#df67dc] text-[0.98rem] font-semibold text-pure-white shadow-[0_22px_42px_rgba(148,58,230,0.38)] hover:brightness-105"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
                </Button>
                {!isLogin && (
                  <p className="px-1 text-center text-xs leading-5 text-white/[0.56]">
                    By creating an account, you agree to Cosmiq&apos;s{" "}
                    <a className="underline underline-offset-2 hover:text-white" href="/terms">Terms</a>
                    {" "}and acknowledge the{" "}
                    <a className="underline underline-offset-2 hover:text-white" href="/privacy">Privacy Policy</a>.
                  </p>
                )}
              </form>
            )}

            {!isForgotPassword && (
              <>
                <div className="relative pt-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.12]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="rounded-[0.45rem] bg-[#171023] px-2.5 py-0.5 text-[0.72rem] text-white/[0.58] shadow-[0_10px_20px_rgba(0,0,0,0.3)]">
                      or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={loading || oauthLoading !== null}
                  className="h-[3.15rem] w-full rounded-[1rem] bg-white text-[0.98rem] font-semibold text-black shadow-[0_16px_30px_rgba(0,0,0,0.26)] hover:bg-white/95"
                >
                  {oauthLoading === 'apple' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-black/20 border-t-black rounded-full" />
                  ) : (
                    <>
                      <svg className="h-[1.05rem] w-[1.05rem]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      {isLogin ? 'Sign in with Apple' : 'Sign up with Apple'}
                    </>
                  )}
                </Button>
              </>
            )}

            {inlineError ? (
              <div
                role="alert"
                className="rounded-[1.35rem] bg-[#ea5d57] px-5 py-5 shadow-[0_22px_46px_rgba(60,8,16,0.34)]"
              >
                <p className="text-[0.95rem] font-semibold text-pure-white">Error</p>
                <p className="mt-1 text-sm leading-6 text-pure-white/[0.88]">{inlineError}</p>
              </div>
            ) : null}

            <div className="pt-0.5 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-[0.93rem] font-medium text-white/[0.72] underline underline-offset-[3px] transition-colors hover:text-white"
              >
                {isForgotPassword 
                  ? "Back to Sign In" 
                  : isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
