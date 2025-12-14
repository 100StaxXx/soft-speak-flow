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
  
  // Ref to track if signup is in progress - used for onAuthStateChanged detection
  const signupInProgressRef = useRef(false);

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
      
      // For native iOS, use direct location change - more reliable than React Router
      // React Router navigate() can fail silently on iOS when component unmounts
      if (Capacitor.isNativePlatform()) {
        console.log(`[Auth ${source}] Using window.location.href for native platform`);
        window.location.href = path;
        
        // Fallback: if still on auth page after 2 seconds, force reload
        // The reload will trigger onAuthStateChanged which will redirect properly
        setTimeout(() => {
          if (window.location.pathname.includes('/auth')) {
            console.log(`[Auth ${source}] Still on auth page, forcing reload`);
            window.location.reload();
          }
        }, 2000);
      } else {
        // Use React Router for web/PWA
        navigate(path);
      }
    } catch (error) {
      console.error(`[Auth ${source}] Navigation error:`, error);
      // If profile creation fails, still navigate to onboarding
      // The profile will be created by useProfile hook
      if (Capacitor.isNativePlatform()) {
        window.location.href = '/onboarding';
      } else {
        navigate('/onboarding');
      }
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
        
        // If signup is in progress on native, redirect to onboarding immediately
        if (signupInProgressRef.current && Capacitor.isNativePlatform()) {
          console.log('[Auth onAuthStateChanged] Signup detected - immediate redirect to onboarding');
          signupInProgressRef.current = false;
          hasRedirected.current = true;
          window.location.href = '/onboarding';
          return;
        }
        
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
    
    // If signup is in progress on native, redirect to onboarding immediately
    if (signupInProgressRef.current && Capacitor.isNativePlatform()) {
      console.log('[Auth] Signup detected via authSession - redirecting to onboarding');
      signupInProgressRef.current = false;
      hasRedirected.current = true;
      window.location.href = '/onboarding';
      return;
    }
    
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
        // Don't await navigation - let it happen async to prevent iOS freeze
        // The onAuthStateChanged listener will also handle navigation as a backup
        handlePostAuthNavigation(authUser, 'passwordSignIn').catch((err) => {
          console.error('[Auth] Post-login navigation error:', err);
        });
      } else {
        // SIGNUP FLOW - Don't await signUp to prevent blocking on iOS
        // The onAuthStateChanged listener will detect when user is created and redirect
        signupInProgressRef.current = true;
        
        // Start signup WITHOUT awaiting - let onAuthStateChanged handle navigation
        signUp(sanitizedEmail, password, {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }).then((userCredential) => {
          console.log('[Auth signUp] Signup completed successfully');
          // For web: handle navigation if not already redirected
          if (!Capacitor.isNativePlatform() && !hasRedirected.current) {
            const authUser = convertFirebaseUser(userCredential.user);
            handlePostAuthNavigation(authUser, 'signUpImmediate').catch((err) => {
              console.error('[Auth] Post-signup navigation error:', err);
            });
          }
        }).catch((error: any) => {
          console.error('[Auth signUp] Error:', error);
          signupInProgressRef.current = false;
          setLoading(false);
          
          let errorMessage = 'Failed to create account. Please try again.';
          if (error?.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please sign in instead.';
          } else if (error?.message) {
            errorMessage = error.message;
          }
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        });
        
        // For native: set a fallback timeout to force redirect if onAuthStateChanged doesn't fire
        if (Capacitor.isNativePlatform()) {
          setTimeout(() => {
            if (signupInProgressRef.current && !hasRedirected.current) {
              console.log('[Auth signUp] Fallback timeout - forcing redirect to onboarding');
              signupInProgressRef.current = false;
              hasRedirected.current = true;
              window.location.href = '/onboarding';
            }
          }, 8000);
        }
        
        // Exit early - don't wait for the promise
        // Navigation will be handled by onAuthStateChanged or the fallback timeout
        return;
      }
    } catch (error: any) {
      console.error('[Auth] Auth error:', error);
      let errorMessage = isLogin ? 'Failed to sign in. Please try again.' : 'Failed to create account. Please try again.';
      
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
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            errorMessage = 'Invalid email or password.';
            break;
          default:
            errorMessage = error.message || (isLogin ? 'Failed to sign in.' : 'Failed to create account.');
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
