import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePendingMentorMood } from "./usePendingMentorMood";
import { queryKeys } from "@/lib/queryKeys";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export interface CompanionMoodSignalState {
  pendingMood: string | null;
  todayMood: string | null;
  latestMood: string | null;
  moodSignal: string | null;
  source: "pending" | "today" | "latest" | "none";
}

export const useCompanionMoodSignal = (now: Date = new Date()): CompanionMoodSignalState => {
  const { user } = useAuth();
  const pendingMood = usePendingMentorMood();
  const today = useMemo(() => formatLocalDate(now), [now]);

  const { data: todayCheckIn } = useQuery({
    queryKey: queryKeys.checkIns.morningByDate(today, user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_check_ins")
        .select("mood")
        .eq("user_id", user.id)
        .eq("check_in_type", "morning")
        .eq("check_in_date", today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: latestCheckIn } = useQuery({
    queryKey: queryKeys.checkIns.morningLatest(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("daily_check_ins")
        .select("mood")
        .eq("user_id", user.id)
        .eq("check_in_type", "morning")
        .order("check_in_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (pendingMood) {
    return {
      pendingMood,
      todayMood: todayCheckIn?.mood ?? null,
      latestMood: latestCheckIn?.mood ?? null,
      moodSignal: pendingMood,
      source: "pending",
    };
  }

  if (todayCheckIn?.mood) {
    return {
      pendingMood,
      todayMood: todayCheckIn.mood,
      latestMood: latestCheckIn?.mood ?? null,
      moodSignal: todayCheckIn.mood,
      source: "today",
    };
  }

  if (latestCheckIn?.mood) {
    return {
      pendingMood,
      todayMood: todayCheckIn?.mood ?? null,
      latestMood: latestCheckIn.mood,
      moodSignal: latestCheckIn.mood,
      source: "latest",
    };
  }

  return {
    pendingMood,
    todayMood: todayCheckIn?.mood ?? null,
    latestMood: latestCheckIn?.mood ?? null,
    moodSignal: null,
    source: "none",
  };
};
