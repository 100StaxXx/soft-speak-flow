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
}

export const useProfile = () => {
  const { user } = useAuth();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Create a timeout promise to prevent infinite loading
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn('Profile fetch timed out after 5s');
          resolve(null);
        }, 5000);
      });

      try {
        // Race the actual query against the timeout
        const result = await Promise.race([
          (async () => {
            const { data, error } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .maybeSingle();

            if (error) {
              console.warn("Error fetching profile:", error);
              return null;
            }

            if (!data) {
              // Auto-create profile on first login if missing
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
                console.warn("Error creating profile:", insertError);
                return null;
              }
              
              return inserted;
            }

            return data;
          })(),
          timeoutPromise
        ]);

        return result;
      } catch (err) {
        console.warn('Profile fetch failed:', err);
        return null;
      }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry failed profile fetches to avoid blocking
  });

  return { profile: profile ?? null, loading };
};
