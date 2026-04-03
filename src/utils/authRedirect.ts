import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "./mentor";
import { logger } from "./logger";
import {
  buildEstablishedProfileSelfHealPatch,
  getOnboardingGateState,
  hasWalkthroughCompleted,
} from "./profileOnboarding";

const PROFILE_QUERY_TIMEOUT_MS = 5000;
const RETURNING_USER_QUERY_TIMEOUT_MS = 2000;
const HARD_FALLBACK_TIMEOUT_MS = 8000;
const PROFILE_MUTATION_TIMEOUT_MS = 3000;
const DEFAULT_AUTH_REDIRECT_PATH = "/onboarding";
const RETURNING_USER_REDIRECT_PATH = "/tasks";

const buildProfileBootstrapPayload = (
  userId: string,
  email: string | null,
  timezone: string,
): Database["public"]["Tables"]["profiles"]["Insert"] => ({
  id: userId,
  email: email ?? null,
  timezone,
});

type AuthRedirectProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "selected_mentor_id" | "onboarding_completed" | "onboarding_step" | "onboarding_data"
>;

const fetchAuthRedirectProfile = (userId: string) =>
  supabase
    .from("profiles")
    .select("selected_mentor_id, onboarding_completed, onboarding_step, onboarding_data")
    .eq("id", userId)
    .maybeSingle();

const fetchAuthRedirectCompanion = (userId: string) =>
  supabase
    .from("user_companion")
    .select("id, preset_id, current_stage")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

/**
 * Helper to wrap a promise with a timeout
 */
