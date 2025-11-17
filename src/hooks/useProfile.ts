import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Profile {
  id: string;
  email: string | null;
  is_premium: boolean;
  preferences: any;
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
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
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
            .single();

          if (insertError) {
            console.error("Error creating profile:", insertError);
            setProfile(null);
          } else {
            setProfile(inserted);
          }
        } else {
          setProfile(data);
        }
      } catch (error) {
        console.error("Error fetching/creating profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  return { profile, loading };
};
