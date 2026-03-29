import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { safeNavigate } from "@/utils/nativeNavigation";
import { SignInWithApple, SignInWithAppleResponse } from '@capacitor-community/apple-sign-in';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { getAuthRedirectPath, getProfileAwareAuthFallbackPath, ensureProfile } from "@/utils/authRedirect";
import { logger } from "@/utils/logger";
import { hasWalkthroughCompleted } from "@/utils/profileOnboarding";
import { getRedirectUrlWithPath, getRedirectUrl } from '@/utils/redirectUrl';
import {
  clearPendingSocialAuthAttempt,
  getSocialAccountNotFoundMessage,
  getSocialAuthIntent,
  readPendingSocialAuthAttempt,
  storePendingSocialAuthAttempt,
  type PendingSocialAuthAttempt,
  type SocialAuthIntent,
} from "@/utils/socialAuth";
import { signinBackground } from "@/assets/backgrounds";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";

const POST_AUTH_NAVIGATION_TIMEOUT_MS = 5000;
const POST_AUTH_DEFAULT_PATH = '/onboarding';

const hasOAuthCallbackParams = (): boolean => {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  return Boolean(url.searchParams.get("code") || url.hash.includes("access_token"));
};

const authSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .min(3, "Email too short")
    .max(255, "Email too long")
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9]|.*[!@#$%^&*])/, "Password must contain letters and at least one number or special character"),
  confirmPassword: z.string().optional()
}).refine((data) => {
  // Only validate password match during signup (when confirmPassword is provided)
  if (data.confirmPassword !== undefined) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
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
    normalized.includes("timeout")
  ) {
    return "Network issue while signing in with Apple. Check your connection and try again.";
  }

  return message || "Apple Sign-In failed. Please try again.";
};

