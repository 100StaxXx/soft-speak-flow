import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { StoryOnboarding } from "@/components/onboarding";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { deleteCurrentAccount, isAccountDeletionAuthError } from "@/services/accountDeletion";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
} from "@/utils/profileOnboarding";

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

        toast.error(
          error instanceof Error
            ? error.message
            : "We couldn't reset your legacy account automatically. Please try again.",
        );
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
      onJourneyCinematicStart={() => setIsShowingJourneyCinematic(true)}
      onJourneyCinematicComplete={() => setIsShowingJourneyCinematic(false)}
    />
  );
}
