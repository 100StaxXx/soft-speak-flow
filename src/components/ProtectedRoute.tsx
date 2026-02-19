import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { Progress } from "@/components/ui/progress";
import { TrialExpiredPaywall } from "@/components/TrialExpiredPaywall";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
}

export const ProtectedRoute = ({ children, requireMentor: _requireMentor = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading, status } = useAuth();
  const { hasAccess, loading: accessLoading } = useAccessStatus();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const authStatus = status ?? (authLoading ? 'loading' : user ? 'authenticated' : 'unauthenticated');
  const isAuthPending = authLoading || authStatus === 'recovering' || authStatus === 'loading';

  useEffect(() => {
    // Redirect to welcome page if not logged in (for App Store compliance)
    if (!isAuthPending && authStatus === 'unauthenticated') {
      navigate("/welcome", { replace: true });
    }
  }, [authStatus, isAuthPending, navigate]);

  // Animate progress bar while loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isAuthPending || accessLoading) {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 300);
    } else {
      setProgress(100);
    }
    
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [accessLoading, isAuthPending]);

  // Show loading while checking auth
  if (isAuthPending || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-8 space-y-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-foreground">Loading...</p>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </div>
    );
  }

  // Don't render children until auth is confirmed
  if (authStatus === 'unauthenticated' || !user) return null;

  // Show hard paywall if no access (trial expired and not subscribed)
  if (!hasAccess) {
    return <TrialExpiredPaywall />;
  }

  return <>{children}</>;
};
