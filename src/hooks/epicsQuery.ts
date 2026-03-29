import { supabase } from "@/integrations/supabase/client";

export interface EpicHabitRecord {
  habit_id: string;
  habits: {
    id: string;
    title: string;
    difficulty: string;
    description?: string | null;
    frequency?: string | null;
    estimated_minutes?: number | null;
    custom_days?: number[] | null;
    custom_month_days?: number[] | null;
    preferred_time?: string | null;
    category?: string | null;
  } | null;
}

export interface EpicRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  progress_percentage: number | null;
  target_days: number;
  start_date: string;
  end_date: string;
  epic_habits?: EpicHabitRecord[] | null;
  latest_journey_path_generated_at?: string | null;
  latest_journey_path_milestone_index?: number | null;
  latest_journey_path_url?: string | null;
  [key: string]: unknown;
}

export const EPICS_QUERY_STALE_TIME = 3 * 60 * 1000;

export const getEpicsQueryKey = (userId: string | undefined) =>
  ["epics", userId] as const;

export const fetchEpics = async (userId: string): Promise<EpicRecord[]> => {
  const { data, error } = await supabase
    .from("epics")
    .select(`
      *,
      epic_habits(
        habit_id,
        habits(id, title, difficulty, description, frequency, estimated_minutes, custom_days, custom_month_days, preferred_time, category)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch epics:", error);
    throw error;
  }

  return (data ?? []) as EpicRecord[];
};
