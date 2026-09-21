import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";

import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
} from "@/utils/profileOnboarding";
import { PRODUCT } from "@/config/product";

const ONBOARDING_GATE_BYPASS_PATHS = new Set([
  "/welcome",
  "/auth",
  "/auth/reset-password",
  "/onboarding",
  "/terms",
  "/privacy",
  "/account-deletion",
]);

const bypassesOnboardingGate = (pathname: string): boolean =>
  ONBOARDING_GATE_BYPASS_PATHS.has(pathname)
  || pathname.startsWith("/accessibility-preview/");

export const OnboardingExperienceGate = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, status } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();
  const location = useLocation();
  const queryClient = useQueryClient();
  const shouldGate = Boolean(user) && !bypassesOnboardingGate(location.pathname);
  const {
    companion,
    isLoading: companionLoading,
    error: companionError,
    refetch: refetchCompanion,
  } = useCompanion({ enabled: shouldGate });
  const selfHealAttemptedRef = useRef<string | null>(null);

  const profileOnlyGate = useMemo(() => getOnboardingGateState({ profile }), [profile]);
  const canResolveWithoutCompanion =
    profileOnlyGate.isEstablished
    || profileOnlyGate.resumeStep !== null
    || profileOnlyGate.needsProgressionReset;
  const fullGate = useMemo(() => getOnboardingGateState({
    profile,
    hasCompanion: Boolean(companion),
    hasPresetCompanion: companion?.product_mode === "cosmiq" || Boolean(companion?.preset_id),
    companionStage: companion?.current_stage ?? null,
    hasCompanionImages: Boolean(companion?.current_image_url || companion?.initial_image_url),
  }), [companion, profile]);
  const gate = canResolveWithoutCompanion ? profileOnlyGate : fullGate;

  useEffect(() => {
    if (!shouldGate || !user?.id || !profile || !gate.isEstablished) return;

    const patch = buildEstablishedProfileSelfHealPatch({
      profile,
      hasCompanion: Boolean(companion),
      hasPresetCompanion: companion?.product_mode === "cosmiq" || Boolean(companion?.preset_id),
      companionStage: companion?.current_stage ?? null,
      hasCompanionImages: Boolean(companion?.current_image_url || companion?.initial_image_url),
    });
    if (!patch || selfHealAttemptedRef.current === user.id) return;

    selfHealAttemptedRef.current = user.id;
    void supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          selfHealAttemptedRef.current = null;
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      });
  }, [companion, gate.isEstablished, profile, queryClient, shouldGate, user]);

  if (!shouldGate) return <>{children}</>;

  const authPending = status === "loading" || status === "recovering" || authLoading;
  const companionDecisionPending = !canResolveWithoutCompanion && companionLoading;
  if (authPending || profileLoading || companionDecisionPending) {
    return <PageLoader message={`Preparing your ${PRODUCT.name} journey…`} />;
  }

  if (profileError || !profile || (!canResolveWithoutCompanion && companionError)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-safe">
        <section className="w-full max-w-md rounded-[28px] border border-border/70 bg-card/95 p-6 text-card-foreground shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Connection check
          </p>
          <h1 className="mt-3 text-2xl font-semibold">We couldn't load your setup</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Retry before continuing so {PRODUCT.name} doesn&apos;t lose your place in onboarding.
          </p>
          <Button
            type="button"
            className="mt-6 w-full"
            onClick={() => {
              void refetchProfile();
              void refetchCompanion();
            }}
          >
            Retry loading
          </Button>
        </section>
      </main>
    );
  }

  if (gate.needsOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
