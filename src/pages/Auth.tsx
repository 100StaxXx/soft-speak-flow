import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
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
  // Detect OAuth callback on mount to show loading state immediately
  const [isProcessingCallback, setIsProcessingCallback] = useState(() => {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    return url.searchParams.has("code") || url.hash.includes("access_token");
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { session: authSession } = useAuth();

  const handlePostAuthNavigation = useCallback(async (session: Session | null, source: string) => {
    if (!session) return;

    try {
      hasRedirected.current = true;
      await ensureProfile(session.user.id, session.user.email);
      const path = await getAuthRedirectPath(session.user.id);
      console.log(`[Auth ${source}] Navigating to ${path}`);
      navigate(path);
    } catch (error) {
      console.error(`[Auth ${source}] Navigation error:`, error);
      navigate('/onboarding');
    }
  }, [navigate]);
  
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

          console.log('[OAuth Init] Initializing with:', {
            hasWebClientId: !!webClientId,
            hasIOSClientId: !!iOSClientId
          });

          if (!webClientId || !iOSClientId) {
            console.error('[OAuth Init] Missing Google Client IDs in environment variables');
            throw new Error('Google Client IDs not configured');
          }

          await SocialLogin.initialize({
            google: {
              webClientId,
              iOSClientId,
              mode: 'online'
            }
          });

          console.log('[OAuth Init] SocialLogin initialized successfully');
          setGoogleNativeReady(true);
        } catch (error) {
          console.error('[OAuth Init] Failed to initialize SocialLogin:', error);
          setGoogleNativeReady(false);
        }
      } else {
        console.warn('[OAuth Init] SocialLogin plugin unavailable - using web OAuth fallback');
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
      console.warn('[OAuth Init] SignInWithApple plugin unavailable - falling back to web OAuth for Apple');
    }
    setAppleNativeReady(pluginAvailable);
  }, []);

  // Handle OAuth callback parameters that return the user to /auth with a valid code/token
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleOAuthCallback = async () => {
      if (typeof window === "undefined" || hasRedirected.current) return;

      const url = new URL(window.location.href);
      const hasAccessToken = url.hash.includes("access_token");
      const code = url.searchParams.get("code");

      // Only run when coming back from an OAuth provider
      if (!code && !hasAccessToken) return;

      // Show loading state during callback processing
      setIsProcessingCallback(true);
      console.log("[OAuth Callback] Processing callback, code:", !!code, "hasAccessToken:", hasAccessToken);

      // Safety timeout: if callback takes more than 15 seconds, show error and reset
      timeoutId = setTimeout(() => {
        if (!hasRedirected.current) {
          console.error("[OAuth Callback] Timeout - callback took too long");
          setIsProcessingCallback(false);
          toast({
            title: "Sign in taking too long",
            description: "Please try again. If the problem persists, check your internet connection.",
            variant: "destructive",
          });
          // Clean up URL parameters
          url.searchParams.delete("code");
          window.location.hash = "";
          window.history.replaceState(window.history.state, "", url.pathname);
        }
      }, 15000);

      try {
        if (code) {
          // First check if Supabase has already auto-exchanged the code
          // (detectSessionInUrl: true is the default behavior)
          const { data: { session: existingSession } } = await supabase.auth.getSession();

          if (existingSession) {
            console.log("[OAuth Callback] Session already exists from auto-exchange");
            await handlePostAuthNavigation(existingSession, "oauthAutoExchange");
          } else {
            // Supabase didn't auto-exchange, do it manually
            console.log("[OAuth Callback] Manually exchanging code for session");
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            await handlePostAuthNavigation(data.session, "oauthCodeExchange");
          }
        } else {
          // Hash-based tokens (implicit flow)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await handlePostAuthNavigation(session, "oauthHashSession");
          }
        }
      } catch (error) {
        console.error("[OAuth Callback] Failed to complete OAuth login:", error);
        // Only show error if we haven't already redirected (prevents flash of error on success)
        if (!hasRedirected.current) {
          toast({
            title: "Error",
            description: "Something went wrong signing you in. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setIsProcessingCallback(false);
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

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [handlePostAuthNavigation, toast]);

  // Separate effect for session check and auth state listener
  useEffect(() => {
    const checkSession = async () => {
      // Skip session check if we're processing an OAuth callback
      // The callback handler will manage navigation
      const url = new URL(window.location.href);
      const hasOAuthParams = url.searchParams.has("code") || url.hash.includes("access_token");
      if (hasOAuthParams) {
        console.log("[Auth checkSession] Skipping - OAuth callback will handle session");
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
        // Skip if already redirected by direct OAuth call, checkSession, or previous event
        if (hasRedirected.current) {
          console.log(`[Auth onAuthStateChange] Skipping ${event} - already redirected`);
          return;
        }
        
        const timestamp = Date.now();
        console.log(`[Auth onAuthStateChange] Event: ${event} at ${timestamp}, redirecting...`);
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

  // Extra safety net: if the auth context already has a session, redirect immediately
  useEffect(() => {
    if (!authSession || hasRedirected.current) return;
    handlePostAuthNavigation(authSession, 'authContext');
  }, [authSession, handlePostAuthNavigation]);

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
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {/* Auth Form Section */}
      <section
        id="auth-form"
        className="snap-start min-h-screen relative flex items-center justify-center py-20"
        style={{
          background: `linear-gradient(180deg, hsl(0 0% 7%), hsl(270 50% 35% / 0.05))`,
        }}
      >
        <div className="w-full max-w-md px-6 space-y-8">
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
                  disabled={loading || isProcessingCallback}
                >
                  {loading || isProcessingCallback ? "Sending..." : "Send Reset Link"}
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
                  disabled={loading || isProcessingCallback}
                >
                  {loading || isProcessingCallback ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
                </Button>
              </form>
            )}

            {!isForgotPassword && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-steel">
                  <span className="h-px flex-1 bg-obsidian/40" />
                  <span>Or continue with</span>
                  <span className="h-px flex-1 bg-obsidian/40" />
                </div>
                <div className="grid gap-3">
                  {/* Apple Sign In - Full width, prominent */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full h-14 justify-center gap-3 normal-case tracking-normal bg-gradient-to-r from-obsidian to-black text-pure-white border border-white/10 shadow-lg shadow-royal-purple/10 hover:shadow-royal-purple/20 hover:scale-[1.01] transition-transform"
                    onClick={() => handleOAuthSignIn('apple')}
                    disabled={loading || oauthLoading !== null || isProcessingCallback}
                  >
                    {oauthLoading === 'apple' || isProcessingCallback ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    )}
                    <span className="text-base font-semibold">
                      {oauthLoading === 'apple' || isProcessingCallback ? 'Signing in...' : 'Continue with Apple'}
                    </span>
                  </Button>

                  {/* Google Sign In - Full width */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full h-14 justify-center gap-3 normal-case tracking-normal bg-gradient-to-r from-pure-white to-slate-100 text-obsidian border border-steel/30 shadow-md shadow-obsidian/10 hover:shadow-royal-purple/20 hover:scale-[1.01] transition-transform"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading || oauthLoading !== null || isProcessingCallback}
                  >
                    {oauthLoading === 'google' || isProcessingCallback ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-pure-white border-t-transparent" />
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    <span className="text-base font-semibold">
                      {oauthLoading === 'google' || isProcessingCallback ? 'Signing in...' : 'Continue with Google'}
                    </span>
                  </Button>
                </div>
              </div>
            )}

            <div className="text-center">
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
