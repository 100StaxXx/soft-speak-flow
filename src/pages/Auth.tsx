import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
});

const motivationalQuotes = [
  {
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    quote: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt"
  },
  {
    quote: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt"
  },
  {
    quote: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius"
  }
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await ensureProfile(session.user.id, session.user.email);
        const path = await getAuthRedirectPath(session.user.id);
        navigate(path);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Defer additional Supabase calls to avoid deadlocks in the callback
        setTimeout(async () => {
          await ensureProfile(session.user.id, session.user.email);
          const path = await getAuthRedirectPath(session.user.id);
          navigate(path);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % motivationalQuotes.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = authSchema.safeParse({ email, password });
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
          email,
          password,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const scrollToForm = () => {
    document.getElementById('auth-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {/* Current Quote Slide Only - Click anywhere to advance */}
      <section
        onClick={scrollToForm}
        className="snap-start h-screen relative flex items-center justify-center cursor-pointer"
        style={{
          background: `linear-gradient(135deg, hsl(270 60% 50% / 0.1), hsl(270 50% 35% / 0.2)), hsl(0 0% 7%)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(270_60%_50%/0.1),transparent_50%)]" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <blockquote className="space-y-8">
            <p 
              key={`quote-${currentSlide}`}
              className="text-4xl md:text-6xl lg:text-7xl font-heading text-pure-white leading-tight animate-fade-in"
            >
              "{motivationalQuotes[currentSlide].quote}"
            </p>
            <footer 
              key={`author-${currentSlide}`}
              className="text-2xl md:text-3xl text-royal-purple font-semibold animate-fade-in-delayed"
            >
              — {motivationalQuotes[currentSlide].author}
            </footer>
          </blockquote>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce text-royal-purple">
          <ChevronDown className="w-12 h-12" />
        </div>
      </section>

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
