import { supabase } from "@/integrations/supabase/client";
import { getResolvedMentorId } from "./mentor";

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
export const getAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("selected_mentor_id, onboarding_completed, onboarding_data")
      .eq("id", userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const resolvedMentorId = getResolvedMentorId(profile);

    if (profile?.onboarding_completed && !profile.selected_mentor_id && resolvedMentorId) {
      await supabase
        .from("profiles")
        .update({ selected_mentor_id: resolvedMentorId })
        .eq("id", userId);
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
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("id, timezone")
      .eq("id", userId)
      .single();

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (fetchError && fetchError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log(`[ensureProfile] Creating new profile for user ${userId}`);
      const { error: createError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: email ?? null,
          timezone: userTimezone,
          is_premium: false,
          preferences: null,
          selected_mentor_id: null,
          onboarding_completed: false,
          onboarding_data: {},
        });

      if (createError) {
        // Ignore duplicate errors (race condition)
        if (createError.code !== '23505') { // 23505 = unique violation
          console.error('[ensureProfile] Error creating profile:', createError);
          throw createError;
        } else {
          console.log(`[ensureProfile] Profile already exists (race condition) for user ${userId}`);
        }
      } else {
        console.log(`[ensureProfile] Profile created successfully for user ${userId}`);
      }
    } else if (existing) {
      console.log(`[ensureProfile] Profile already exists for user ${userId}`);
      if (existing.timezone !== userTimezone) {
        // Update timezone if it's different
        await supabase
          .from("profiles")
          .update({ timezone: userTimezone })
          .eq("id", userId);
      }
    } else if (fetchError) {
      throw fetchError;
    }
  } catch (error) {
    console.error('[ensureProfile] Unexpected error:', error);
    throw error;
  }
};
