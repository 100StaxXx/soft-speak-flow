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
const DEFAULT_AUTH_REDIRECT_PATH = "/onboarding";
const RETURNING_USER_REDIRECT_PATH = "/tasks";

interface AuthRedirectOptions {
  email?: string | null;
}

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
  "selected_mentor_id" | "onboarding_completed" | "onboarding_step" | "onboarding_data" | "timezone"
>;

const fetchAuthRedirectProfile = (userId: string) =>
  supabase
    .from("profiles")
    .select("selected_mentor_id, onboarding_completed, onboarding_step, onboarding_data, timezone")
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

const getDeviceTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const queueProfileBootstrap = (userId: string, email: string | null | undefined, timezone: string) => {
  const profileBootstrap = buildProfileBootstrapPayload(userId, email ?? null, timezone);

  Promise.resolve(
    supabase.from("profiles").upsert(profileBootstrap, {
      onConflict: "id",
    }),
  )
    .then(({ error }) => {
      if (error && !error.message.includes("duplicate")) {
        logger.warn("[authRedirect] Failed to bootstrap missing profile", { userId, error });
      }
    })
    .catch((error: unknown) => {
      logger.warn("[authRedirect] Missing profile bootstrap threw", { userId, error });
    });
};

const queueProfileTimezoneSync = (
  userId: string,
  profile: AuthRedirectProfile | null,
  timezone: string,
) => {
  if (!profile || profile.timezone === timezone) return;

  Promise.resolve(
    supabase.from("profiles").update({
      timezone,
    }).eq("id", userId),
  )
    .then(({ error }) => {
      if (error) {
        logger.warn("[authRedirect] Failed to sync profile timezone", { userId, error });
      }
    })
    .catch((error: unknown) => {
      logger.warn("[authRedirect] Profile timezone sync threw", { userId, error });
    });
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
const resolvePathFromContext = (
  userId: string,
  context: {
    profile: AuthRedirectProfile | null;
    profileError: string | null;
    hasCompanion: boolean;
    hasPresetCompanion: boolean;
    companionStage: number | null;
  },
  options: AuthRedirectOptions = {},
): string | null => {
  const { profile, profileError, hasCompanion, hasPresetCompanion, companionStage } = context;

  if (profileError) {
    return null;
  }

  const userTimezone = getDeviceTimezone();

  if (!profile) {
    queueProfileBootstrap(userId, options.email, userTimezone);
    logger.debug("[authRedirect] Missing profile detected, bootstrapping in background");
    return DEFAULT_AUTH_REDIRECT_PATH;
  }

  queueProfileTimezoneSync(userId, profile, userTimezone);

  const resolvedMentorId = getResolvedMentorId(profile);
  const onboardingMentorId = getOnboardingMentorId(profile);
  const walkthroughCompleted = hasWalkthroughCompleted(profile?.onboarding_data);
  const gate = getOnboardingGateState({ profile, hasCompanion, hasPresetCompanion, companionStage });

  logger.debug("[authRedirect] Profile fetched", {
    hasProfile: !!profile,
    onboardingCompleted: profile.onboarding_completed,
    onboardingStep: profile.onboarding_step,
    walkthroughCompleted,
    hasCompanion,
    hasPresetCompanion,
    companionStage,
    hasMentor: !!profile.selected_mentor_id,
    onboardingMentorId: onboardingMentorId?.substring(0, 8),
    resolvedMentorId: resolvedMentorId?.substring(0, 8),
    gateReason: gate.reason,
    needsCompanionMigration: gate.needsCompanionMigration,
    timezoneChanged: profile.timezone !== userTimezone,
  });

  if (profile.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId) {
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
};

const isReturningUser = async (userId: string, options: AuthRedirectOptions = {}): Promise<boolean> => {
  try {
    const context = await readAuthRedirectContext(
      userId,
      RETURNING_USER_QUERY_TIMEOUT_MS,
    );
    const resolvedPath = resolvePathFromContext(userId, context, options);
    return resolvedPath === RETURNING_USER_REDIRECT_PATH;
  } catch (error) {
    logger.warn("[isReturningUser] Returning user check failed, defaulting to false", { error });
    return false;
  }
};

const resolveReturningUserPath = async (userId: string, options: AuthRedirectOptions = {}): Promise<string> => {
  const returning = await isReturningUser(userId, options);
  return returning ? RETURNING_USER_REDIRECT_PATH : DEFAULT_AUTH_REDIRECT_PATH;
};

/**
 * Fast fallback path resolution for timeout/race scenarios.
 * Existing users (onboarding completed) should land on /tasks.
 */
export const getProfileAwareAuthFallbackPath = async (
  userId: string,
  options: AuthRedirectOptions = {},
): Promise<string> => {
  try {
    return await resolveReturningUserPath(userId, options);
  } catch (error) {
    logger.warn("[getProfileAwareAuthFallbackPath] Fallback resolution failed, defaulting to /onboarding", { error });
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
};

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
const resolveAuthRedirectPath = async (userId: string, options: AuthRedirectOptions = {}): Promise<string> => {
  try {
    logger.debug("[getAuthRedirectPath] Fetching profile...", { userId: userId.substring(0, 8) });

    const context = await readAuthRedirectContext(
      userId,
      PROFILE_QUERY_TIMEOUT_MS,
    );
    const resolvedPath = resolvePathFromContext(userId, context, options);
    if (!resolvedPath) {
      logger.warn("[getAuthRedirectPath] Profile fetch error, checking if returning user", { error: context.profileError });
      return await getProfileAwareAuthFallbackPath(userId, options);
    }

    return resolvedPath;
  } catch (error) {
    logger.error("[getAuthRedirectPath] Error, checking if returning user", { error });
    return await getProfileAwareAuthFallbackPath(userId, options);
  }
};

export const getAuthRedirectPath = async (
  userId: string,
  options: AuthRedirectOptions = {},
): Promise<string> => {
  try {
    return await withTimeout(
      () => resolveAuthRedirectPath(userId, options),
      HARD_FALLBACK_TIMEOUT_MS,
      "Auth redirect resolution",
    );
  } catch (error) {
    logger.error("[getAuthRedirectPath] Hard fallback triggered, routing to /onboarding", { error });
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
};
