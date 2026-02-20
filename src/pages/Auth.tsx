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
import { getAuthRedirectPath, ensureProfile } from "@/utils/authRedirect";
import { logger } from "@/utils/logger";
import { getRedirectUrlWithPath, getRedirectUrl } from '@/utils/redirectUrl';
import { signinBackground } from "@/assets/backgrounds";
import { StaticBackgroundImage } from "@/components/StaticBackgroundImage";

const POST_AUTH_NAVIGATION_TIMEOUT_MS = 5000;
const POST_AUTH_DEFAULT_PATH = '/onboarding';

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


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          logger.warn(`[Auth ${source}] Timeout telemetry profile check failed`, { error: error.message });
          return;
        }

        logger.info(`[Auth ${source}] Timeout telemetry profile check completed`, {
          onboardingCompleted: data?.onboarding_completed,
          durationMs: Date.now() - telemetryStart,
        });
      })()).catch((error: unknown) => {
        logger.warn(`[Auth ${source}] Timeout telemetry failed`, { error });
      });
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const deadlineTask = new Promise<"deadline">((resolve) => {
      timeoutId = setTimeout(() => {
        logger.warn(`[Auth ${source}] TIMEOUT after ${POST_AUTH_NAVIGATION_TIMEOUT_MS}ms - hard fallback`);
        toast({
          title: "Taking longer than expected",
          description: "Redirecting you now...",
        });

        finalizeNavigation(POST_AUTH_DEFAULT_PATH, "deadline");
        emitTimeoutTelemetry();
        resolve("deadline");
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

  // Track whether the native SocialLogin plugin is ready for use
  const [googleNativeReady, setGoogleNativeReady] = useState(false);
  const [appleNativeReady, setAppleNativeReady] = useState(false);

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
      if (typeof window === "undefined" || hasRedirected.current) return;

      const url = new URL(window.location.href);
      const hasAccessToken = url.hash.includes("access_token");
      const code = url.searchParams.get("code");

      // Only run when coming back from an OAuth provider
      if (!code && !hasAccessToken) return;

      try {
        // If Supabase didn't automatically exchange the code, do it manually
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await handlePostAuthNavigation(data.session, "oauthCodeExchange");
        } else {
          // Hash-based tokens (implicit flow)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await handlePostAuthNavigation(session, "oauthHashSession");
          }
        }
      } catch (error) {
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
      }
    };

    handleOAuthCallback();
  }, [handlePostAuthNavigation, toast]);

  // Separate effect for session check and auth state listener
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handlePostAuthNavigation(session, 'checkSession');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle all sign-in events including setSession() which triggers TOKEN_REFRESHED
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event) && session) {
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

    // Sanitize inputs before validation
    const sanitizedEmail = email.trim().toLowerCase();
    const result = authSchema.safeParse({ 
      email: sanitizedEmail, 
      password,
      confirmPassword: isLogin ? undefined : confirmPassword 
    });
    if (!result.success) {
      toast({
        title: "Validation Error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password,
        });

        if (error) throw error;

        const { data: { session } } = await supabase.auth.getSession();
        await handlePostAuthNavigation(session, 'passwordSignIn');
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password,
          options: {
            emailRedirectTo: getRedirectUrlWithPath('/'),
            data: {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            }
          },
        });

        if (error) {
          // Special handling for email already registered
          if (error.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw error;
        }
        
        // Check if we have a session (email confirmation disabled in Supabase)
        // If session exists, user is immediately logged in - navigate them
        if (signUpData?.session) {
          await handlePostAuthNavigation(signUpData.session, 'signUpImmediate');
        } else {
          // Email confirmation required - show message
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link to complete your registration.",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedEmail = email.trim().toLowerCase();
    
    if (!sanitizedEmail) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address",
      });
      return;
    }

    // Validate email format
    const emailValidation = z.string().email().safeParse(sanitizedEmail);
    if (!emailValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: getRedirectUrlWithPath('/auth/reset-password'),
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link",
        });
        setIsForgotPassword(false);
        setEmail("");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
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
            body: { idToken }
          });

          console.log('[Google OAuth] Edge function response:', { 
            hasAccessToken: !!sessionData?.access_token,
            hasRefreshToken: !!sessionData?.refresh_token,
            error: functionError?.message 
          });

          if (functionError) throw functionError;
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
          }
        });
        console.log(`[Apple OAuth] apple-native-auth completed in ${Date.now() - edgeInvokeStart}ms`);

        console.log('[Apple OAuth] Edge function response:', { 
          hasAccessToken: !!sessionData?.access_token,
          hasRefreshToken: !!sessionData?.refresh_token,
          error: functionError?.message,
          errorCode: sessionData?.code
        });

        if (functionError) {
          if (sessionData?.code === 'APPLE_EMAIL_MISSING') {
            console.warn('[Apple OAuth] Missing email for Apple ID, prompting user to re-register');
            toast({
              title: "Finish setting up Apple Sign-In",
              description: "We couldn’t create an account with your Apple ID. Open Settings → Apple ID → Password & Security → Sign in with Apple, remove Revolution, then try again to share your email.",
            });
            setIsLogin(true);
            setIsForgotPassword(false);
            return;
          }

          if (sessionData?.code === 'APPLE_NONCE_MISSING' || sessionData?.code === 'APPLE_NONCE_MISMATCH') {
            throw new Error('Apple Sign-In security check failed. Please try again.');
          }

          throw new Error(sessionData?.error || functionError.message || 'Apple Sign-In failed');
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
      const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectUrlWithPath('/'),
        },
      });

      console.log(`[${provider} OAuth] OAuth response:`, { 
        hasUrl: !!oauthData?.url, 
        provider: oauthData?.provider,
        error: error?.message 
      });

      if (error) throw error;
    } catch (error) {
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
        toast({
          title: "Apple Sign-In Error",
          description: getAppleErrorDescription(error),
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: message || 'Failed to sign in. Please try again.',
        variant: "destructive",
      });
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen relative">
      <StaticBackgroundImage background={backgroundImage} />
      {/* Auth Form Section with iOS safe areas */}
      <section
        id="auth-form"
        className="min-h-screen relative flex items-center justify-center pt-safe-top pb-safe-bottom"
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/50" />
        <div className="relative z-10 w-full px-6 md:max-w-md space-y-8">
          <div className="space-y-6">
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-steel text-sm uppercase tracking-wide">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-obsidian/50 border-royal-purple/30 text-pure-white h-12 focus:border-royal-purple"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-royal-purple hover:bg-accent-purple text-pure-white font-bold h-12 text-lg"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-steel text-sm uppercase tracking-wide">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-obsidian/50 border-royal-purple/30 text-pure-white h-12 focus:border-royal-purple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-steel text-sm uppercase tracking-wide">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-obsidian/50 border-royal-purple/30 text-pure-white h-12 focus:border-royal-purple"
                  />
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-pure-white/70 hover:text-pure-white transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-steel text-sm uppercase tracking-wide">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-obsidian/50 border-royal-purple/30 text-pure-white h-12 focus:border-royal-purple"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full bg-royal-purple hover:bg-accent-purple text-pure-white font-bold h-12 text-lg"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
                </Button>
              </form>
            )}

            {/* Apple Sign In - divider and button */}
            {!isForgotPassword && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-card px-4 text-white/60">or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={loading || oauthLoading !== null}
                  className="w-full bg-white hover:bg-white/90 text-black font-semibold h-12 text-base flex items-center justify-center gap-3 rounded-xl"
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

            <div className="text-center space-y-3">
              <Button
                variant="link"
                onClick={() => {
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                    setEmail("");
                  } else {
                    setIsLogin(!isLogin);
                    setConfirmPassword(""); // Clear confirm password when switching modes
                  }
                }}
                className="text-pure-white/90 hover:text-stardust-gold underline underline-offset-4"
              >
                {isForgotPassword 
                  ? "Back to Sign In" 
                  : isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
              
              {/* Continue as Guest - for App Store compliance */}
              <div className="pt-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/preview")}
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  Continue as Guest
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
