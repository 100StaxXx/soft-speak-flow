import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { StoryOnboarding } from "@/components/onboarding";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
} from "@/utils/profileOnboarding";

export default function Onboarding() {
  const { user, status } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const navigate = useNavigate();
  const onboardingSelfHealAttemptedRef = useRef(false);
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

  useEffect(() => {
    onboardingSelfHealAttemptedRef.current = false;
  }, [user?.id]);

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

    void supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) {
          onboardingSelfHealAttemptedRef.current = false;
          console.warn("Failed to self-heal established profile flags:", error);
        }
      });
  }, [user, onboardingGateReady, profile, hasCompanion, hasPresetCompanion, companionStage]);

  useEffect(() => {
    if (!user || !onboardingGateReady) return;
    if (!onboardingGate.isEstablished) return;

    navigate("/journeys", { replace: true });
  }, [user, onboardingGateReady, onboardingGate.isEstablished, navigate]);

  if (status === "loading" || status === "recovering") {
    return null;
  }

  if (user && (profileLoading || companionLoading || onboardingGate.isEstablished)) {
    return null;
  }

  return (
    <StoryOnboarding
      mode={
        onboardingGate.needsProgressionReset
          ? "reset"
          : onboardingGate.needsCompanionMigration
            ? "migration"
            : "standard"
      }
      existingCompanion={companion}
    />
  );
}
