import { getProfile, createProfile, updateProfile } from "@/lib/firebase/profiles";
import { getResolvedMentorId } from "./mentor";

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
export const getAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    const profile = await getProfile(userId);

    const resolvedMentorId = getResolvedMentorId(profile);

    if (profile?.onboarding_completed && !profile.selected_mentor_id && resolvedMentorId) {
      await updateProfile(userId, { selected_mentor_id: resolvedMentorId });
    }

    // If onboarding is completed, always go to tasks
    if (profile?.onboarding_completed) {
      return "/tasks";
    }

    // No profile or no mentor selected -> onboarding
    if (!profile || !resolvedMentorId) {
      return "/onboarding";
    }

    // Has mentor -> quests page
    return "/tasks";
  } catch (error) {
    console.error("Error checking profile:", error);
    return "/onboarding";
  }
};

/**
 * Ensures a profile exists for a user, creating one if needed
 * Also updates timezone to match user's current device
 */
export const ensureProfile = async (userId: string, email: string | null, metadata?: { timezone?: string }): Promise<void> => {
  try {
    const existing = await getProfile(userId);
    const userTimezone = metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!existing) {
      // Profile doesn't exist, create it
      console.log(`[ensureProfile] Creating new profile for user ${userId}`);
      try {
        await createProfile(userId, email, {
          timezone: userTimezone,
          is_premium: false,
          preferences: null,
          selected_mentor_id: null,
          onboarding_completed: false,
          onboarding_data: {},
        });
        console.log(`[ensureProfile] Profile created successfully for user ${userId}`);
      } catch (createError: any) {
        // Ignore duplicate errors (race condition)
        if (createError.code === 'already-exists' || createError.message?.includes('already exists')) {
          console.log(`[ensureProfile] Profile already exists (race condition) for user ${userId}`);
        } else {
          console.error('[ensureProfile] Error creating profile:', createError);
          throw createError;
        }
      }
    } else {
      console.log(`[ensureProfile] Profile already exists for user ${userId}`);
      // Update timezone if it's different
      if (existing.timezone !== userTimezone) {
        await updateProfile(userId, { timezone: userTimezone });
      }
    }
  } catch (error) {
    console.error('[ensureProfile] Unexpected error:', error);
    throw error;
  }
};
