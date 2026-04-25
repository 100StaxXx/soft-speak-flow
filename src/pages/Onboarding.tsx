import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { StoryOnboarding } from "@/components/onboarding";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
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
import { getStoredCompanionCustomName } from "@/lib/companionName";

export default function Onboarding() {
  const { user, status, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onboardingSelfHealAttemptedRef = useRef(false);
  const legacyAccountDeletionAttemptedRef = useRef(false);
  const [isDeletingLegacyAccount, setIsDeletingLegacyAccount] = useState(false);
  const [isSelfHealingProfile, setIsSelfHealingProfile] = useState(false);
  const [isShowingJourneyCinematic, setIsShowingJourneyCinematic] = useState(false);
  const onboardingData = (profile?.onboarding_data as Record<string, unknown> | null) ?? null;
  const hasCompanion = Boolean(companion);
  const hasPresetCompanion = Boolean(companion?.preset_id);
  const companionStage = companion?.current_stage ?? null;
  const hasCompanionImages = Boolean(companion?.current_image_url || companion?.initial_image_url);
  const onboardingGate = getOnboardingGateState({
    profile,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
    hasCompanionImages,
  });
  const onboardingGateReady =
    status !== "loading" &&
    status !== "recovering" &&
    (!user || (!profileLoading && !companionLoading));
  const journeyResumeState = useMemo(() => {
    if (!onboardingGate.resumeStep) return null;

    const trimmedUserName =
      typeof onboardingData?.userName === "string" ? onboardingData.userName.trim() : "";
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
      stage: onboardingGate.resumeStep,
      userName: trimmedUserName || "You",
      companionLabel,
      onboardingData,
      faction: typeof profile?.faction === "string" ? profile.faction : null,
    };
  }, [companion, onboardingData, onboardingGate.resumeStep, profile?.faction]);

  useEffect(() => {
    onboardingSelfHealAttemptedRef.current = false;
    legacyAccountDeletionAttemptedRef.current = false;
    setIsDeletingLegacyAccount(false);
    setIsSelfHealingProfile(false);
    setIsShowingJourneyCinematic(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !onboardingGateReady || onboardingSelfHealAttemptedRef.current) return;

    const patch = buildEstablishedProfileSelfHealPatch({
      profile,
      hasCompanion,
      hasPresetCompanion,
      companionStage,
      hasCompanionImages,
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
        }
        setIsSelfHealingProfile(false);
      });
  }, [user, onboardingGateReady, profile, hasCompanion, hasPresetCompanion, companionStage, hasCompanionImages]);

  const handleConfirmLegacyAccountReset = () => {
    if (!user || !onboardingGate.needsCompanionMigration) return;
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
  };

  useEffect(() => {
    if (!user || !onboardingGateReady) return;
    if (!onboardingGate.isEstablished) return;
    if (isShowingJourneyCinematic) return;

    navigate("/journeys", { replace: true });
  }, [user, onboardingGateReady, onboardingGate.isEstablished, isShowingJourneyCinematic, navigate]);

  if (status === "loading" || status === "recovering") {
    return null;
  }

  if (isDeletingLegacyAccount) {
    return <PageLoader message="Resetting your account so you can restart onboarding..." />;
  }

  if (user && onboardingGate.needsCompanionMigration) {
    return (
      <main className="min-h-screen bg-background px-4 py-safe flex items-center justify-center">
        <section className="max-w-xl rounded-[28px] border border-destructive/25 bg-card/95 p-6 text-card-foreground shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-destructive/10 p-3 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-destructive">
                Account Reset Required
              </p>
              <h1 className="text-2xl font-semibold">Your old companion setup needs a reset</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                This account was created before the current companion system. Resetting removes the old account data so
                you can restart onboarding cleanly with the new companion flow. We will not do this unless you confirm.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmLegacyAccountReset}
                >
                  Reset my account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signOut()}
                >
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (user && (
    profileLoading
    || companionLoading
    || isSelfHealingProfile
    || (onboardingGate.isEstablished && !isShowingJourneyCinematic)
  )) {
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
