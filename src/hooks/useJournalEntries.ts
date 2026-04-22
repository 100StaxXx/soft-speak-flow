import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  toJournalEntryFromDailyCheckIn,
  toJournalEntryFromEveningReflection,
  toJournalEntryFromReflection,
} from "@/shared/journalEntryAdapters";

interface UseJournalEntriesOptions {
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const useJournalEntries = (options: UseJournalEntriesOptions = {}) => {
  const { user } = useAuth();
  const {
    enabled = true,
    startDate,
    endDate,
    limit,
  } = options;

  const query = useQuery({
    queryKey: ["journal-entries", user?.id, startDate ?? "all", endDate ?? "all", limit ?? "all"],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      let reflectionsQuery = supabase
        .from("user_reflections")
        .select("*")
        .eq("user_id", user.id);
      let eveningReflectionsQuery = supabase
        .from("evening_reflections")
        .select("*")
        .eq("user_id", user.id);
      let dailyCheckInsQuery = supabase
        .from("daily_check_ins")
        .select("*")
        .eq("user_id", user.id);

      if (startDate) {
        reflectionsQuery = reflectionsQuery.gte("reflection_date", startDate);
        eveningReflectionsQuery = eveningReflectionsQuery.gte("reflection_date", startDate);
        dailyCheckInsQuery = dailyCheckInsQuery.gte("check_in_date", startDate);
      }

      if (endDate) {
        reflectionsQuery = reflectionsQuery.lte("reflection_date", endDate);
        eveningReflectionsQuery = eveningReflectionsQuery.lte("reflection_date", endDate);
        dailyCheckInsQuery = dailyCheckInsQuery.lte("check_in_date", endDate);
      }

      const [
        reflectionsResult,
        eveningReflectionsResult,
        dailyCheckInsResult,
      ] = await Promise.all([
        reflectionsQuery.order("reflection_date", { ascending: false }).order("created_at", { ascending: false }),
        eveningReflectionsQuery.order("reflection_date", { ascending: false }).order("created_at", { ascending: false }),
        dailyCheckInsQuery.order("check_in_date", { ascending: false }).order("created_at", { ascending: false }),
      ]);

      if (reflectionsResult.error) throw reflectionsResult.error;
      if (eveningReflectionsResult.error) throw eveningReflectionsResult.error;
      if (dailyCheckInsResult.error) throw dailyCheckInsResult.error;

      const entries = [
        ...(reflectionsResult.data ?? []).map(toJournalEntryFromReflection),
        ...(eveningReflectionsResult.data ?? []).map(toJournalEntryFromEveningReflection),
        ...(dailyCheckInsResult.data ?? []).map(toJournalEntryFromDailyCheckIn),
      ].sort((left, right) => (
        right.date.localeCompare(left.date)
        || (right.createdAt ?? "").localeCompare(left.createdAt ?? "")
        || right.id.localeCompare(left.id)
      ));

      return typeof limit === "number" ? entries.slice(0, limit) : entries;
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
};
