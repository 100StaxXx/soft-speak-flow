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
}

export const useProfile = () => {
  const { user } = useAuth();

  const { data: profile, isLoading: loading } = useQuery({
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
        // Auto-create profile on first login if missing
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email ?? null,
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
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
  });

  return { profile: profile ?? null, loading };
};
