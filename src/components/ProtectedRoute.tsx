import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { Progress } from "@/components/ui/progress";
import { TrialExpiredPaywall } from "@/components/TrialExpiredPaywall";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
}

export const ProtectedRoute = ({ children, requireMentor = true }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useAccessStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);

  // Don't block onboarding with paywall - users need to complete onboarding first
  const isOnboarding = location.pathname === "/onboarding";

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Animate progress bar while loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // Only block on auth loading, not profile/access loading
    if (authLoading) {
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
  }, [authLoading]);

  // Show loading ONLY while checking auth (not profile/access)
  // Profile can load in the background - don't block navigation
  if (authLoading) {
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
  if (!user) return null;

  // Skip access check during onboarding - users need to complete onboarding first
  // The paywall should only block access to protected features AFTER onboarding is complete
  if (isOnboarding) {
    return <>{children}</>;
  }

  // Only check access if it's loaded - don't block if still loading
  // Profile/access can load in background, pages will handle their own loading states
  if (!accessLoading && !hasAccess) {
    return <TrialExpiredPaywall />;
  }

  // Render children - profile/access will load in background
  return <>{children}</>;
};
