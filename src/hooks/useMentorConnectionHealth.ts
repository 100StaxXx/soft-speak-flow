import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "@/utils/mentor";
import { logger } from "@/utils/logger";

type MentorConnectionStatus = "ready" | "recovering" | "missing";

type LightweightProfile = {
  selected_mentor_id?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_data?: unknown;
} | null;

const RECOVERY_ATTEMPTS = 2;
const RECOVERY_WINDOW_MS = 1500;
const RECOVERY_DELAY_MS = 750;

const stableMentorByUser = new Map<string, string>();
const log = logger.scope("MentorConnectionHealth");

const sleep = async (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

export function useMentorConnectionHealth(): {
  effectiveMentorId: string | null;
  status: MentorConnectionStatus;
  refreshConnection: () => Promise<void>;
} {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const queryClient = useQueryClient();
  const recoveryInFlightRef = useRef(false);

  const resolvedMentorId = useMemo(() => getResolvedMentorId(profile), [profile]);
  const stableMentorId = user?.id ? stableMentorByUser.get(user.id) ?? null : null;

  const [effectiveMentorId, setEffectiveMentorId] = useState<string | null>(
    resolvedMentorId ?? stableMentorId,
  );
  const [status, setStatus] = useState<MentorConnectionStatus>(
    resolvedMentorId ? "ready" : loading ? "recovering" : "missing",
  );

  const invalidateMentorQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mentor-page-data"] }),
      queryClient.invalidateQueries({ queryKey: ["mentor-personality"] }),
      queryClient.invalidateQueries({ queryKey: ["mentor"] }),
      queryClient.invalidateQueries({ queryKey: ["selected-mentor"] }),
    ]);
  }, [queryClient]);

  const sanitizeOnboardingMentor = useCallback(
    async (userId: string, candidateProfile: LightweightProfile) => {
      const sanitizedOnboardingData = stripOnboardingMentorId(candidateProfile?.onboarding_data);
      const { error: cleanupError } = await supabase
        .from("profiles")
        .update({ onboarding_data: sanitizedOnboardingData })
        .eq("id", userId);

      if (cleanupError) {
        log.warn("Failed to clear stale onboarding mentor ID", { userId, error: cleanupError });
        return;
      }

      log.warn("Cleared stale onboarding mentor ID", { userId });
      await queryClient.refetchQueries({ queryKey: ["profile", userId] });
    },
    [queryClient],
  );

  const validateOnboardingMentor = useCallback(async (mentorId: string) => {
    const { data: mentorLookup, error: mentorLookupError } = await supabase
      .from("mentors")
      .select("id")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorLookupError) {
      throw mentorLookupError;
    }

    return mentorLookup?.id ?? null;
  }, []);

  const backfillMentor = useCallback(
    async (userId: string, mentorId: string, candidateProfile: LightweightProfile) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ selected_mentor_id: mentorId })
        .eq("id", userId);

      if (updateError) {
        if (isInvalidMentorReferenceError(updateError)) {
          log.warn("Invalid mentor reference while backfilling, stripping onboarding mentor", {
            userId,
            mentorId,
            error: updateError,
          });
          await sanitizeOnboardingMentor(userId, candidateProfile);
          return null;
        }

        throw updateError;
      }

      await queryClient.refetchQueries({ queryKey: ["profile", userId] });
      await invalidateMentorQueries();
      return mentorId;
    },
    [invalidateMentorQueries, queryClient, sanitizeOnboardingMentor],
  );

  const attemptRecovery = useCallback(async () => {
    if (!user?.id) {
      setEffectiveMentorId(null);
      setStatus("missing");
      return;
    }

    if (recoveryInFlightRef.current) return;
    recoveryInFlightRef.current = true;

    setStatus("recovering");
    setEffectiveMentorId(stableMentorByUser.get(user.id) ?? null);

    const startedAt = performance.now();
    let recoveredMentorId: string | null = null;
    let finalCause: string = "profile_missing";
    let attemptsUsed = 0;
    log.info("Starting mentor connection recovery", { userId: user.id, attempts: RECOVERY_ATTEMPTS });

    try {
      for (let attemptIndex = 0; attemptIndex < RECOVERY_ATTEMPTS; attemptIndex += 1) {
        const attempt = attemptIndex + 1;
        attemptsUsed = attempt;

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          finalCause = "offline";
          log.warn("Recovery paused while offline", { userId: user.id, attempt });
          break;
        }

        await queryClient.refetchQueries({ queryKey: ["profile", user.id] });

        const { data: latestProfile, error: latestProfileError } = await supabase
          .from("profiles")
          .select("selected_mentor_id, onboarding_completed, onboarding_data")
          .eq("id", user.id)
          .maybeSingle();

        if (latestProfileError) {
          finalCause = "profile_missing";
          log.warn("Profile fetch failed during mentor recovery", {
            userId: user.id,
            attempt,
            error: latestProfileError,
          });
        } else if (!latestProfile) {
          finalCause = "profile_missing";
          log.warn("Profile missing during mentor recovery", { userId: user.id, attempt });
        } else if (latestProfile.selected_mentor_id) {
          recoveredMentorId = latestProfile.selected_mentor_id;
          finalCause = "profile_selected_mentor";
          break;
        } else {
          const onboardingMentorId = getOnboardingMentorId(latestProfile);
          if (!onboardingMentorId) {
            finalCause = "profile_missing";
            log.warn("No onboarding mentor available during recovery", { userId: user.id, attempt });
          } else {
            const validatedMentorId = await validateOnboardingMentor(onboardingMentorId);
            if (!validatedMentorId) {
              finalCause = "mentor_lookup_empty";
              log.warn("Onboarding mentor lookup returned empty result", {
                userId: user.id,
                attempt,
                mentorId: onboardingMentorId,
              });
              await sanitizeOnboardingMentor(user.id, latestProfile);
              finalCause = "invalid_onboarding_mentor";
            } else {
              recoveredMentorId = await backfillMentor(user.id, validatedMentorId, latestProfile);
              finalCause = recoveredMentorId ? "backfilled_from_onboarding" : "invalid_onboarding_mentor";
              if (recoveredMentorId) break;
            }
          }
        }

        const elapsedMs = performance.now() - startedAt;
        if (elapsedMs >= RECOVERY_WINDOW_MS || attemptIndex >= RECOVERY_ATTEMPTS - 1) break;
        await sleep(RECOVERY_DELAY_MS);
      }
    } catch (error) {
      finalCause = "recovery_error";
      log.warn("Mentor recovery attempt failed", {
        userId: user.id,
        cause: finalCause,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      recoveryInFlightRef.current = false;
    }

    if (recoveredMentorId) {
      stableMentorByUser.set(user.id, recoveredMentorId);
      setEffectiveMentorId(recoveredMentorId);
      setStatus("ready");
      log.info("Mentor connection recovery completed", {
        userId: user.id,
        attemptsUsed,
        cause: finalCause,
        recoveredMentorId,
      });
      return;
    }

    const fallbackMentorId = stableMentorByUser.get(user.id) ?? null;
    if (finalCause === "offline") {
      setEffectiveMentorId(fallbackMentorId);
      setStatus("recovering");
      log.warn("Mentor recovery still pending (offline)", { userId: user.id, attemptsUsed });
      return;
    }

    setEffectiveMentorId(fallbackMentorId);
    setStatus("missing");
    log.warn("Mentor connection recovery failed", { userId: user.id, attemptsUsed, cause: finalCause });
  }, [
    backfillMentor,
    queryClient,
    sanitizeOnboardingMentor,
    user?.id,
    validateOnboardingMentor,
  ]);

  const refreshConnection = useCallback(async () => {
    await attemptRecovery();
  }, [attemptRecovery]);

  useEffect(() => {
    if (!user?.id) {
      setEffectiveMentorId(null);
      setStatus("missing");
      return;
    }

    if (resolvedMentorId) {
      stableMentorByUser.set(user.id, resolvedMentorId);
      setEffectiveMentorId(resolvedMentorId);
      setStatus("ready");
      return;
    }

    const fallbackMentor = stableMentorByUser.get(user.id) ?? null;
    if (loading) {
      setEffectiveMentorId(fallbackMentor);
      setStatus("recovering");
      return;
    }

    void attemptRecovery();
  }, [attemptRecovery, loading, resolvedMentorId, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const handleOnline = () => {
      if (status !== "ready") {
        void attemptRecovery();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [attemptRecovery, status, user?.id]);

  return { effectiveMentorId, status, refreshConnection };
}
