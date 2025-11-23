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
    await supabase.from("profiles").insert({
      id: userId,
      email: email ?? null,
      timezone: userTimezone,
    });
  } else if (existing.timezone !== userTimezone) {
    await supabase.from("profiles").update({
      timezone: userTimezone
    }).eq("id", userId);
  }
};
