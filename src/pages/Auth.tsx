import { useState, useEffect } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
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
    };

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await ensureProfile(session.user.id, session.user.email);
        const path = await getAuthRedirectPath(session.user.id);
        navigate(path);
      }
    };

    initializeAuth();
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only redirect on actual sign-in events, not on token refresh or other events
      if (event === 'SIGNED_IN' && session) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await ensureProfile(session.user.id, session.user.email);
          const path = await getAuthRedirectPath(session.user.id);
          navigate(path);
        } catch (error) {
          console.error('Error in auth state change:', error);
          navigate('/onboarding');
        }
      }
    });

    return () => subscription.unsubscribe();
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });

          if (sessionError) throw sessionError;
          
          console.log('[Google OAuth] Sign-in successful');
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

        console.log('[Apple OAuth] Calling Supabase signInWithIdToken');

        // Sign in to Supabase with Apple identity token and RAW nonce
        const { data: authData, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: result.response.identityToken,
          nonce: rawNonce, // Use raw (unhashed) nonce for Supabase
        });

        console.log('[Apple OAuth] Supabase response:', { 
          hasSession: !!authData?.session, 
          hasUser: !!authData?.user,
          error: error?.message 
        });

        if (error) throw error;
        
        console.log('[Apple OAuth] Sign-in successful');
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
    } catch (error: any) {
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
              </div>
              <Button
                type="submit"
                className="w-full bg-royal-purple hover:bg-accent-purple text-pure-white font-bold h-12 text-lg"
                disabled={loading}
              >
                {loading ? "Loading..." : isLogin ? "Sign In" : "Get Started"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-steel/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-obsidian px-2 text-steel">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn('google')}
                className="bg-obsidian/50 border-royal-purple/30 text-pure-white hover:bg-royal-purple/10 hover:border-royal-purple"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn('apple')}
                className="bg-obsidian/50 border-royal-purple/30 text-pure-white hover:bg-royal-purple/10 hover:border-royal-purple"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => setIsLogin(!isLogin)}
                className="text-royal-purple hover:text-accent-purple"
              >
                {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Auth;
