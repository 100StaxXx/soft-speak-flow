import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeNavigate } from "@/utils/nativeNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { newPasswordSchema } from "@/utils/passwordPolicy";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let disposed = false;
    let settled = false;
    setValidToken(false);
    setShowFallback(false);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    const error = hashParams.get('error') ?? queryParams.get('error');
    const errorDescription = hashParams.get('error_description') ?? queryParams.get('error_description');
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Reset Link Expired",
        description: errorDescription || "This password reset link has expired or was already used. Please request a new one.",
      });
      safeNavigate(navigate, "/auth");
      return;
    }

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    const code = queryParams.get('code');

    // Set up timeout to prevent infinite loading
    const verificationTimeout = setTimeout(() => {
      if (!settled && !disposed) {
        settled = true;
        toast({
          variant: "destructive",
          title: "Verification Timeout",
          description: "Unable to verify the reset link. Please request a new one.",
        });
        safeNavigate(navigate, "/auth");
      }
    }, 10000);

    // Show fallback button after 5 seconds
    const fallbackTimer = setTimeout(() => {
      setShowFallback(true);
    }, 5000);

    const finishVerification = (hasSession: boolean) => {
      if (disposed || settled) return;
      settled = true;
      clearTimeout(verificationTimeout);
      clearTimeout(fallbackTimer);
      if (hasSession) {
        setValidToken(true);
        // Remove credentials after establishing the recovery session.
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        cleanUrl.searchParams.delete('code');
        window.history.replaceState(window.history.state, '', `${cleanUrl.pathname}${cleanUrl.search}`);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Link",
          description: "This password reset link is invalid or has expired. Please request a new one.",
        });
        safeNavigate(navigate, "/auth");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        finishVerification(Boolean(session));
      }
    });

    // URL detection only runs at client initialization. A link opened in an
    // already-running native app must explicitly establish its new session.
    void (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (disposed || settled) return;
      if (accessToken || refreshToken || type) {
        if (!accessToken || !refreshToken || type !== 'recovery') {
          finishVerification(false);
          return;
        }
        if (!sessionError && session?.access_token === accessToken) {
          finishVerification(true);
          return;
        }
        const result = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        finishVerification(!result.error && Boolean(result.data.session));
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        finishVerification(!result.error && Boolean(result.data.session));
      } else {
        // Supabase may already have consumed and removed the recovery hash.
        finishVerification(!sessionError && Boolean(session));
      }
    })().catch(() => finishVerification(false));

    return () => {
      disposed = true;
      subscription.unsubscribe();
      clearTimeout(verificationTimeout);
      clearTimeout(fallbackTimer);
    };
     
  }, [navigate, toast, location.key]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
      });
      return;
    }

    const validation = newPasswordSchema.safeParse(password);
    if (!validation.success) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: validation.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been successfully reset",
        });
        safeNavigate(navigate, "/auth");
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

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Verifying reset link...</p>
          {showFallback && (
            <div className="pt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Taking too long?</p>
              <Button 
                variant="outline" 
                onClick={() => safeNavigate(navigate, "/auth")}
              >
                Request New Link
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Reset Password
          </h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 shadow-lg">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-secondary/50 border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with letters and a number or special character
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-secondary/50 border-border text-foreground"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
