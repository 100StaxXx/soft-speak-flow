import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { StoryOnboarding } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
} from "@/utils/profileOnboarding";
import { getCompanionEggLabel, getCompanionPreset } from "@/config/companionCatalog";
import { getStoredCompanionCustomName } from "@/lib/companionName";
import { trackOnboardingTutorialEvent } from "@/utils/onboardingTutorialTelemetry";

const ONBOARDING_GATE_STALL_MS = 12_000;

export default function Onboarding() {
  const { user, status, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onboardingSelfHealAttemptedRef = useRef(false);
  const gateLoadStartedAtRef = useRef<number | null>(null);
  const gateLoadTimeoutRef = useRef<number | null>(null);
  const gateLoadSnapshotRef = useRef({ status, profileLoading, companionLoading });
  const [isSelfHealingProfile, setIsSelfHealingProfile] = useState(false);
  const [isShowingJourneyCinematic, setIsShowingJourneyCinematic] = useState(false);
  const [hasGateLoadTimedOut, setHasGateLoadTimedOut] = useState(false);
  const [gateLoadRetryNonce, setGateLoadRetryNonce] = useState(0);
  const onboardingData = (profile?.onboarding_data as Record<string, unknown> | null) ?? null;
  const hasCompanion = Boolean(companion);
  const hasPresetCompanion = Boolean(companion?.preset_id);
  const companionStage = companion?.current_stage ?? null;
  const onboardingGate = getOnboardingGateState({
    profile,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
  });
  const onboardingGateReady =
    status !== "loading" &&
    status !== "recovering" &&
    (!user || (!profileLoading && !companionLoading));
  const journeyResumeState = useMemo(() => {
    if (!onboardingGate.resumeStep) return null;

    const trimmedUserName =
      typeof onboardingData?.userName === "string" ? onboardingData.userName.trim() : "";
    const resumeStep =
      trimmedUserName.length > 0 ||
      onboardingGate.resumeStep === "prologue" ||
      onboardingGate.resumeStep === "journey-begins"
        ? onboardingGate.resumeStep
        : "prologue";
    const spiritAnimal =
      typeof companion?.spirit_animal === "string" ? companion.spirit_animal.trim() : "";
    const presetName = companion?.preset_id
      ? getCompanionPreset(companion.preset_id)?.displayName ?? null
      : null;
    const elementalEggLabel = getCompanionEggLabel(companion?.core_element);
    const isStageZeroEgg = companion?.current_stage === 0;
    const companionLabel =
      getStoredCompanionCustomName(companion)
      || (isStageZeroEgg ? elementalEggLabel : null)
      || presetName
      || (spiritAnimal.length > 0 && spiritAnimal !== "Egg" ? spiritAnimal : elementalEggLabel);

    return {
      stage: resumeStep,
      userName: trimmedUserName || (resumeStep === "journey-begins" ? "You" : ""),
      companionLabel,
      onboardingData,
      faction: typeof profile?.faction === "string" ? profile.faction : null,
    };
  }, [companion, onboardingData, onboardingGate.resumeStep, profile?.faction]);

  useEffect(() => {
    onboardingSelfHealAttemptedRef.current = false;
    gateLoadStartedAtRef.current = null;
    if (gateLoadTimeoutRef.current !== null) {
      window.clearTimeout(gateLoadTimeoutRef.current);
      gateLoadTimeoutRef.current = null;
    }
    setIsSelfHealingProfile(false);
    setIsShowingJourneyCinematic(false);
    setHasGateLoadTimedOut(false);
  }, [user?.id]);

  useEffect(() => {
    gateLoadSnapshotRef.current = { status, profileLoading, companionLoading };
  }, [companionLoading, profileLoading, status]);

  useEffect(() => {
    if (gateLoadTimeoutRef.current !== null) {
      window.clearTimeout(gateLoadTimeoutRef.current);
      gateLoadTimeoutRef.current = null;
    }

    if (!user || onboardingGateReady) {
      gateLoadStartedAtRef.current = null;
      setHasGateLoadTimedOut(false);
      return;
    }

    const startedAt = gateLoadStartedAtRef.current ?? Date.now();
    gateLoadStartedAtRef.current = startedAt;
    const remainingMs = Math.max(0, ONBOARDING_GATE_STALL_MS - (Date.now() - startedAt));

    gateLoadTimeoutRef.current = window.setTimeout(() => {
      gateLoadTimeoutRef.current = null;
      const snapshot = gateLoadSnapshotRef.current;
      setHasGateLoadTimedOut(true);
      trackOnboardingTutorialEvent("onboarding_gate_load_stalled", {
        userId: user.id,
        status: snapshot.status,
        profileLoading: snapshot.profileLoading,
        companionLoading: snapshot.companionLoading,
      });
    }, remainingMs);

    return () => {
      if (gateLoadTimeoutRef.current !== null) {
        window.clearTimeout(gateLoadTimeoutRef.current);
        gateLoadTimeoutRef.current = null;
      }
    };
  }, [gateLoadRetryNonce, onboardingGateReady, user?.id]);

  const handleRetryGateLoad = () => {
    if (!user) return;

    setHasGateLoadTimedOut(false);
    gateLoadStartedAtRef.current = Date.now();
    setGateLoadRetryNonce((nonce) => nonce + 1);
    trackOnboardingTutorialEvent("onboarding_gate_load_retry", {
      userId: user.id,
      profileLoading,
      companionLoading,
    });
    void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    void queryClient.invalidateQueries({ queryKey: ["companion", user.id] });
  };

  useEffect(() => {
    if (!user || !onboardingGateReady || onboardingSelfHealAttemptedRef.current) return;

    const patch = buildEstablishedProfileSelfHealPatch({
      profile,
      hasCompanion,
      hasPresetCompanion,
      companionStage,
    });
    if (!patch) return;

    onboardingSelfHealAttemptedRef.current = true;
    setIsSelfHealingProfile(true);

    void supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          onboardingSelfHealAttemptedRef.current = false;
          console.warn("Failed to self-heal established profile flags:", error);
          toast.error("We couldn't finish repairing your onboarding state. Please refresh and try again.");
        } else {
          void queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        }
        setIsSelfHealingProfile(false);
      });
  }, [user, onboardingGateReady, profile, hasCompanion, hasPresetCompanion, companionStage, queryClient]);

  useEffect(() => {
    if (!user || !onboardingGateReady) return;
    if (!onboardingGate.isEstablished) return;
    if (isShowingJourneyCinematic) return;

    navigate("/journeys", { replace: true });
  }, [user, onboardingGateReady, onboardingGate.isEstablished, isShowingJourneyCinematic, navigate]);

  if (status === "loading" || status === "recovering") {
    return null;
  }

  if (user && (
    profileLoading
    || companionLoading
    || isSelfHealingProfile
    || (onboardingGate.isEstablished && !isShowingJourneyCinematic)
  )) {
    if (hasGateLoadTimedOut && (profileLoading || companionLoading)) {
      return (
        <main className="min-h-screen bg-background px-4 py-safe flex items-center justify-center">
          <section className="max-w-md rounded-[28px] border border-border/70 bg-card/95 p-6 text-card-foreground shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Connection Check
            </p>
            <h1 className="mt-3 text-2xl font-semibold">We are still loading your setup</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your onboarding state is taking longer than expected to load. You can retry the profile sync or sign out
              and come back in cleanly.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={handleRetryGateLoad}>
                Retry loading
              </Button>
              <Button type="button" variant="outline" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          </section>
        </main>
      );
    }
    return null;
  }

  return (
    <StoryOnboarding
      mode={onboardingGate.needsProgressionReset ? "reset" : "standard"}
      resumeState={journeyResumeState}
      onJourneyCinematicStart={() => setIsShowingJourneyCinematic(true)}
      onJourneyCinematicComplete={() => setIsShowingJourneyCinematic(false)}
    />
  );
}
