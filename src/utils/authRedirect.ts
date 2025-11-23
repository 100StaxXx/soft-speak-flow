import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized auth redirect logic
 * Determines where to send users based on their auth and profile state
 */
export const getAuthRedirectPath = async (userId: string): Promise<string> => {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_mentor_id")
      .eq("id", userId)
      .maybeSingle();

    // No profile or no mentor selected -> onboarding
    if (!profile || !profile.selected_mentor_id) {
      return "/onboarding";
    }

    // Has mentor -> home
    return "/";
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
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("id", userId)
    .maybeSingle();

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!existing) {
    // Create new profile with user's timezone
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: email ?? null,
      timezone: userTimezone,
    }, {
      onConflict: 'id'
    });
    
    if (error && !error.message.includes('duplicate')) {
      console.error('Error creating profile:', error);
      throw error;
    }
  } else if (existing.timezone !== userTimezone) {
    // Update timezone if it's different
    await supabase.from("profiles").update({
      timezone: userTimezone
    }).eq("id", userId);
  }
};
