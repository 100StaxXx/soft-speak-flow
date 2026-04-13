import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { StoryOnboarding } from "@/components/onboarding";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCurrentAccount,
  getAccountDeletionErrorMetadata,
  getAccountDeletionFailureMessage,
  isAccountDeletionAuthError,
} from "@/services/accountDeletion";
import { logger } from "@/utils/logger";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
} from "@/utils/profileOnboarding";
import { getCompanionEggLabel, getCompanionPreset } from "@/config/companionCatalog";

export default function Onboarding() {
  const { user, status, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onboardingSelfHealAttemptedRef = useRef(false);
  const legacyAccountDeletionAttemptedRef = useRef(false);
  const [isDeletingLegacyAccount, setIsDeletingLegacyAccount] = useState(false);
  const [isShowingJourneyCinematic, setIsShowingJourneyCinematic] = useState(false);
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
    if (onboardingGate.resumeStep !== "journey-begins") return null;

    const trimmedUserName =
      typeof onboardingData?.userName === "string" ? onboardingData.userName.trim() : "";
    const spiritAnimal =
      typeof companion?.spirit_animal === "string" ? companion.spirit_animal.trim() : "";
    const presetName = companion?.preset_id
      ? getCompanionPreset(companion.preset_id)?.displayName ?? null
      : null;
    const elementalEggLabel = getCompanionEggLabel(companion?.core_element);
    const companionLabel =
      presetName
      || (spiritAnimal.length > 0 && spiritAnimal !== "Egg" ? spiritAnimal : elementalEggLabel);

    return {
      stage: "journey-begins" as const,
      userName: trimmedUserName || "You",
      companionLabel,
    };
  }, [companion, onboardingData, onboardingGate.resumeStep]);

  useEffect(() => {
    onboardingSelfHealAttemptedRef.current = false;
    legacyAccountDeletionAttemptedRef.current = false;
    setIsDeletingLegacyAccount(false);
    setIsShowingJourneyCinematic(false);
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
    if (!user || !onboardingGateReady || !onboardingGate.needsCompanionMigration) return;
    if (legacyAccountDeletionAttemptedRef.current) return;

    legacyAccountDeletionAttemptedRef.current = true;
    setIsDeletingLegacyAccount(true);

    void (async () => {
      try {
        await deleteCurrentAccount({
          queryClient,
          userId: user.id,
          signOut,
        });

        navigate("/auth", {
          replace: true,
          state: {
            message: "Your previous account was removed so you can restart onboarding with the new companion system.",
          },
        });
      } catch (error) {
        legacyAccountDeletionAttemptedRef.current = false;
        setIsDeletingLegacyAccount(false);

        if (isAccountDeletionAuthError(error)) {
          toast.error("Your session expired. Please sign in again.");
          try {
            await signOut();
          } catch (signOutError) {
            console.warn("Sign out after legacy account deletion auth error failed:", signOutError);
          }
          navigate("/auth", { replace: true });
          return;
        }

        const errorMetadata = getAccountDeletionErrorMetadata(error);
        logger.error("[Account Deletion] Legacy onboarding reset failed", {
          surface: "onboarding_legacy_reset",
          userId: user.id,
          code: errorMetadata.code,
          status: errorMetadata.status,
          requestId: errorMetadata.requestId,
          stage: errorMetadata.stage,
          message: error instanceof Error ? error.message : String(error),
        });

        toast.error(getAccountDeletionFailureMessage(error));
      }
    })();
  }, [user, onboardingGateReady, onboardingGate.needsCompanionMigration, navigate, queryClient, signOut]);

  useEffect(() => {
    if (!user || !onboardingGateReady) return;
    if (!onboardingGate.isEstablished) return;
    if (isShowingJourneyCinematic) return;

    navigate("/journeys", { replace: true });
  }, [user, onboardingGateReady, onboardingGate.isEstablished, isShowingJourneyCinematic, navigate]);

  if (status === "loading" || status === "recovering") {
    return null;
  }

  if (isDeletingLegacyAccount || (user && onboardingGate.needsCompanionMigration)) {
    return <PageLoader message="Resetting your account so you can restart onboarding..." />;
  }

  if (user && (profileLoading || companionLoading || (onboardingGate.isEstablished && !isShowingJourneyCinematic))) {
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
