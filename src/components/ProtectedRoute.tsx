import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus, type AccessGateReason } from "@/hooks/useAccessStatus";
import { Progress } from "@/components/ui/progress";
import { Paywall } from "@/components/Paywall";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
  requireAccess?: boolean;
}

export const ProtectedRoute = ({
  children,
  requireMentor: _requireMentor = true,
  requireAccess = true,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading, status } = useAuth();
  const { hasAccess, gateReason, loading: accessLoading } = useAccessStatus();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [resolvedAccessDecision, setResolvedAccessDecision] = useState<{
    userId: string;
    requireAccess: boolean;
    hasAccess: boolean;
    gateReason: AccessGateReason;
  } | null>(null);
  const authStatus = status ?? (authLoading ? 'loading' : user ? 'authenticated' : 'unauthenticated');
  const hasCachedUser = Boolean(user);
  const userId = user?.id ?? null;
  const isAuthPending =
    authStatus === 'loading' ||
    (!hasCachedUser && (authLoading || authStatus === 'recovering'));
  const hasResolvedAccessForCurrentRoute = Boolean(
    userId &&
      resolvedAccessDecision?.userId === userId &&
      resolvedAccessDecision.requireAccess === requireAccess,
  );
  const isAccessPending = requireAccess && accessLoading && !hasResolvedAccessForCurrentRoute;
  const effectiveAccessDecision =
    requireAccess && accessLoading && hasResolvedAccessForCurrentRoute && resolvedAccessDecision
      ? resolvedAccessDecision
      : { hasAccess, gateReason };

  useEffect(() => {
    // Redirect to welcome page if not logged in (for App Store compliance)
    if (!isAuthPending && authStatus === 'unauthenticated') {
      navigate("/welcome", { replace: true });
    }
  }, [authStatus, isAuthPending, navigate]);

  // Animate progress bar while loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isAuthPending || isAccessPending) {
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
  }, [isAccessPending, isAuthPending]);

  useEffect(() => {
    setProgress(0);
  }, [requireAccess, userId]);

  useEffect(() => {
    if (!userId || !hasCachedUser || isAuthPending) return;
    if (requireAccess && accessLoading) return;

    if (requireAccess) {
      setResolvedAccessDecision((previous) => {
        if (
          previous?.userId === userId &&
          previous.requireAccess === requireAccess &&
          previous.hasAccess === hasAccess &&
          previous.gateReason === gateReason
        ) {
          return previous;
        }
        return { userId, requireAccess, hasAccess, gateReason };
      });
    }
  }, [
    accessLoading,
    gateReason,
    hasAccess,
    hasCachedUser,
    isAuthPending,
    requireAccess,
    userId,
  ]);

  // Show loading while checking auth
  if (isAuthPending || isAccessPending) {
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

  // Show hard paywall if no access.
  if (requireAccess && !effectiveAccessDecision.hasAccess) {
    return (
      <Paywall
        variant={effectiveAccessDecision.gateReason === "trial_expired" ? "trial_expired" : "pre_trial_signup"}
      />
    );
  }

  return <>{children}</>;
};
