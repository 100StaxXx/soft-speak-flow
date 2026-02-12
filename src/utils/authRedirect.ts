import { supabase } from "@/integrations/supabase/client";
import {
  getOnboardingMentorId,
  getResolvedMentorId,
  isInvalidMentorReferenceError,
  stripOnboardingMentorId,
} from "./mentor";
import { logger } from "./logger";

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
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    return data?.onboarding_completed === true;
  } catch {
    return false;
  }
};

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
export const getAuthRedirectPath = async (userId: string): Promise<string> => {
  const QUERY_TIMEOUT = 5000; // 5 second timeout for each query
  
  try {
    logger.debug('[getAuthRedirectPath] Fetching profile...', { userId: userId.substring(0, 8) });
    
    const { data: profile, error } = await withTimeout(
      () => supabase
        .from("profiles")
        .select("selected_mentor_id, onboarding_completed, onboarding_data")
        .eq("id", userId)
        .maybeSingle(),
      QUERY_TIMEOUT, 
      'Profile fetch'
    );
    
    if (error) {
      logger.warn('[getAuthRedirectPath] Profile fetch error, checking if returning user', { error: error.message });
      const returning = await isReturningUser(userId);
      return returning ? "/tasks" : "/onboarding";
    }

    const resolvedMentorId = getResolvedMentorId(profile);
    const onboardingMentorId = getOnboardingMentorId(profile);
    logger.debug('[getAuthRedirectPath] Profile fetched', { 
      hasProfile: !!profile, 
      onboardingCompleted: profile?.onboarding_completed,
      hasMentor: !!profile?.selected_mentor_id,
      onboardingMentorId: onboardingMentorId?.substring(0, 8),
      resolvedMentorId: resolvedMentorId?.substring(0, 8)
    });

    if (profile?.onboarding_completed && !profile.selected_mentor_id && onboardingMentorId) {
      // Fire and forget - don't block navigation on profile cleanup
      Promise.resolve((async () => {
        const { error: backfillError } = await supabase
          .from("profiles")
          .update({ selected_mentor_id: onboardingMentorId })
          .eq("id", userId);

        if (!backfillError) {
          logger.debug('[getAuthRedirectPath] Mentor ID updated');
          return;
        }

        if (!isInvalidMentorReferenceError(backfillError)) {
          logger.warn('[getAuthRedirectPath] Failed to update mentor ID', { error: backfillError });
          return;
        }

        const sanitizedOnboardingData = stripOnboardingMentorId(profile.onboarding_data);
        const { error: cleanupError } = await supabase
          .from("profiles")
          .update({ onboarding_data: sanitizedOnboardingData })
          .eq("id", userId);

        if (cleanupError) {
          logger.warn('[getAuthRedirectPath] Failed to clear stale onboarding mentor ID', { error: cleanupError });
          return;
        }

        logger.debug('[getAuthRedirectPath] Cleared stale onboarding mentor ID');
      })()).catch((err: Error) =>
        logger.warn('[getAuthRedirectPath] Mentor backfill cleanup failed', { error: err })
      );
    }

    // If onboarding is completed, always go to tasks
    if (profile?.onboarding_completed) {
      logger.debug('[getAuthRedirectPath] Onboarding complete, redirecting to /tasks');
      return "/tasks";
    }

    // No profile or no mentor selected -> onboarding
    if (!profile || !resolvedMentorId) {
      logger.debug('[getAuthRedirectPath] No profile or mentor, redirecting to /onboarding');
      return "/onboarding";
    }

    // Has mentor -> quests page
    logger.debug('[getAuthRedirectPath] Has mentor, redirecting to /tasks');
    return "/tasks";
  } catch (error) {
    logger.error("[getAuthRedirectPath] Error, checking if returning user", { error });
    const returning = await isReturningUser(userId);
    return returning ? "/tasks" : "/onboarding";
  }
};

/**
 * Ensures a profile exists for a user, creating one if needed
 * Also updates timezone to match user's current device
 */
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  const QUERY_TIMEOUT = 3000; // 3 second timeout for each query
  
  logger.debug('[ensureProfile] Starting...', { userId: userId.substring(0, 8), email: email?.substring(0, 5) });
  
  try {
    const { data: existing, error: fetchError } = await withTimeout(
      () => supabase
        .from("profiles")
        .select("id, timezone")
        .eq("id", userId)
        .maybeSingle(),
      QUERY_TIMEOUT, 
      'Profile check'
    );
    
    if (fetchError) {
      logger.warn('[ensureProfile] Fetch error, continuing anyway', { error: fetchError.message });
      return; // Don't block navigation for this
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    logger.debug('[ensureProfile] Profile check result', { exists: !!existing, userTimezone });

    if (!existing) {
      // Create new profile with user's timezone
      logger.debug('[ensureProfile] Creating new profile...');
      const { error } = await withTimeout(
        () => supabase.from("profiles").upsert({
          id: userId,
          email: email ?? null,
          timezone: userTimezone,
        }, {
          onConflict: 'id'
        }),
        QUERY_TIMEOUT, 
        'Profile create'
      );
      
      if (error && !error.message.includes('duplicate')) {
        logger.warn('[ensureProfile] Create error, continuing anyway', { error: error.message });
        // Don't throw - allow navigation to continue
      } else {
        logger.debug('[ensureProfile] Profile created successfully');
      }
    } else if (existing.timezone !== userTimezone) {
      // Update timezone if it's different - fire and forget
      logger.debug('[ensureProfile] Updating timezone...');
      Promise.resolve(
        supabase.from("profiles").update({
          timezone: userTimezone
        }).eq("id", userId)
      )
        .then(() => logger.debug('[ensureProfile] Timezone updated'))
        .catch((err: Error) => logger.warn('[ensureProfile] Timezone update failed', { error: err }));
    } else {
      logger.debug('[ensureProfile] Profile exists, no update needed');
    }
  } catch (error) {
    // Log but don't throw - allow navigation to continue even if profile operations fail
    logger.warn('[ensureProfile] Error (non-blocking)', { error });
  }
};