const invokeAuthGateway = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("auth-gateway", {
    body: payload,
  });

  if (error) {
    let message = "Request could not be completed.";

    const maybeErrorWithContext = error as { context?: { json?: () => Promise<Record<string, unknown>> } };
    if (maybeErrorWithContext.context?.json) {
      try {
        const body = await maybeErrorWithContext.context.json();
        if (typeof body?.error === "string" && body.error.trim()) {
          message = body.error;
        }
      } catch {
        // Fall through to the generic message.
      }
    }

    throw new Error(message);
  }

  return (data ?? {}) as Record<string, unknown>;
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
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const backgroundImage = signinBackground;

  const handlePostAuthNavigation = useCallback(async (session: Session | null, source: string) => {
    const startTime = Date.now();
    logger.info(`[Auth ${source}] handlePostAuthNavigation START`, {
      hasSession: !!session,
      hasRedirected: hasRedirected.current,
      userId: session?.user?.id?.substring(0, 8)
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

      navigationFinalized = true;
      logger.info(
        `[Auth ${source}] Finalizing navigation to ${path} via ${reason} (total time: ${Date.now() - startTime}ms)`,
      );
      safeNavigate(navigate, path);

      // Safety valve: if routing fails and we are still on /auth, allow retry.
      setTimeout(() => {
        if (window.location.pathname === '/auth') {
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
        toast({
          title: "Taking longer than expected",
          description: "Redirecting you now...",
        });

        void Promise.resolve((async () => {
          let fallbackPath = POST_AUTH_DEFAULT_PATH;

          try {
            const fallbackStartTime = Date.now();
            fallbackPath = await getProfileAwareAuthFallbackPath(session.user.id);
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
        logger.info(`[Auth ${source}] Calling ensureProfile...`);
        const profileStartTime = Date.now();
        await ensureProfile(session.user.id, session.user.email);
        logger.info(`[Auth ${source}] ensureProfile completed in ${Date.now() - profileStartTime}ms`);

        logger.info(`[Auth ${source}] Calling getAuthRedirectPath...`);
        const redirectStartTime = Date.now();
        const path = await getAuthRedirectPath(session.user.id);
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
  }, [navigate, toast]);
  
  // Refs to track OAuth fallback timeouts (for cleanup)
  const googleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  const appleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to track if initial session check has redirected
  const hasRedirected = useRef(false);
  
  // Ref to prevent re-renders during initialization
  const initializationComplete = useRef(false);
  const oauthCallbackInProgress = useRef(hasOAuthCallbackParams());

  // Track whether the native SocialLogin plugin is ready for use
  const [googleNativeReady, setGoogleNativeReady] = useState(false);
  const [appleNativeReady, setAppleNativeReady] = useState(false);

  const blockSocialSignIn = useCallback(
    async (attempt: PendingSocialAuthAttempt, source: string) => {
      logger.warn(`[Auth ${source}] Blocking social sign-in with no returning account match`, attempt);
      clearPendingSocialAuthAttempt();

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
    [],
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

  // Separate effect for OAuth initialization to prevent re-renders
  useEffect(() => {
    if (initializationComplete.current) return;

    const initializeAuth = async () => {
      // Initialize SocialLogin plugin for native platforms
      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SocialLogin')) {
        try {
          const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
          const iOSClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID;

          logger.debug('[OAuth Init] Initializing with', {
            hasWebClientId: !!webClientId,
            hasIOSClientId: !!iOSClientId
          });

          if (!webClientId || !iOSClientId) {
            logger.error('[OAuth Init] Missing Google Client IDs in environment variables');
            throw new Error('Google Client IDs not configured');
          }

          await SocialLogin.initialize({
            google: {
              webClientId,
              iOSClientId,
              mode: 'online'
            }
          });

          logger.info('[OAuth Init] SocialLogin initialized successfully');
          setGoogleNativeReady(true);
        } catch (error) {
          logger.error('[OAuth Init] Failed to initialize SocialLogin', { error });
          setGoogleNativeReady(false);
        }
      } else {
        logger.warn('[OAuth Init] SocialLogin plugin unavailable - using web OAuth fallback');
        setGoogleNativeReady(false);
      }
      initializationComplete.current = true;
    };

    initializeAuth();
  }, []); // No dependencies - run only once

  useEffect(() => {
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
      // Clean up any pending OAuth fallback timeouts to prevent memory leaks
      if (googleFallbackTimeout.current) {
        clearTimeout(googleFallbackTimeout.current);
      }
      if (appleFallbackTimeout.current) {
        clearTimeout(appleFallbackTimeout.current);
      }
    };
  }, [handlePostAuthNavigation]);

  // Removed redundant authContext effect - onAuthStateChange already handles this

  // Import the redirect URL helper at the top of the component
  // (moved to import statement)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    // Sanitize inputs before validation
    const sanitizedEmail = email.trim().toLowerCase();
    const result = authSchema.safeParse({ 
      email: sanitizedEmail, 
      password,
      confirmPassword: isLogin ? undefined : confirmPassword 
    });
    if (!result.success) {
      setInlineError(result.error.errors[0].message);
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
      setInlineError(getErrorMessage(error));
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

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    const socialAuthIntent: SocialAuthIntent = getSocialAuthIntent(isLogin);
    let storedPendingSocialAuth = false;

    setInlineError(null);
    setOauthLoading(provider);
    console.log(`[OAuth Debug] Starting ${provider} sign-in flow`);
    console.log(`[OAuth Debug] Platform: ${Capacitor.isNativePlatform() ? 'Native' : 'Web'}`);
    
    try {
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform?.() ?? 'web';
      const providerSupportsNative = provider === 'google' ? isNative : (isNative && platform === 'ios');

      // Native Google Sign-In for iOS/Android
      if (provider === 'google' && providerSupportsNative && googleNativeReady) {
        console.log('[Google OAuth] Initiating native Google sign-in');
        
        const result = await SocialLogin.login({
          provider: 'google',
          options: {}
        });

        console.log('[Google OAuth] SocialLogin result:', JSON.stringify(result, null, 2));

        // The plugin sometimes returns the payload under `result`, sometimes directly at the root
        const nativeResponse = (result as unknown as { result?: Record<string, unknown> })?.result ?? result;

        // Prefer explicit responseType when available but don't block when it's missing
        const responseType = (nativeResponse as { responseType?: string })?.responseType;
        const idToken = (nativeResponse as { idToken?: string })?.idToken;

        // Check if we got a valid response
        if (idToken) {
          console.log('[Google OAuth] ID token received:', `${idToken.substring(0, 20)}...`);

          if (responseType && responseType !== 'online') {
            console.warn(`[Google OAuth] Unexpected responseType (${responseType}), continuing with idToken flow`);
          }

          // Continue using the idToken even if the provider/responseType metadata is missing

          console.log('[Google OAuth] Calling google-native-auth edge function');
          
          // Call our edge function to handle native Google auth
          const { data: sessionData, error: functionError } = await supabase.functions.invoke('google-native-auth', {
            body: { idToken, intent: socialAuthIntent }
          });

          const functionErrorBody = functionError ? await readFunctionErrorContext(functionError) : null;

          console.log('[Google OAuth] Edge function response:', { 
            hasAccessToken: !!sessionData?.access_token,
            hasRefreshToken: !!sessionData?.refresh_token,
            error: functionErrorBody?.error || functionError?.message,
            errorCode: functionErrorBody?.code,
          });

          if (functionError) {
            if (functionErrorBody?.code === 'ACCOUNT_NOT_FOUND') {
              setIsLogin(true);
              setIsForgotPassword(false);
              setInlineError(getSocialAccountNotFoundMessage('google'));
              return;
            }

            throw new Error(
              typeof functionErrorBody?.error === 'string'
                ? functionErrorBody.error
                : functionError.message || 'Google Sign-In failed',
            );
          }
          if (!sessionData?.access_token || !sessionData?.refresh_token) {
            throw new Error('Failed to get session tokens from edge function');
          }

          // Set the session with tokens from edge function
          const { error: sessionError, data: { session: newSession } } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });

          if (sessionError) throw sessionError;

          // Ensure Supabase client state has the session before navigating
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          const sessionToUse = newSession ?? currentSession;

          if (!sessionToUse) {
            throw new Error('Failed to establish Supabase session after Google sign-in');
          }

          const sessionSetTime = Date.now();
          console.log(`[Google OAuth] Session set successfully at ${sessionSetTime}, proceeding to navigation`);
          await handlePostAuthNavigation(sessionToUse, 'googleNative');

          // Fallback: manually redirect if onAuthStateChange doesn't fire (increased to 800ms to avoid race conditions)
          if (sessionToUse.user) {
            googleFallbackTimeout.current = setTimeout(async () => {
              try {
                // Check if already redirected by onAuthStateChange
                if (window.location.pathname !== '/auth') {
                  console.log(`[Google OAuth Fallback] Already redirected, skipping (${Date.now() - sessionSetTime}ms since session set)`);
                  return;
                }
                console.log(`[Google OAuth Fallback] Executing manual redirect at ${Date.now()} (${Date.now() - sessionSetTime}ms since session set)`);
                await handlePostAuthNavigation(sessionToUse, 'googleNativeFallback');
              } catch (error) {
                console.error('[Google OAuth Fallback] Error during redirect:', error);
                // Fallback to onboarding if something goes wrong
                navigate('/onboarding');
              }
            }, 800);
          }
          return;
        } else {
          console.error('[Google OAuth] Missing idToken in native response:', result);
          throw new Error('Google sign-in did not return an ID token');
        }
      }

      // Native Apple Sign-In for iOS
      if (provider === 'apple' && providerSupportsNative && appleNativeReady) {
        const appleFlowStart = Date.now();
        console.log('[Apple OAuth] Initiating native Apple sign-in');
        
        // Generate secure random nonce (Supabase provides this method)
        const rawNonce = crypto.randomUUID();
        console.log('[Apple OAuth] Raw nonce generated:', rawNonce.substring(0, 8) + '...');
        
        // Hash the nonce for Apple (Apple requires SHA-256 hashed nonce)
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(rawNonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedNonce = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        console.log('[Apple OAuth] Hashed nonce:', hashedNonce.substring(0, 16) + '...');

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

          throw new Error(
            typeof functionErrorBody?.error === 'string'
              ? functionErrorBody.error
              : functionError.message || 'Apple Sign-In failed',
          );
        }
        if (!sessionData?.access_token || !sessionData?.refresh_token) {
          throw new Error('Failed to get session tokens from edge function');
        }

        // Set the session with tokens from edge function
        const setSessionStart = Date.now();
        const { error: sessionError, data: { session: newSession } } = await supabase.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });
        console.log(`[Apple OAuth] setSession completed in ${Date.now() - setSessionStart}ms`);

        if (sessionError) throw sessionError;

        // Ensure Supabase client state reflects the session before navigating
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const sessionToUse = newSession ?? currentSession;

        if (!sessionToUse) {
          throw new Error('Failed to establish Supabase session after Apple sign-in');
        }

        const sessionSetTime = Date.now();
        console.log(`[Apple OAuth] Session set successfully at ${sessionSetTime}, proceeding to navigation`);
        console.log('[Apple OAuth] Triggering post-auth navigation');
        void handlePostAuthNavigation(sessionToUse, 'appleNative');
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
              await handlePostAuthNavigation(sessionToUse, 'appleNativeFallback');
            } catch (error) {
              console.error('[Apple OAuth Fallback] Error during redirect:', error);
              // Fallback to onboarding if something goes wrong
              navigate('/onboarding');
            }
          }, 800);
        }
        return;
      }

      // Web OAuth flow for Google and Apple Sign-In
      if (providerSupportsNative) {
        const providerReady = provider === 'google' ? googleNativeReady : appleNativeReady;
        if (!providerReady) {
          console.warn(`[${provider} OAuth] Native plugin unavailable - falling back to web flow`);
        }
      }

      console.log(`[${provider} OAuth] Using web OAuth flow`);
      console.log(`[${provider} OAuth] Redirect URL:`, getRedirectUrl());

      // Use standard Supabase OAuth for all web providers
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

      if (provider === 'apple') {
        setInlineError(getAppleErrorDescription(error));
        return;
      }
      
      setInlineError(message || 'Failed to sign in. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  };

  const fieldLabelClassName = "text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/[0.62]";
  const fieldInputClassName =
    "h-14 rounded-full border border-white/[0.08] bg-[rgba(16,10,39,0.62)] px-5 text-[0.95rem] text-white shadow-[0_18px_36px_rgba(7,2,24,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl placeholder:text-white/[0.42] focus-visible:border-white/[0.18] focus-visible:ring-white/[0.12] focus-visible:ring-offset-0";
  const switchMode = () => {
    setInlineError(null);
    if (isForgotPassword) {
      setIsForgotPassword(false);
      setEmail("");
      return;
    }

    setIsLogin(!isLogin);
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#080313] text-pure-white">
      <StaticBackgroundImage
        background={backgroundImage}
        className="fixed inset-0 -z-20 h-full w-full scale-[1.02] object-cover object-center pointer-events-none select-none"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgba(255,220,240,0.24),transparent_17%),radial-gradient(circle_at_52%_44%,rgba(201,109,255,0.18),transparent_22%),linear-gradient(180deg,rgba(10,8,31,0.14)_0%,rgba(12,10,38,0.32)_44%,rgba(7,5,23,0.9)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[45vh] bg-gradient-to-t from-[#050313] via-[#050313]/70 to-transparent" />
      <section
        id="auth-form"
        className="min-h-screen relative flex items-end justify-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] md:items-center md:px-6"
      >
        <div className="relative z-10 w-full max-w-[23rem] pb-5 md:max-w-md md:pb-0">
          <h1 className="sr-only">
            {isForgotPassword ? "Reset password" : isLogin ? "Sign in" : "Create account"}
          </h1>

          <div className="space-y-6">
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm leading-6 text-white/70">
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
                  className="h-14 w-full rounded-[18px] bg-gradient-to-r from-[#c25eff] via-[#b45fff] to-[#e26cff] text-base font-bold text-pure-white shadow-[0_18px_42px_rgba(165,78,255,0.38)] hover:brightness-105"
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
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setInlineError(null);
                      setPassword(e.target.value);
                    }}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    className={fieldInputClassName}
                  />
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineError(null);
                        setIsForgotPassword(true);
                      }}
                      className="pl-1 text-xs font-medium text-white/[0.72] transition-colors hover:text-pure-white"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                {!isLogin && (
                  <div className="space-y-3">
                    <Label htmlFor="confirmPassword" className={fieldLabelClassName}>Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setInlineError(null);
                        setConfirmPassword(e.target.value);
                      }}
                      autoComplete="new-password"
                      required
                      className={fieldInputClassName}
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  className="h-14 w-full rounded-[18px] bg-gradient-to-r from-[#c25eff] via-[#b45fff] to-[#e26cff] text-base font-bold text-pure-white shadow-[0_18px_42px_rgba(165,78,255,0.38)] hover:brightness-105"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
                </Button>
              </form>
            )}

            {!isForgotPassword && (
              <>
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.16]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="rounded-[6px] bg-[#1d1438]/90 px-3 py-0.5 text-[0.75rem] text-white/[0.72] shadow-[0_8px_18px_rgba(8,3,24,0.35)]">
                      or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={loading || oauthLoading !== null}
                  className="h-12 w-full rounded-[14px] bg-[#f7f8fc] text-base font-semibold text-[#111827] shadow-[0_16px_30px_rgba(0,0,0,0.18)] hover:bg-white"
                >
                  {oauthLoading === 'google' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-[#111827]/20 border-t-[#111827] rounded-full" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M21.6 12.23c0-.68-.06-1.33-.18-1.95H12v3.69h5.39a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.97-4.33 2.97-7.29Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.24-2.52c-.9.6-2.05.97-3.39.97-2.6 0-4.8-1.76-5.58-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22Z"
                        />
                        <path
                          fill="#FBBC04"
                          d="M6.42 13.89A5.99 5.99 0 0 1 6.1 12c0-.66.11-1.29.32-1.89V7.52H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.48l3.34-2.59Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.98c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.96 2.95 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.52l3.34 2.59C7.2 7.74 9.4 5.98 12 5.98Z"
                        />
                      </svg>
                      {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={loading || oauthLoading !== null}
                  className="h-12 w-full rounded-[14px] bg-white text-base font-semibold text-black shadow-[0_16px_30px_rgba(0,0,0,0.28)] hover:bg-white/95"
                >
                  {oauthLoading === 'apple' ? (
                    <div className="animate-spin h-5 w-5 border-2 border-black/20 border-t-black rounded-full" />
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
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
                className="rounded-[22px] bg-[#ea5a54]/95 px-5 py-5 shadow-[0_22px_48px_rgba(61,8,17,0.36)]"
              >
                <p className="text-sm font-bold text-pure-white">Error</p>
                <p className="mt-1 text-sm leading-6 text-pure-white/[0.84]">{inlineError}</p>
              </div>
            ) : null}

            <div className="text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm font-medium text-white/[0.86] underline underline-offset-4 transition-colors hover:text-white"
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