const withTimeout = <T>(promiseFn: () => PromiseLike<T>, timeoutMs: number, operation: string): Promise<T> => {
  return Promise.race([
    Promise.resolve(promiseFn()),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

const readAuthRedirectContext = async (
  userId: string,
  timeoutMs: number,
): Promise<{
  profile: AuthRedirectProfile | null;
  profileError: string | null;
  hasCompanion: boolean;
  hasPresetCompanion: boolean;
  companionStage: number | null;
}> => {
  const [profileResult, companionResult] = await Promise.allSettled([
    withTimeout(
      () => fetchAuthRedirectProfile(userId),
      timeoutMs,
      "Profile fetch",
    ),
    withTimeout(
      () => fetchAuthRedirectCompanion(userId),
      timeoutMs,
      "Companion fetch",
    ),
  ]);

  let profile: AuthRedirectProfile | null = null;
  let profileError: string | null = null;
  let hasCompanion = false;
  let hasPresetCompanion = false;
  let companionStage: number | null = null;

  if (profileResult.status === "fulfilled") {
    profile = (profileResult.value.data ?? null) as AuthRedirectProfile | null;
    if (profileResult.value.error) {
      profileError = profileResult.value.error.message;
    }
  } else {
    profileError = profileResult.reason instanceof Error ? profileResult.reason.message : String(profileResult.reason);
  }

  if (companionResult.status === "fulfilled") {
    if (companionResult.value.error) {
      logger.warn("[authRedirect] Companion lookup failed, continuing without companion signal", {
        error: companionResult.value.error.message,
      });
    } else {
      hasCompanion = Boolean(companionResult.value.data?.id);
      hasPresetCompanion = Boolean(companionResult.value.data?.preset_id);
      companionStage = typeof companionResult.value.data?.current_stage === "number"
        ? companionResult.value.data.current_stage
        : null;
    }
  } else {
    logger.warn("[authRedirect] Companion lookup timed out, continuing without companion signal", {
      error: companionResult.reason instanceof Error ? companionResult.reason.message : String(companionResult.reason),
    });
  }

  return { profile, profileError, hasCompanion, hasPresetCompanion, companionStage };
};

const scheduleEstablishedProfileSelfHeal = (
  userId: string,
  profile: AuthRedirectProfile | null,
  hasCompanion: boolean,
  hasPresetCompanion: boolean,
  companionStage: number | null,
) => {
  const patch = buildEstablishedProfileSelfHealPatch({
    profile,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
  });
  if (!patch) return;

  Promise.resolve(
    supabase
      .from("profiles")
      .update(patch as any)
      .eq("id", userId),
  )
    .then(({ error }) => {
      if (error) {
        logger.warn("[authRedirect] Failed to self-heal established profile flags", { userId, error });
      }
    })
    .catch((error: unknown) => {
      logger.warn("[authRedirect] Established profile self-heal threw", { userId, error });
    });
};

/**
 * Quick check if user has completed onboarding (for fallback scenarios)
 */
const isReturningUser = async (userId: string): Promise<boolean> => {
  try {
    const { profile, profileError, hasCompanion, hasPresetCompanion, companionStage } = await readAuthRedirectContext(
      userId,
      RETURNING_USER_QUERY_TIMEOUT_MS,
    );
    if (profileError) {
      throw new Error(profileError);
    }

    const gate = getOnboardingGateState({ profile, hasCompanion, hasPresetCompanion, companionStage });
    if (gate.isEstablished) {
      scheduleEstablishedProfileSelfHeal(userId, profile, hasCompanion, hasPresetCompanion, companionStage);
    }

    return gate.isEstablished;
  } catch (error) {
    logger.warn("[isReturningUser] Returning user check failed, defaulting to false", { error });
    return false;
  }
};

const resolveReturningUserPath = async (userId: string): Promise<string> => {
  const returning = await isReturningUser(userId);
  return returning ? RETURNING_USER_REDIRECT_PATH : DEFAULT_AUTH_REDIRECT_PATH;
};

/**
 * Fast fallback path resolution for timeout/race scenarios.
 * Existing users (onboarding completed) should land on /tasks.
 */
export const getProfileAwareAuthFallbackPath = async (userId: string): Promise<string> => {
  try {
    return await resolveReturningUserPath(userId);
  } catch (error) {
    logger.warn("[getProfileAwareAuthFallbackPath] Fallback resolution failed, defaulting to /onboarding", { error });
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
};

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
const resolveAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    logger.debug("[getAuthRedirectPath] Fetching profile...", { userId: userId.substring(0, 8) });

    const { profile, profileError, hasCompanion, hasPresetCompanion, companionStage } = await readAuthRedirectContext(
      userId,
      PROFILE_QUERY_TIMEOUT_MS,
    );

    if (profileError) {
      logger.warn("[getAuthRedirectPath] Profile fetch error, checking if returning user", { error: profileError });
      return await getProfileAwareAuthFallbackPath(userId);
    }

    const resolvedMentorId = getResolvedMentorId(profile);
    const onboardingMentorId = getOnboardingMentorId(profile);
    const walkthroughCompleted = hasWalkthroughCompleted(profile?.onboarding_data);
    const gate = getOnboardingGateState({ profile, hasCompanion, hasPresetCompanion, companionStage });
    logger.debug("[getAuthRedirectPath] Profile fetched", {
      hasProfile: !!profile,
      onboardingCompleted: profile?.onboarding_completed,
      onboardingStep: profile?.onboarding_step,
      walkthroughCompleted,
      hasCompanion,
      hasPresetCompanion,
      companionStage,
      hasMentor: !!profile?.selected_mentor_id,
      onboardingMentorId: onboardingMentorId?.substring(0, 8),
      resolvedMentorId: resolvedMentorId?.substring(0, 8),
      gateReason: gate.reason,
      needsCompanionMigration: gate.needsCompanionMigration,
    });

    if (profile?.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId) {
      // Fire and forget - don't block navigation on profile cleanup
      Promise.resolve((async () => {
        const { error: backfillError } = await supabase
          .from("profiles")
          .update({ selected_mentor_id: onboardingMentorId })
          .eq("id", userId);

        if (!backfillError) {
          logger.debug("[getAuthRedirectPath] Mentor ID updated");
          return;
        }

        if (!isInvalidMentorReferenceError(backfillError)) {
          logger.warn("[getAuthRedirectPath] Failed to update mentor ID", { error: backfillError });
          return;
        }

        const sanitizedOnboardingData = stripOnboardingMentorId(profile.onboarding_data);
        const { error: cleanupError } = await supabase
          .from("profiles")
          .update({ onboarding_data: sanitizedOnboardingData })
          .eq("id", userId);

        if (cleanupError) {
          logger.warn("[getAuthRedirectPath] Failed to clear stale onboarding mentor ID", { error: cleanupError });
          return;
        }

        logger.debug("[getAuthRedirectPath] Cleared stale onboarding mentor ID");
      })()).catch((err: Error) =>
        logger.warn("[getAuthRedirectPath] Mentor backfill cleanup failed", { error: err }),
      );
    }

    if (gate.isEstablished) {
      scheduleEstablishedProfileSelfHeal(userId, profile, hasCompanion, hasPresetCompanion, companionStage);
      logger.debug("[getAuthRedirectPath] Established account, redirecting to /tasks", {
        reason: gate.reason,
      });
      return RETURNING_USER_REDIRECT_PATH;
    }

    logger.debug("[getAuthRedirectPath] Account still needs onboarding, redirecting to /onboarding");
    return DEFAULT_AUTH_REDIRECT_PATH;
  } catch (error) {
    logger.error("[getAuthRedirectPath] Error, checking if returning user", { error });
    return await getProfileAwareAuthFallbackPath(userId);
  }
};

export const getAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    return await withTimeout(
      () => resolveAuthRedirectPath(userId),
      HARD_FALLBACK_TIMEOUT_MS,
      "Auth redirect resolution",
    );
  } catch (error) {
    logger.error("[getAuthRedirectPath] Hard fallback triggered, routing to /onboarding", { error });
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
};

/**
 * Ensures a profile exists for a user, creating one if needed
 * Also updates timezone to match user's current device
 */
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  logger.debug("[ensureProfile] Starting...", { userId: userId.substring(0, 8), email: email?.substring(0, 5) });

  try {
    const { data: existing, error: fetchError } = await withTimeout(
      () =>
        supabase
          .from("profiles")
          .select("id, timezone")
          .eq("id", userId)
          .maybeSingle(),
      PROFILE_MUTATION_TIMEOUT_MS,
      "Profile check",
    );

    if (fetchError) {
      logger.warn("[ensureProfile] Fetch error, continuing anyway", { error: fetchError.message });
      return; // Don't block navigation for this
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    logger.debug("[ensureProfile] Profile check result", { exists: !!existing, userTimezone });

    if (!existing) {
      // Create a missing profile without resetting onboarding or mentor state
      // if another client already created the row before this upsert lands.
      logger.debug("[ensureProfile] Creating new profile...");
      const profileBootstrap = buildProfileBootstrapPayload(userId, email, userTimezone);
      const { error } = await withTimeout(
        () =>
          supabase.from("profiles").upsert(
            profileBootstrap,
            {
              onConflict: "id",
            },
          ),
        PROFILE_MUTATION_TIMEOUT_MS,
        "Profile create",
      );

      if (error && !error.message.includes("duplicate")) {
        logger.warn("[ensureProfile] Create error, continuing anyway", { error: error.message });
        // Don't throw - allow navigation to continue
      } else {
        logger.debug("[ensureProfile] Profile bootstrap completed");
      }
    } else if (existing.timezone !== userTimezone) {
      // Update timezone if it's different - fire and forget
      logger.debug("[ensureProfile] Updating timezone...");
      Promise.resolve(
        supabase.from("profiles").update({
          timezone: userTimezone,
        }).eq("id", userId),
      )
        .then(() => logger.debug("[ensureProfile] Timezone updated"))
        .catch((err: Error) => logger.warn("[ensureProfile] Timezone update failed", { error: err }));
    } else {
      logger.debug("[ensureProfile] Profile exists, no update needed");
    }
  } catch (error) {
    // Log but don't throw - allow navigation to continue even if profile operations fail
    logger.warn("[ensureProfile] Error (non-blocking)", { error });
  }
};
