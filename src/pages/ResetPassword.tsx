import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { safeNavigate } from "@/utils/nativeNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for error parameters first (Supabase sends these for expired/invalid tokens)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
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
    const type = hashParams.get('type');
    
    if (!accessToken || type !== 'recovery') {
      toast({
        variant: "destructive",
        title: "Invalid Link",
        description: "This password reset link is invalid or has expired. Please request a new one.",
      });
      safeNavigate(navigate, "/auth");
      return;
    }

    // Set up timeout to prevent infinite loading
    const verificationTimeout = setTimeout(() => {
      if (!validToken) {
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

    // Wait for Supabase to process the recovery token via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(verificationTimeout);
        clearTimeout(fallbackTimer);
        if (session) {
          setValidToken(true);
        } else {
          toast({
            variant: "destructive",
            title: "Session Error",
            description: "Unable to establish password reset session. Please request a new link.",
          });
          safeNavigate(navigate, "/auth");
        }
      }
    });

    // Also check if session already exists (in case event already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        clearTimeout(verificationTimeout);
        clearTimeout(fallbackTimer);
        setValidToken(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(verificationTimeout);
      clearTimeout(fallbackTimer);
    };
     
  }, [navigate]); // toast is stable from useToast hook

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

    const validation = passwordSchema.safeParse(password);
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
                Must be at least 8 characters with uppercase, lowercase, and numbers
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
