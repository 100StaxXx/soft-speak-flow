import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";

const authSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Check if user has selected a mentor
        const { data: profileData } = await supabase
          .from("profiles")
          .select("selected_mentor_id")
          .eq("id", session.user.id)
          .single();

        if (!profileData?.selected_mentor_id) {
          navigate("/onboarding");
        } else {
          navigate("/");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
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

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast({
          title: "Welcome to A Lil Push!",
          description: "Let's find your perfect mentor.",
        });
        navigate("/onboarding");
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

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-graphite border-2 border-royal-gold/20 shadow-glow">
        <CardHeader className="text-center space-y-4">
          <div className="h-1 w-16 bg-royal-gold mx-auto mb-4" />
          <CardTitle className="text-5xl font-black text-pure-white uppercase tracking-tight">
            A Lil Push
          </CardTitle>
          <CardDescription className="text-lg text-steel">
            {isLogin ? "Welcome Back" : "Build Discipline."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-pure-white font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-obsidian border-steel/20 text-pure-white focus:border-royal-gold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-pure-white font-semibold">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-obsidian border-steel/20 text-pure-white focus:border-royal-gold"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-7 text-lg font-black uppercase tracking-wider"
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Begin"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-royal-gold hover:text-pure-white transition-colors font-semibold uppercase tracking-wide"
            >
              {isLogin ? "Create Account" : "Sign In Instead"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
