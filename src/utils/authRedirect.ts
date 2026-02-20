import { supabase } from "@/integrations/supabase/client";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "./mentor";
import { logger } from "./logger";

const PROFILE_QUERY_TIMEOUT_MS = 5000;
const RETURNING_USER_QUERY_TIMEOUT_MS = 2000;
const HARD_FALLBACK_TIMEOUT_MS = 8000;
const PROFILE_MUTATION_TIMEOUT_MS = 3000;
const DEFAULT_AUTH_REDIRECT_PATH = "/onboarding";
const RETURNING_USER_REDIRECT_PATH = "/tasks";

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

/**
 * Quick check if user has completed onboarding (for fallback scenarios)
 */
const isReturningUser = async (userId: string): Promise<boolean> => {
  try {
    const { data } = await withTimeout(
      () =>
        supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle(),
      RETURNING_USER_QUERY_TIMEOUT_MS,
      "Returning user check",
    );

    return data?.onboarding_completed === true;
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
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
const resolveAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    logger.debug("[getAuthRedirectPath] Fetching profile...", { userId: userId.substring(0, 8) });

    const { data: profile, error } = await withTimeout(
      () =>
        supabase
          .from("profiles")
          .select("selected_mentor_id, onboarding_completed, onboarding_data")
          .eq("id", userId)
          .maybeSingle(),
      PROFILE_QUERY_TIMEOUT_MS,
      "Profile fetch",
    );

    if (error) {
      logger.warn("[getAuthRedirectPath] Profile fetch error, checking if returning user", { error: error.message });
      return await resolveReturningUserPath(userId);
    }

    const resolvedMentorId = getResolvedMentorId(profile);
    const onboardingMentorId = getOnboardingMentorId(profile);
    logger.debug("[getAuthRedirectPath] Profile fetched", {
      hasProfile: !!profile,
      onboardingCompleted: profile?.onboarding_completed,
      hasMentor: !!profile?.selected_mentor_id,
      onboardingMentorId: onboardingMentorId?.substring(0, 8),
      resolvedMentorId: resolvedMentorId?.substring(0, 8),
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

    // If onboarding is completed, always go to tasks
    if (profile?.onboarding_completed) {
      logger.debug("[getAuthRedirectPath] Onboarding complete, redirecting to /tasks");
      return RETURNING_USER_REDIRECT_PATH;
    }

    // Explicitly incomplete onboarding must always return to onboarding.
    if (profile?.onboarding_completed === false) {
      logger.debug("[getAuthRedirectPath] Onboarding marked incomplete, redirecting to /onboarding");
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    // No profile or no mentor selected -> onboarding
    if (!profile || !resolvedMentorId) {
      logger.debug("[getAuthRedirectPath] No profile or mentor, redirecting to /onboarding");
      return DEFAULT_AUTH_REDIRECT_PATH;
    }

    // Has mentor -> quests page
    logger.debug("[getAuthRedirectPath] Has mentor, redirecting to /tasks");
    return RETURNING_USER_REDIRECT_PATH;
  } catch (error) {
    logger.error("[getAuthRedirectPath] Error, checking if returning user", { error });
    return await resolveReturningUserPath(userId);
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
      // Create new profile with user's timezone
      logger.debug("[ensureProfile] Creating new profile...");
      const { error } = await withTimeout(
        () =>
          supabase.from("profiles").upsert(
            {
              id: userId,
              email: email ?? null,
              timezone: userTimezone,
            },
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
        logger.debug("[ensureProfile] Profile created successfully");
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
