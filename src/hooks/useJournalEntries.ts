import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  toJournalEntryFromDailyCheckIn,
  toJournalEntryFromEveningReflection,
  toJournalEntryFromReflection,
} from "@/shared/journalEntryAdapters";
import type { JournalEntryType } from "@/types/domain";

interface UseJournalEntriesOptions {
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
  entryTypes?: JournalEntryType[];
  checkInType?: string;
}

export const JOURNAL_ENTRIES_QUERY_KEY = ["journal-entries"] as const;

export const useJournalEntries = (options: UseJournalEntriesOptions = {}) => {
  const { user } = useAuth();
  const {
    enabled = true,
    startDate,
    endDate,
    limit,
    entryTypes,
    checkInType,
  } = options;
  const normalizedEntryTypes = [...new Set(entryTypes ?? [
    "reflection",
    "evening_reflection",
    "daily_check_in",
  ])].sort();
  const includeReflections = normalizedEntryTypes.includes("reflection");
  const includeEveningReflections = normalizedEntryTypes.includes("evening_reflection");
  const includeDailyCheckIns = normalizedEntryTypes.includes("daily_check_in");

  const query = useQuery({
    queryKey: [
      ...JOURNAL_ENTRIES_QUERY_KEY,
      user?.id,
      startDate ?? "all",
      endDate ?? "all",
      limit ?? "all",
      normalizedEntryTypes.join(","),
      checkInType ?? "all",
    ],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      let reflectionsQuery = includeReflections
        ? supabase
          .from("user_reflections")
          .select("*")
          .eq("user_id", user.id)
        : null;
      let eveningReflectionsQuery = includeEveningReflections
        ? supabase
          .from("evening_reflections")
          .select("*")
          .eq("user_id", user.id)
        : null;
      let dailyCheckInsQuery = includeDailyCheckIns
        ? supabase
          .from("daily_check_ins")
          .select("*")
          .eq("user_id", user.id)
        : null;

      if (startDate) {
        reflectionsQuery = reflectionsQuery?.gte("reflection_date", startDate) ?? null;
        eveningReflectionsQuery = eveningReflectionsQuery?.gte("reflection_date", startDate) ?? null;
        dailyCheckInsQuery = dailyCheckInsQuery?.gte("check_in_date", startDate) ?? null;
      }

      if (endDate) {
        reflectionsQuery = reflectionsQuery?.lte("reflection_date", endDate) ?? null;
        eveningReflectionsQuery = eveningReflectionsQuery?.lte("reflection_date", endDate) ?? null;
        dailyCheckInsQuery = dailyCheckInsQuery?.lte("check_in_date", endDate) ?? null;
      }

      if (checkInType && dailyCheckInsQuery) {
        dailyCheckInsQuery = dailyCheckInsQuery.eq("check_in_type", checkInType);
      }

      const [
        reflectionsResult,
        eveningReflectionsResult,
        dailyCheckInsResult,
      ] = await Promise.all([
        reflectionsQuery
          ? reflectionsQuery.order("reflection_date", { ascending: false }).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        eveningReflectionsQuery
          ? eveningReflectionsQuery.order("reflection_date", { ascending: false }).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        dailyCheckInsQuery
          ? dailyCheckInsQuery.order("check_in_date", { ascending: false }).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
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
