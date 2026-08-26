import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  GracewardOnboarding,
  type GracewardOnboardingResumeState,
} from "@/components/onboarding/StoryOnboarding";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { getOnboardingGateState } from "@/utils/profileOnboarding";
import { PRODUCT } from "@/config/product";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export default function Onboarding() {
  const { user, status } = useAuth();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile();
  const {
    companion,
    isLoading: companionLoading,
    error: companionError,
    refetch: refetchCompanion,
  } = useCompanion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionOnly = searchParams.get("companion") === "1";

  const onboardingData = useMemo(
    () => asRecord(profile?.onboarding_data),
    [profile?.onboarding_data],
  );

  const onboardingGate = useMemo(() => getOnboardingGateState({
    profile,
    hasCompanion: Boolean(companion),
    hasPresetCompanion: companion?.product_mode === "cosmiq" || Boolean(companion?.preset_id),
    companionStage: companion?.current_stage ?? null,
    hasCompanionImages: Boolean(companion?.current_image_url || companion?.initial_image_url),
  }), [companion, profile]);

  const resumeState = useMemo<GracewardOnboardingResumeState | null>(() => {
    if (companionOnly || !onboardingGate.resumeStep) return null;

    const storedName = typeof onboardingData.userName === "string" ? onboardingData.userName : "";
    const companionLabel = companion?.companion_name
      || companion?.cached_creature_name
      || companion?.spirit_animal
      || null;

    return {
      stage: onboardingGate.resumeStep,
      userName: storedName,
      companionLabel,
      onboardingData,
      faction: profile?.faction ?? null,
    };
  }, [companion, companionOnly, onboardingData, onboardingGate.resumeStep, profile?.faction]);

  useEffect(() => {
    if (status === "unauthenticated" || (!user && status !== "loading" && status !== "recovering")) {
      navigate("/welcome", { replace: true });
    }
  }, [navigate, status, user]);

  useEffect(() => {
    if (profileLoading || companionLoading || !profile) return;

    if (companionOnly && companion) {
      navigate("/companion", { replace: true });
      return;
    }

    if (!companionOnly && onboardingGate.isEstablished) {
      navigate(PRODUCT.mode === "cosmiq" ? "/journeys" : "/mentor", { replace: true });
    }
  }, [
    companion,
    companionLoading,
    companionOnly,
    navigate,
    onboardingGate.isEstablished,
    profile,
    profileLoading,
  ]);

  if (
    status === "loading"
    || status === "recovering"
    || profileLoading
    || companionLoading
  ) {
    return <PageLoader message={`Preparing your ${PRODUCT.name} journey…`} />;
  }

  if (!user) return null;

  if (profileError || companionError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-safe">
        <section className="w-full max-w-md rounded-[28px] border border-border/70 bg-card/95 p-6 text-card-foreground shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Connection check
          </p>
          <h1 className="mt-3 text-2xl font-semibold">We couldn't load your journey</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your progress is still safe. Retry the sync before continuing.
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

  if (companionOnly && companion) return null;
  if (!companionOnly && onboardingGate.isEstablished) return null;

  return (
    <GracewardOnboarding
      mode={companionOnly ? "creation" : "standard"}
      resumeState={resumeState}
    />
  );
}
