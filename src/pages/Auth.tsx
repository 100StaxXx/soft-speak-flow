import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { ChevronDown } from "lucide-react";
import { getAuthRedirectPath, ensureProfile } from "@/utils/authRedirect";
import { logger } from "@/utils/logger";
import { getRedirectUrlWithPath, getRedirectUrl } from '@/utils/redirectUrl';
import { useAuth } from "@/hooks/useAuth";
import { signinBackground } from "@/assets/backgrounds";
import { motion, useScroll, useTransform } from "framer-motion";

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
  const { session: authSession } = useAuth();
  
  const backgroundImage = signinBackground;
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });
  
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

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

    // Timeout protection - force navigation after 5 seconds to prevent hanging
    const NAVIGATION_TIMEOUT = 5000;
    let navigationCompleted = false;
    
    const timeoutId = setTimeout(async () => {
      if (!navigationCompleted) {
        logger.warn(`[Auth ${source}] TIMEOUT after ${NAVIGATION_TIMEOUT}ms - checking if returning user`);
        toast({
          title: "Taking longer than expected",
          description: "Redirecting you now...",
        });
        
        // Check if user has completed onboarding before defaulting
        try {
          const { data } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", session.user.id)
            .maybeSingle();
          
          const path = data?.onboarding_completed ? '/tasks' : '/onboarding';
          safeNavigate(navigate, path);
        } catch {
          safeNavigate(navigate, '/onboarding');
        }
      }
    }, NAVIGATION_TIMEOUT);

    try {
      logger.info(`[Auth ${source}] Calling ensureProfile...`);
      const profileStartTime = Date.now();
      await ensureProfile(session.user.id, session.user.email);
      logger.info(`[Auth ${source}] ensureProfile completed in ${Date.now() - profileStartTime}ms`);
      
      logger.info(`[Auth ${source}] Calling getAuthRedirectPath...`);
      const redirectStartTime = Date.now();
      const path = await getAuthRedirectPath(session.user.id);
      logger.info(`[Auth ${source}] getAuthRedirectPath returned "${path}" in ${Date.now() - redirectStartTime}ms`);
      
      navigationCompleted = true;
      clearTimeout(timeoutId);
      
      logger.info(`[Auth ${source}] Navigating to ${path} (total time: ${Date.now() - startTime}ms)`);
      safeNavigate(navigate, path);
      logger.info(`[Auth ${source}] safeNavigate called successfully`);
    } catch (error) {
      navigationCompleted = true;
      clearTimeout(timeoutId);
      
      // Reset on error so user can retry
      hasRedirected.current = false;
      logger.error(`[Auth ${source}] Navigation error after ${Date.now() - startTime}ms`, { error });
      safeNavigate(navigate, '/onboarding');
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
        
        const result: SignInWithAppleResponse = await SignInWithApple.authorize({
          clientId: 'com.darrylgraham.revolution', // Use bundle ID for native iOS
          redirectURI: 'com.darrylgraham.revolution://',
          scopes: 'email name',
          state: crypto.randomUUID(), // Random state for security
          nonce: hashedNonce, // Hashed nonce for Apple
        });

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
        const { data: sessionData, error: functionError } = await supabase.functions.invoke('apple-native-auth', {
          body: { identityToken: result.response.identityToken }
        });

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

          throw new Error(sessionData?.error || functionError.message || 'Apple Sign-In failed');
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

        // Ensure Supabase client state reflects the session before navigating
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const sessionToUse = newSession ?? currentSession;

        if (!sessionToUse) {
          throw new Error('Failed to establish Supabase session after Apple sign-in');
        }

        const sessionSetTime = Date.now();
        console.log(`[Apple OAuth] Session set successfully at ${sessionSetTime}, proceeding to navigation`);
        await handlePostAuthNavigation(sessionToUse, 'appleNative');

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

      // Web OAuth flow for Google and web Apple Sign-In
      if (providerSupportsNative) {
        const providerReady = provider === 'google' ? googleNativeReady : appleNativeReady;
        if (!providerReady) {
          console.warn(`[${provider} OAuth] Native plugin unavailable - falling back to web flow`);
        }
      }

      console.log(`[${provider} OAuth] Using web OAuth flow`);
      console.log(`[${provider} OAuth] Redirect URL:`, getRedirectUrl());
      
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
      console.error(`[${provider} OAuth] Error caught:`, {
        message: error.message,
        code: error.code,
        status: error.status,
        fullError: error
      });
      
      // Handle user cancellation gracefully (don't show error toast)
      if (error.message?.includes('1001') || error.message?.includes('cancel')) {
        console.log(`[${provider} OAuth] User cancelled sign-in`);
        return; // User cancelled, just return silently
      }
      
      toast({
        title: "Error",
        description: error.message || 'Failed to sign in. Please try again.',
        variant: "destructive",
      });
    } finally {
      setOauthLoading(null);
    }
  };

  const scrollToForm = () => {
    document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div 
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide relative"
    >
      {/* Parallax Background */}
      <motion.div 
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          y: backgroundY,
          scale: 1.1,
        }}
      />
      {/* Auth Form Section with iOS safe areas */}
      <section
        id="auth-form"
        className="snap-start min-h-screen relative flex items-center justify-center pt-safe-top pb-safe-bottom"
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
                      className="text-xs text-steel hover:text-pure-white transition-colors"
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
                className="text-royal-purple hover:text-accent-purple"
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
