import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

import { ProfilePreferences } from "@/types/profile";

interface Profile {
  id: string;
  email: string | null;
  is_premium: boolean;
  preferences: ProfilePreferences | null;
  selected_mentor_id: string | null;
  created_at: string;
  updated_at: string;
  daily_push_enabled: boolean | null;
  daily_push_window: string | null;
  daily_push_time: string | null;
  daily_quote_push_enabled: boolean | null;
  daily_quote_push_window: string | null;
  daily_quote_push_time: string | null;
  timezone: string | null;
  current_habit_streak: number | null;
  longest_habit_streak: number | null;
  onboarding_completed: boolean | null;
  onboarding_data: Record<string, unknown> | null;
  // Trial & subscription fields
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  // Astrology fields
  zodiac_sign: string | null;
  birthdate: string | null;
  birth_time: string | null;
  birth_location: string | null;
  moon_sign: string | null;
  rising_sign: string | null;
  mercury_sign: string | null;
  mars_sign: string | null;
  venus_sign: string | null;
  cosmic_profile_generated_at: string | null;
  // Faction
  faction: string | null;
  // Global notification settings
  habit_reminders_enabled: boolean | null;
  task_reminders_enabled: boolean | null;
  // Quest behavior settings
  completed_tasks_stay_in_place: boolean | null;
}

export const useProfile = () => {
  const { user } = useAuth();

  const { data: profile, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        throw error;
      }

      if (!data) {
        // Auto-create profile on first login if missing (upsert prevents race conditions)
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email ?? null,
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select("*")
          .maybeSingle();

        if (insertError) {
          console.error("Error creating profile:", insertError);
          throw insertError;
        }
        
        if (!inserted) throw new Error("Failed to create profile");
        
        return inserted;
      }

      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - balance between performance and freshness
    refetchOnWindowFocus: false, // Prevent unnecessary refetches on tab switch
  });

  return { profile: profile ?? null, loading, error, refetch };
};
