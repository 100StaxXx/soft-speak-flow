import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccessStatus, type AccessGateReason } from "@/hooks/useAccessStatus";
import { Progress } from "@/components/ui/progress";
import { Paywall } from "@/components/Paywall";
import { PRODUCT } from "@/config/product";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
  requireAccess?: boolean;
}

export const PROTECTED_ROUTE_AUTH_STALL_MS = 6_000;

export const ProtectedRoute = ({
  children,
  requireMentor: _requireMentor = true,
  requireAccess = PRODUCT.requiresSubscription,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading, status } = useAuth();
  const { hasAccess, gateReason, loading: accessLoading } = useAccessStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [authGateTimedOut, setAuthGateTimedOut] = useState(false);
  const authGateTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
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
    !hasCachedUser && (
      authStatus === 'loading' ||
      authLoading ||
      authStatus === 'recovering'
    );
  const shouldShowAuthLoading = isAuthPending && !authGateTimedOut;
  const hasResolvedAccessForCurrentRoute = Boolean(
    userId &&
      resolvedAccessDecision?.userId === userId &&
      resolvedAccessDecision.requireAccess === requireAccess,
  );
  const effectiveAccessDecision =
    requireAccess && accessLoading && hasResolvedAccessForCurrentRoute && resolvedAccessDecision
        ? resolvedAccessDecision
        : { hasAccess, gateReason };

  useEffect(() => {
    setAuthGateTimedOut(false);
    setProgress(0);
    if (authGateTimerRef.current !== null) {
      window.clearTimeout(authGateTimerRef.current);
      authGateTimerRef.current = null;
    }
  }, [authStatus, userId]);

  useEffect(() => {
    if (authGateTimerRef.current !== null) {
      window.clearTimeout(authGateTimerRef.current);
      authGateTimerRef.current = null;
    }

    if (!isAuthPending || authGateTimedOut) {
      return undefined;
    }

    authGateTimerRef.current = window.setTimeout(() => {
      authGateTimerRef.current = null;
      setAuthGateTimedOut(true);
      setProgress(100);
      console.warn("ProtectedRoute auth gate timed out; leaving loading state.", {
        authStatus,
        path: location.pathname,
      });
    }, PROTECTED_ROUTE_AUTH_STALL_MS);

    return () => {
      if (authGateTimerRef.current !== null) {
        window.clearTimeout(authGateTimerRef.current);
        authGateTimerRef.current = null;
      }
    };
  }, [
    authStatus,
    authGateTimedOut,
    isAuthPending,
    location.pathname,
  ]);

  useEffect(() => {
    // Redirect to welcome page if not logged in (for App Store compliance)
    if (!shouldShowAuthLoading && (authStatus === 'unauthenticated' || !user)) {
      navigate("/welcome", { replace: true });
    }
  }, [authStatus, navigate, shouldShowAuthLoading, user]);

  // Animate progress bar while loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (shouldShowAuthLoading) {
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
  }, [shouldShowAuthLoading]);

  useEffect(() => {
    if (!userId || !hasCachedUser || shouldShowAuthLoading) return;
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
    requireAccess,
    shouldShowAuthLoading,
    userId,
  ]);

  // Only auth can block route rendering. Access/profile/subscription checks resolve
  // behind the current screen so a slow entitlement path cannot strand the app.
  if (shouldShowAuthLoading) {
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
