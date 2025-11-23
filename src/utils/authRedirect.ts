import { supabase } from "@/integrations/supabase/client";
import { detectTimezone } from "./timezone";

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
 * Automatically detects and stores the user's timezone
 */
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    // Profile doesn't exist, create it with timezone
    const timezone = detectTimezone();
    
    await supabase.from("profiles").insert({
      id: userId,
      email: email ?? null,
      timezone: timezone,
    });
  } else if (!existing.timezone) {
    // Profile exists but timezone not set, update it
    const timezone = detectTimezone();
    
    await supabase.from("profiles").update({
      timezone: timezone,
    }).eq("id", userId);
  }
};
