import { getProfile, createProfile, updateProfile } from "@/lib/firebase/profiles";
import { getResolvedMentorId } from "./mentor";

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 * @param profile - Optional profile to avoid duplicate reads
 */
export const getAuthRedirectPath = async (userId: string, profile?: any): Promise<string> => {
  try {
    // Only fetch profile if not provided (optimization to avoid duplicate reads)
    const userProfile = profile || await getProfile(userId);

    const resolvedMentorId = getResolvedMentorId(userProfile);

    if (userProfile?.onboarding_completed && !userProfile.selected_mentor_id && resolvedMentorId) {
      // Don't await - update in background to avoid blocking navigation
      updateProfile(userId, { selected_mentor_id: resolvedMentorId }).catch(err => {
        console.error("Error updating mentor ID:", err);
      });
    }

    // If onboarding is completed, always go to tasks
    if (userProfile?.onboarding_completed) {
      return "/tasks";
    }

    // No profile or no mentor selected -> onboarding
    if (!userProfile || !resolvedMentorId) {
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
 * @returns The profile (existing or newly created) to avoid duplicate reads
 */
export const ensureProfile = async (userId: string, email: string | null, metadata?: { timezone?: string }): Promise<any> => {
  try {
    const existing = await getProfile(userId);
    const userTimezone = metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!existing) {
      // Profile doesn't exist, create it
      console.log(`[ensureProfile] Creating new profile for user ${userId}`);
      try {
        const newProfile = await createProfile(userId, email, {
          timezone: userTimezone,
          is_premium: false,
          preferences: null,
          selected_mentor_id: null,
          onboarding_completed: false,
          onboarding_data: {},
        });
        console.log(`[ensureProfile] Profile created successfully for user ${userId}`);
        return newProfile;
      } catch (createError: any) {
        // Ignore duplicate errors (race condition) - try to fetch existing profile
        if (createError.code === 'already-exists' || createError.message?.includes('already exists')) {
          console.log(`[ensureProfile] Profile already exists (race condition) for user ${userId}`);
          // Fetch the profile that was created by the race condition
          const raceProfile = await getProfile(userId);
          if (raceProfile) return raceProfile;
        }
        console.error('[ensureProfile] Error creating profile:', createError);
        throw createError;
      }
    } else {
      console.log(`[ensureProfile] Profile already exists for user ${userId}`);
      // Update timezone if it's different (don't await to avoid blocking)
      if (existing.timezone !== userTimezone) {
        updateProfile(userId, { timezone: userTimezone }).catch(err => {
          console.error("Error updating timezone:", err);
        });
      }
      return existing;
    }
  } catch (error) {
    console.error('[ensureProfile] Unexpected error:', error);
    throw error;
  }
};
