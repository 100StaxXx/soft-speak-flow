import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { SignInWithApple, SignInWithAppleResponse } from '@capacitor-community/apple-sign-in';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { getAuthRedirectPath, ensureProfile } from "@/utils/authRedirect";
import { logger } from "@/utils/logger";

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
    .regex(/^(?=.*[a-zA-Z])(?=.*[0-9]|.*[!@#$%^&*])/, "Password must contain letters and at least one number or special character")
});


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Refs to track OAuth fallback timeouts (for cleanup)
  const googleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  const appleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to track if initial session check has redirected
  const hasRedirected = useRef(false);
  
  // Ref to prevent re-renders during initialization
  const initializationComplete = useRef(false);

  // Separate effect for OAuth initialization to prevent re-renders
  useEffect(() => {
    if (initializationComplete.current) return;
    
    const initializeAuth = async () => {
      // Initialize SocialLogin plugin for native platforms
      if (Capacitor.isNativePlatform()) {
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
        } catch (error) {
          console.error('[OAuth Init] Failed to initialize SocialLogin:', error);
        }
      }
      initializationComplete.current = true;
    };

    initializeAuth();
  }, []); // No dependencies - run only once

  // Separate effect for session check and auth state listener
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        hasRedirected.current = true; // Mark that we're handling initial redirect
        await ensureProfile(session.user.id, session.user.email);
        const path = await getAuthRedirectPath(session.user.id);
        navigate(path);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle all sign-in events including setSession() which triggers TOKEN_REFRESHED
      if (['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event) && session) {
        // Skip INITIAL_SESSION if checkSession already handled the redirect
        if (event === 'INITIAL_SESSION' && hasRedirected.current) {
          console.log('[Auth onAuthStateChange] Skipping INITIAL_SESSION - already redirected by checkSession');
          return;
        }
        
        const timestamp = Date.now();
        console.log(`[Auth onAuthStateChange] Event: ${event} at ${timestamp}, redirecting...`);
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await ensureProfile(session.user.id, session.user.email);
          const path = await getAuthRedirectPath(session.user.id);
          console.log(`[Auth onAuthStateChange] Navigating to ${path} at ${Date.now()} (${Date.now() - timestamp}ms elapsed)`);
          navigate(path);
        } catch (error) {
          console.error('Error in auth state change:', error);
          navigate('/onboarding');
        }
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
  }, [navigate]);

  // Helper function for Capacitor-compatible redirect URLs
  const getRedirectUrl = () => {
    // For Capacitor iOS/Android, use the app scheme
    if (Capacitor.isNativePlatform()) {
      return 'com.darrylgraham.revolution://';
    }
    // For web, use current origin
    return `${window.location.origin}/`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitize inputs before validation
    const sanitizedEmail = email.trim().toLowerCase();
    const result = authSchema.safeParse({ email: sanitizedEmail, password });
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
      } else {
        const { error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password,
          options: {
            emailRedirectTo: getRedirectUrl(),
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
        
        // For sign-up, show success message
        if (!isLogin) {
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
        redirectTo: `${window.location.origin}/auth/reset-password`,
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
    console.log(`[OAuth Debug] Starting ${provider} sign-in flow`);
    console.log(`[OAuth Debug] Platform: ${Capacitor.isNativePlatform() ? 'Native' : 'Web'}`);
    
    try {
      // Native Google Sign-In for iOS/Android
      if (provider === 'google' && Capacitor.isNativePlatform()) {
        console.log('[Google OAuth] Initiating native Google sign-in');
        
        const result = await SocialLogin.login({
          provider: 'google',
          options: {}
        });

        console.log('[Google OAuth] SocialLogin result:', JSON.stringify(result, null, 2));

        // Check if we got a valid response
        if (result.provider === 'google' && result.result.responseType === 'online') {
          const { idToken } = result.result;
          
          console.log('[Google OAuth] ID token received:', idToken ? `${idToken.substring(0, 20)}...` : 'MISSING');
          
          if (!idToken) {
            throw new Error('No ID token received from Google sign-in');
          }

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
          
          const sessionSetTime = Date.now();
          console.log(`[Google OAuth] Session set successfully at ${sessionSetTime}, onAuthStateChange will handle redirect`);
          // Let onAuthStateChange handle the redirect (it now listens for TOKEN_REFRESHED)
          
          // Fallback: manually redirect if onAuthStateChange doesn't fire (increased to 800ms to avoid race conditions)
          if (newSession?.user) {
            googleFallbackTimeout.current = setTimeout(async () => {
              try {
                // Check if already redirected by onAuthStateChange
                if (window.location.pathname !== '/auth') {
                  console.log(`[Google OAuth Fallback] Already redirected, skipping (${Date.now() - sessionSetTime}ms since session set)`);
                  return;
                }
                console.log(`[Google OAuth Fallback] Executing manual redirect at ${Date.now()} (${Date.now() - sessionSetTime}ms since session set)`);
                await ensureProfile(newSession.user.id, newSession.user.email);
                const path = await getAuthRedirectPath(newSession.user.id);
                navigate(path);
              } catch (error) {
                console.error('[Google OAuth Fallback] Error during redirect:', error);
                // Fallback to onboarding if something goes wrong
                navigate('/onboarding');
              }
            }, 800);
          }
          return;
        } else {
          console.error('[Google OAuth] Unexpected response type:', result);
          throw new Error('Unexpected Google sign-in response');
        }
      }

      // Native Apple Sign-In for iOS
      if (provider === 'apple' && Capacitor.isNativePlatform()) {
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
        
        const sessionSetTime = Date.now();
        console.log(`[Apple OAuth] Session set successfully at ${sessionSetTime}, onAuthStateChange will handle redirect`);
        // Let onAuthStateChange handle the redirect (it now listens for TOKEN_REFRESHED)
        
        // Fallback: manually redirect if onAuthStateChange doesn't fire (increased to 800ms to avoid race conditions)
        if (newSession?.user) {
          appleFallbackTimeout.current = setTimeout(async () => {
            try {
              // Check if already redirected by onAuthStateChange
              if (window.location.pathname !== '/auth') {
                console.log(`[Apple OAuth Fallback] Already redirected, skipping (${Date.now() - sessionSetTime}ms since session set)`);
                return;
              }
              console.log(`[Apple OAuth Fallback] Executing manual redirect at ${Date.now()} (${Date.now() - sessionSetTime}ms since session set)`);
              await ensureProfile(newSession.user.id, newSession.user.email);
              const path = await getAuthRedirectPath(newSession.user.id);
              navigate(path);
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
      console.log(`[${provider} OAuth] Using web OAuth flow`);
      console.log(`[${provider} OAuth] Redirect URL:`, getRedirectUrl());
      
      const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectUrl(),
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
                <Button
                  type="submit"
                  className="w-full bg-royal-purple hover:bg-accent-purple text-pure-white font-bold h-12 text-lg"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
                </Button>
              </form>
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
