import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { invalidateMentorContextQueries } from "@/lib/mentorContextQueryCache";
import { refetchProfileQueries } from "@/lib/profileQueryCache";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_MENTOR_SLUGS, resolveActiveMentorSlug } from "@/lib/mentorRoster";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
} from "@/utils/mentor";
import { logger } from "@/utils/logger";

export type MentorConnectionStatus = "ready" | "recovering" | "missing";

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
const PREFERRED_FALLBACK_MENTOR_SLUGS = ACTIVE_MENTOR_SLUGS;

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
    resolvedMentorId || loading ? "recovering" : "missing",
  );

  const invalidateMentorQueries = useCallback(async () => {
    await invalidateMentorContextQueries(queryClient, {
      includeMorningCheckIn: true,
    });
  }, [queryClient]);

  const getOnboardingDataRecord = useCallback((candidateProfile: LightweightProfile): Record<string, unknown> => {
    if (
      candidateProfile?.onboarding_data
      && typeof candidateProfile.onboarding_data === "object"
      && !Array.isArray(candidateProfile.onboarding_data)
    ) {
      return candidateProfile.onboarding_data as Record<string, unknown>;
    }

    return {};
  }, []);

  const getMentorRecord = useCallback(async (mentorId: string) => {
    const { data: mentorLookup, error: mentorLookupError } = await supabase
      .from("mentors")
      .select("id, slug")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorLookupError) {
      throw mentorLookupError;
    }

    return mentorLookup ?? null;
  }, []);

  const getMentorBySlug = useCallback(async (slug: string) => {
    const { data: mentorLookup, error: mentorLookupError } = await supabase
      .from("mentors")
      .select("id, slug")
      .eq("slug", slug)
      .maybeSingle();

    if (mentorLookupError) {
      throw mentorLookupError;
    }

    return mentorLookup ?? null;
  }, []);

  const getPreferredFallbackMentor = useCallback(async () => {
    for (const slug of PREFERRED_FALLBACK_MENTOR_SLUGS) {
      const mentorLookup = await getMentorBySlug(slug);
      if (!mentorLookup) continue;

      if (resolveActiveMentorSlug(mentorLookup.slug) === slug) {
        return mentorLookup;
      }
    }

    return null;
  }, [getMentorBySlug]);

  const persistMentorSelection = useCallback(
    async (userId: string, mentorId: string, candidateProfile: LightweightProfile, reason: string) => {
      const onboardingData = getOnboardingDataRecord(candidateProfile);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          selected_mentor_id: mentorId,
          onboarding_data: {
            ...onboardingData,
            mentorId,
          },
        })
        .eq("id", userId);

      if (updateError) {
        if (isInvalidMentorReferenceError(updateError)) {
          log.warn("Invalid mentor reference while persisting canonical mentor", {
            userId,
            mentorId,
            reason,
            error: updateError,
          });
          return null;
        }

        throw updateError;
      }

      await refetchProfileQueries(queryClient, {
        userId,
        includeDetail: true,
      });
      await invalidateMentorQueries();
      return mentorId;
    },
    [getOnboardingDataRecord, invalidateMentorQueries, queryClient],
  );

  const repairMentorSelectionToSage = useCallback(
    async (
      userId: string,
      invalidMentorId: string,
      candidateProfile: LightweightProfile,
      source: "selected_mentor" | "onboarding_mentor",
    ) => {
      const fallbackMentor = await getPreferredFallbackMentor();
      if (!fallbackMentor?.id) {
        log.warn("Unable to repair mentor selection because no canonical fallback mentor is available", {
          userId,
          source,
          invalidMentorId,
        });
        return { mentorId: null, cause: "canonical_fallback_missing" as const };
      }

      const repairedMentorId = await persistMentorSelection(
        userId,
        fallbackMentor.id,
        candidateProfile,
        `fallback_from_${source}`,
      );

      if (!repairedMentorId) {
        return { mentorId: null, cause: "canonical_fallback_persist_failed" as const };
      }

      log.warn("Repaired stale mentor selection to canonical fallback mentor", {
        userId,
        source,
        invalidMentorId,
        repairedMentorId,
        fallbackSlug: fallbackMentor.slug,
      });
      return { mentorId: repairedMentorId, cause: "fallback_to_canonical_mentor" as const };
    },
    [getPreferredFallbackMentor, persistMentorSelection],
  );

  const ensureCanonicalMentor = useCallback(
    async (
      userId: string,
      mentorId: string,
      candidateProfile: LightweightProfile,
      source: "selected_mentor" | "onboarding_mentor",
    ) => {
      const mentorRecord = await getMentorRecord(mentorId);
      const resolvedSlug = resolveActiveMentorSlug(mentorRecord?.slug);

      if (!mentorRecord?.id || !resolvedSlug) {
        return repairMentorSelectionToSage(userId, mentorId, candidateProfile, source);
      }

      if (source === "selected_mentor") {
        return { mentorId: mentorRecord.id, cause: "profile_selected_mentor" as const };
      }

      const backfilledMentorId = await persistMentorSelection(
        userId,
        mentorRecord.id,
        candidateProfile,
        "backfill_from_onboarding",
      );

      return {
        mentorId: backfilledMentorId,
        cause: backfilledMentorId ? "backfilled_from_onboarding" as const : "backfill_failed" as const,
      };
    },
    [getMentorRecord, persistMentorSelection, repairMentorSelectionToSage],
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
    setEffectiveMentorId(stableMentorByUser.get(user.id) ?? resolvedMentorId ?? null);

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

        await refetchProfileQueries(queryClient, {
          userId: user.id,
          includeDetail: true,
        });

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
          const canonicalSelection = await ensureCanonicalMentor(
            user.id,
            latestProfile.selected_mentor_id,
            latestProfile,
            "selected_mentor",
          );
          recoveredMentorId = canonicalSelection.mentorId;
          finalCause = canonicalSelection.cause;
          break;
        } else {
          const onboardingMentorId = getOnboardingMentorId(latestProfile);
          if (!onboardingMentorId) {
            finalCause = "profile_missing";
            log.warn("No onboarding mentor available during recovery", { userId: user.id, attempt });
          } else {
            const canonicalSelection = await ensureCanonicalMentor(
              user.id,
              onboardingMentorId,
              latestProfile,
              "onboarding_mentor",
            );
            recoveredMentorId = canonicalSelection.mentorId;
            finalCause = canonicalSelection.cause;
            if (recoveredMentorId) break;
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

    const offlineFallbackMentorId = stableMentorByUser.get(user.id) ?? resolvedMentorId ?? null;
    if (finalCause === "offline") {
      setEffectiveMentorId(offlineFallbackMentorId);
      setStatus("recovering");
      log.warn("Mentor recovery still pending (offline)", { userId: user.id, attemptsUsed });
      return;
    }

    const fallbackMentorId = stableMentorByUser.get(user.id) ?? null;
    setEffectiveMentorId(fallbackMentorId);
    setStatus("missing");
    log.warn("Mentor connection recovery failed", { userId: user.id, attemptsUsed, cause: finalCause });
  }, [
    ensureCanonicalMentor,
    queryClient,
    resolvedMentorId,
    user?.id,
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

    const fallbackMentor = stableMentorByUser.get(user.id) ?? null;
    if (loading) {
      setEffectiveMentorId(resolvedMentorId ?? fallbackMentor);
      setStatus("recovering");
      return;
    }

    setEffectiveMentorId(resolvedMentorId ?? fallbackMentor);
    setStatus("recovering");
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
