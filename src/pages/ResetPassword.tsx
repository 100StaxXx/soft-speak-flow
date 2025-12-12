import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { firebaseAuth } from "@/lib/firebase/auth";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
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
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Firebase password reset links contain 'oobCode' in query params
    const oobCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode');
    
    if (!oobCode || mode !== 'resetPassword') {
      // Also check URL hash for compatibility
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashOobCode = hashParams.get('oobCode');
      const hashMode = hashParams.get('mode');
      
      const code = oobCode || hashOobCode;
      const resetMode = mode || hashMode;
      
      if (!code || resetMode !== 'resetPassword') {
        toast({
          variant: "destructive",
          title: "Invalid Link",
          description: "This password reset link is invalid or has expired",
        });
        navigate("/auth");
        return;
      }
    }

    // Verify the reset code is valid
    const verifyCode = async () => {
      try {
        const code = searchParams.get('oobCode') || new URLSearchParams(window.location.hash.substring(1)).get('oobCode');
        if (code) {
          await verifyPasswordResetCode(firebaseAuth, code);
          setValidToken(true);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Invalid Link",
          description: error instanceof Error ? error.message : "This password reset link is invalid or has expired",
        });
        navigate("/auth");
      }
    };

    verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, searchParams]); // toast is stable from useToast hook

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
      // Get the oobCode from URL params or hash
      const oobCode = searchParams.get('oobCode') || new URLSearchParams(window.location.hash.substring(1)).get('oobCode');
      
      if (!oobCode) {
        throw new Error("Reset code not found");
      }

      await confirmPasswordReset(firebaseAuth, oobCode, password);

      toast({
        title: "Password Updated",
        description: "Your password has been successfully reset",
      });
      navigate("/auth");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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
