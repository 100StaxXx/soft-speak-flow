import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAccessStatus, type AccessGateReason } from "@/hooks/useAccessStatus";
import { Progress } from "@/components/ui/progress";
import { Paywall } from "@/components/Paywall";
import { AccessCheckError } from "@/components/AccessCheckError";
import { Button } from "@/components/ui/button";
import { restartAuthRecovery } from "@/utils/authRecovery";
import { returnToSignIn } from "@/utils/authSignInRecovery";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireMentor?: boolean;
  requireAccess?: boolean;
}

// The SDK may retry a 15-second request once during its 30-second renewal
// window. A six-second gate incorrectly called that normal recovery a failure.
export const PROTECTED_ROUTE_AUTH_STALL_MS = 35_000;

export const ProtectedRoute = ({
  children,
  requireMentor: _requireMentor = true,
  requireAccess = true,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading, status, recoveryIssue } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { hasAccess, gateReason, loading: accessLoading, error: accessError, retry } = useAccessStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [authGateTimedOut, setAuthGateTimedOut] = useState(false);
  const authGateTimerRef = useRef<number | null>(null);
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
  const authNeedsRecovery = isAuthPending && authStatus === 'recovering';
  const shouldShowAuthLoading = isAuthPending && !authGateTimedOut && !authNeedsRecovery;
  const hasResolvedAccessForCurrentRoute = Boolean(
    userId &&
      resolvedAccessDecision?.userId === userId &&
      resolvedAccessDecision.requireAccess === requireAccess,
  );
  const effectiveAccessDecision =
    requireAccess && (accessLoading || accessError) && hasResolvedAccessForCurrentRoute && resolvedAccessDecision
        ? resolvedAccessDecision
        : { hasAccess, gateReason };
  const shouldShowAccessLoading = Boolean(
    requireAccess && accessLoading && !hasResolvedAccessForCurrentRoute,
  );
  const shouldShowGateLoading = shouldShowAuthLoading || shouldShowAccessLoading;
  // A newly-created account is allowed to resume onboarding before the
  // entitlement check. This is intentionally narrow: only an explicit
  // incomplete flag, or the empty profile created during Apple sign-up,
  // qualifies. Established accounts still go through the paywall normally.
  const canResumeOnboarding = Boolean(
    user &&
      !profileLoading &&
      profile &&
      profile.onboarding_completed !== true &&
      (
        profile.onboarding_completed === false ||
        (
          !profile.selected_mentor_id &&
          !profile.onboarding_step &&
          !profile.onboarding_data
        )
      ),
  );

  useEffect(() => {
    if (!canResumeOnboarding || location.pathname === "/onboarding") return;
    navigate("/onboarding", { replace: true });
  }, [canResumeOnboarding, location.pathname, navigate]);

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

    if (!isAuthPending || authGateTimedOut || authNeedsRecovery) {
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
    authNeedsRecovery,
    isAuthPending,
    location.pathname,
  ]);

  useEffect(() => {
    // Redirect to welcome page if not logged in (for App Store compliance)
    if (authStatus === 'unauthenticated') {
      navigate("/welcome", { replace: true });
    }
  }, [authStatus, navigate, shouldShowAuthLoading, user]);

  // Animate progress bar while loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (shouldShowGateLoading) {
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
  }, [shouldShowGateLoading]);

  useEffect(() => {
    if (!userId || !hasCachedUser || shouldShowAuthLoading) return;
    if (requireAccess && (accessLoading || accessError)) return;

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
    accessError,
    gateReason,
    hasAccess,
    hasCachedUser,
    requireAccess,
    shouldShowAuthLoading,
    userId,
  ]);

  // Never render protected content before the first entitlement decision for
  // this user. A resolved same-user decision may remain visible during a
  // background refresh, but it is never reused for a different account.
  if (isAuthPending && (authGateTimedOut || authNeedsRecovery)) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div role="alert" className="max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">{recoveryIssue === "secure_storage"
          ? "Your saved sign-in couldn’t be opened"
          : "We couldn’t restore your sign-in"}</h1>
        <p className="text-muted-foreground">{recoveryIssue === "secure_storage"
          ? "Keep your phone unlocked and retry. Your saved sign-in and account data have not been cleared."
          : "Your saved sign-in check didn’t finish. Retry, or return to sign-in and use the same Apple account. Your account and progress won’t be deleted."}</p>
        <Button onClick={restartAuthRecovery}>Retry sign-in check</Button>
        <Button variant="outline" onClick={returnToSignIn}>Back to sign in</Button>
      </div>
    </div>;
  }

  if (shouldShowGateLoading) {
    if (canResumeOnboarding) return null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-md px-8 space-y-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-foreground">
              {shouldShowAuthLoading ? "Loading..." : "Checking access..."}
            </p>
          </div>
          <Progress value={progress} className="w-full" />
          {shouldShowAuthLoading && <Button variant="ghost" className="w-full" onClick={returnToSignIn}>Back to sign in</Button>}
        </div>
      </div>
    );
  }

  // Don't render children until auth is confirmed
  if (authStatus === 'unauthenticated' || !user) return null;

  // Do not let a transient subscription/backend outage strand an account that
  // has not reached the paywall yet. The onboarding page owns its own data
  // recovery UI and will resume at the saved step.
  if (canResumeOnboarding) return null;

  if (requireAccess && accessError && !(hasResolvedAccessForCurrentRoute && resolvedAccessDecision?.hasAccess)) {
    return <AccessCheckError retry={retry} />;
  }

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
