import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { signUp, signIn, resetPassword, signInWithGoogle, signInWithGoogleCredential, signInWithAppleCredential } from "@/lib/firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { convertFirebaseUser } from "@/lib/firebase/auth";
import { onAuthStateChanged, getRedirectResult } from "firebase/auth";

// Dynamic imports for Capacitor plugins to improve initial load time
let SignInWithApple: typeof import('@capacitor-community/apple-sign-in').SignInWithApple;
let SocialLogin: typeof import('@capgo/capacitor-social-login').SocialLogin;
type SignInWithAppleResponse = import('@capacitor-community/apple-sign-in').SignInWithAppleResponse;

const loadCapacitorPlugins = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const [applePlugin, socialPlugin] = await Promise.all([
        import('@capacitor-community/apple-sign-in'),
        import('@capgo/capacitor-social-login')
      ]);
      SignInWithApple = applePlugin.SignInWithApple;
      SocialLogin = socialPlugin.SocialLogin;
    } catch (error) {
      console.warn('[Auth] Failed to load Capacitor plugins:', error);
    }
  }
};
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
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { session: authSession, loading: authLoading } = useAuth();

  // Hide splash screen immediately when Auth page loads (don't wait for auth check)
  useEffect(() => {
    import('@/utils/capacitor').then(({ hideSplashScreen }) => {
      hideSplashScreen().catch(() => {
        // Ignore errors - splash screen might not be available on web
      });
    });
  }, []);

  // Add global error handler for unhandled promise rejections (prevents iOS crashes)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Auth] Unhandled promise rejection:', event.reason);
      // Prevent the default browser behavior (which can cause crashes on iOS)
      event.preventDefault();
      // Show user-friendly error
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [toast]);

  const handlePostAuthNavigation = useCallback(async (user: { uid: string; email: string | null } | null, source: string) => {
    if (!user) return;

    // Prevent multiple simultaneous navigation attempts
    if (hasRedirected.current) {
      console.log(`[Auth ${source}] Already redirected, skipping duplicate navigation`);
      return;
    }

    try {
      hasRedirected.current = true;
      console.log(`[Auth ${source}] Ensuring profile exists for user ${user.uid}`);
      
      // Create profile and get it back to avoid duplicate reads
      // Wrap in Promise.race with timeout to prevent hanging on iOS
      const profilePromise = ensureProfile(user.uid, user.email);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile creation timeout')), 10000)
      );
      
      const profile = await Promise.race([profilePromise, timeoutPromise]).catch((error) => {
        console.error(`[Auth ${source}] Profile creation error:`, error);
        // Return null to continue with navigation even if profile creation fails
        return null;
      }) as any;
      
      console.log(`[Auth ${source}] Profile ensured for user ${user.uid}`);
      
      // Pass profile to avoid duplicate getProfile call
      // If profile creation failed, getAuthRedirectPath will fetch it
      const path = await Promise.race([
        getAuthRedirectPath(user.uid, profile || undefined),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redirect path timeout')), 5000)
        )
      ]).catch((error) => {
        console.error(`[Auth ${source}] Redirect path error:`, error);
        // Default to onboarding if we can't determine path
        return '/onboarding';
      }) as string;
      
      console.log(`[Auth ${source}] Navigating to ${path}`);
      
      // Use setTimeout to ensure navigation happens after current execution context
      // This helps prevent crashes on iOS
      setTimeout(() => {
        if (!isMounted.current) {
          console.log(`[Auth ${source}] Component unmounted, skipping navigation`);
          return;
        }
        try {
          navigate(path);
        } catch (navError) {
          console.error(`[Auth ${source}] Navigation error:`, navError);
          // Fallback navigation only if component is still mounted
          if (isMounted.current && typeof window !== 'undefined') {
            window.location.href = path;
          }
        }
      }, 0);
    } catch (error) {
      console.error(`[Auth ${source}] Navigation error:`, error);
      // If profile creation fails, still navigate to onboarding
      // The profile will be created by useProfile hook
      setTimeout(() => {
        if (!isMounted.current) {
          console.log(`[Auth ${source}] Component unmounted, skipping fallback navigation`);
          return;
        }
        try {
          navigate('/onboarding');
        } catch (navError) {
          console.error(`[Auth ${source}] Fallback navigation error:`, navError);
          // Fallback navigation only if component is still mounted
          if (isMounted.current && typeof window !== 'undefined') {
            window.location.href = '/onboarding';
          }
        }
      }, 0);
    }
  }, [navigate]);
  
  // Refs to track OAuth fallback timeouts (for cleanup)
  const googleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  const appleFallbackTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to track if initial session check has redirected
  const hasRedirected = useRef(false);
  
  // Ref to prevent re-renders during initialization
  const initializationComplete = useRef(false);
  
  // Ref to track if component is mounted (prevent navigation after unmount)
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
  // Load plugins dynamically to improve initial page load
  useEffect(() => {
    if (initializationComplete.current) return;

    const initializeAuth = async () => {
      // Load Capacitor plugins only if on native platform
      if (Capacitor.isNativePlatform()) {
        await loadCapacitorPlugins();
      }

      // Initialize SocialLogin plugin for native platforms
      if (Capacitor.isNativePlatform() && SocialLogin && Capacitor.isPluginAvailable('SocialLogin')) {
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

    // Defer initialization slightly to allow page to render first
    setTimeout(() => {
      initializeAuth();
    }, 0);
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

  // Handle OAuth redirect result (for localhost redirect flow)
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (result && result.user && !hasRedirected.current) {
          console.log('[Auth] OAuth redirect result detected, handling...');
          const authUser = convertFirebaseUser(result.user);
          if (authUser) {
            await handlePostAuthNavigation(authUser, 'oauthRedirect');
          }
        }
      } catch (error) {
        console.error('[Auth] Error handling redirect result:', error);
      }
    };
    
    handleRedirectResult();
  }, [handlePostAuthNavigation]);

  // Firebase auth state listener
  useEffect(() => {
    // Check current session
    const currentUser = firebaseAuth.currentUser;
    if (currentUser && !hasRedirected.current) {
      const authUser = convertFirebaseUser(currentUser);
      if (authUser) {
        handlePostAuthNavigation(authUser, 'checkSession');
      }
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user && !hasRedirected.current) {
        const timestamp = Date.now();
        console.log(`[Auth onAuthStateChanged] User signed in at ${timestamp}, redirecting...`);
        const authUser = convertFirebaseUser(user);
        if (authUser) {
          await new Promise(resolve => setTimeout(resolve, 100));
          await handlePostAuthNavigation(authUser, 'onAuthStateChanged');
        }
      }
    });

    return () => {
      unsubscribe();
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
    if (!authSession?.user || hasRedirected.current) return;
    handlePostAuthNavigation({ uid: authSession.user.uid || authSession.user.id, email: authSession.user.email || '' }, 'authContext');
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
        const userCredential = await signIn(sanitizedEmail, password);
        const authUser = convertFirebaseUser(userCredential.user);
        await handlePostAuthNavigation(authUser, 'passwordSignIn');
      } else {
        try {
          const userCredential = await signUp(sanitizedEmail, password, {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          });
          const authUser = convertFirebaseUser(userCredential.user);
          await handlePostAuthNavigation(authUser, 'signUpImmediate');
        } catch (error: any) {
          // Firebase error handling
          if (error.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw error;
        }
      }
    } catch (error: any) {
      console.error('[Auth] Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.code) {
        // Handle Firebase error codes
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered. Please sign in instead.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please choose a stronger password.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection and try again.';
            break;
          default:
            errorMessage = error.message || 'Failed to create account. Please try again.';
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
      await resetPassword(sanitizedEmail);
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link",
      });
      setIsForgotPassword(false);
      setEmail("");
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
      if (provider === 'google' && providerSupportsNative && googleNativeReady && SocialLogin) {
        console.log('[Google OAuth] Initiating native Google sign-in with Firebase');
        
        const result = await SocialLogin.login({
          provider: 'google',
          options: {}
        });

        console.log('[Google OAuth] SocialLogin result:', JSON.stringify(result, null, 2));

        // The plugin sometimes returns the payload under `result`, sometimes directly at the root
        const nativeResponse = (result as unknown as { result?: Record<string, unknown> })?.result ?? result;
        const idToken = (nativeResponse as { idToken?: string })?.idToken;
        const accessToken = (nativeResponse as { accessToken?: string })?.accessToken;

        // Check if we got a valid response
        if (idToken) {
          console.log('[Google OAuth] ID token received:', `${idToken.substring(0, 20)}...`);
          if (accessToken) {
            console.log('[Google OAuth] Access token also received');
          }

          // Sign in with Firebase using the Google credential
          const userCredential = await signInWithGoogleCredential(idToken, accessToken);
          const authUser = convertFirebaseUser(userCredential.user);
          
          if (!authUser) {
            throw new Error('Failed to convert Firebase user');
          }
          
          console.log('[Google OAuth] Firebase sign-in successful');
          // Wrap in try-catch to prevent crashes on iOS
          try {
            await handlePostAuthNavigation(authUser, 'googleNative');
          } catch (navError) {
            console.error('[Google OAuth] Navigation error:', navError);
            // Still try to navigate even if there's an error
            setTimeout(() => navigate('/onboarding'), 0);
          }
          return;
        } else {
          console.error('[Google OAuth] Missing idToken in native response:', result);
          throw new Error('Google sign-in did not return an ID token');
        }
      }

      // Native Apple Sign-In for iOS
      if (provider === 'apple' && providerSupportsNative && appleNativeReady && SignInWithApple) {
        console.log('[Apple OAuth] Initiating native Apple sign-in with Firebase');
        
        // Generate secure random nonce for Firebase
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

        // Sign in with Firebase using the Apple credential
        const userCredential = await signInWithAppleCredential(result.response.identityToken, rawNonce);
        const authUser = convertFirebaseUser(userCredential.user);
        
        if (!authUser) {
          throw new Error('Failed to convert Firebase user');
        }
        
        console.log('[Apple OAuth] Firebase sign-in successful');
        // Wrap in try-catch to prevent crashes on iOS
        try {
          await handlePostAuthNavigation(authUser, 'appleNative');
        } catch (navError) {
          console.error('[Apple OAuth] Navigation error:', navError);
          // Still try to navigate even if there's an error
          setTimeout(() => navigate('/onboarding'), 0);
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

      // Web OAuth flow using Firebase
      console.log(`[${provider} OAuth] Using web OAuth flow with Firebase`);
      
      if (provider === 'google') {
        try {
          const userCredential = await signInWithGoogle();
          // signInWithGoogle returns null for localhost redirect flow
          // The redirect result is handled by getRedirectResult in useEffect above
          if (!userCredential) {
            console.log('[Google OAuth] Redirect flow initiated, waiting for redirect result...');
            // Don't reset loading state here - the redirect will happen
            // The loading state will be reset when the page reloads after redirect
            return;
          }
          const authUser = convertFirebaseUser(userCredential.user);
          await handlePostAuthNavigation(authUser, 'googleWeb');
        } catch (error: any) {
          console.error('[Google OAuth] Error in signInWithGoogle:', error);
          // Re-throw to be caught by outer catch block
          throw error;
        }
      } else if (provider === 'apple') {
        // Apple Sign-In on web requires redirect flow or popup
        // For now, we'll use a redirect approach or show a message
        // Note: Apple Sign-In on web is more complex and may require additional setup
        toast({
          title: "Apple Sign-In",
          description: "Please use Apple Sign-In on iOS devices, or use email/password authentication.",
          variant: "destructive",
        });
        setOauthLoading(null);
        return;
      }
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
                    disabled={loading || oauthLoading !== null}
                  >
                    {oauthLoading === 'apple' ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-obsidian border-t-transparent" />
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    )}
                    <span className="text-base font-semibold">
                      {oauthLoading === 'apple' ? 'Signing in...' : 'Continue with Apple'}
                    </span>
                  </Button>

                  {/* Google Sign In - Full width */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full h-14 justify-center gap-3 normal-case tracking-normal bg-gradient-to-r from-pure-white to-slate-100 text-obsidian border border-steel/30 shadow-md shadow-obsidian/10 hover:shadow-royal-purple/20 hover:scale-[1.01] transition-transform"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading || oauthLoading !== null}
                  >
                    {oauthLoading === 'google' ? (
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
                      {oauthLoading === 'google' ? 'Signing in...' : 'Continue with Google'}
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
