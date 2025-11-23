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
 */
export const ensureProfile = async (userId: string, email: string | null): Promise<void> => {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    // Detect user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    // Use upsert to handle race conditions
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: email ?? null,
      timezone: timezone,
      // Store legal acceptance from localStorage if present
      legal_accepted_at: localStorage.getItem('legal_accepted_at'),
      legal_accepted_version: localStorage.getItem('legal_accepted_version'),
    }, {
      onConflict: 'id'
    });
    
    if (error && !error.message.includes('duplicate')) {
      console.error('Error creating profile:', error);
      throw error;
    }
  }
};
