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
 * Uses upsert to handle race conditions gracefully
 */
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  const timezone = detectTimezone();
  
  // Use upsert to handle race conditions (handles both insert and update)
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    email: email ?? null,
    timezone: timezone,
  }, {
    onConflict: 'id',
    // Don't overwrite existing email if it's already set
    ignoreDuplicates: false,
  });
  
  // Only throw on real errors (ignore duplicate key conflicts)
  if (error && !error.message.includes('duplicate')) {
    console.error('Error ensuring profile:', error);
    throw error;
  }
};
