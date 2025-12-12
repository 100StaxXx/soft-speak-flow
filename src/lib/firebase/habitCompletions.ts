import { getDocuments, timestampToISO } from "./firestore";

export interface HabitCompletion {
  id?: string;
  user_id: string;
  habit_id: string;
  date: string;
  completed_at?: string;
  created_at?: string;
}

export const getHabitCompletions = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<HabitCompletion[]> => {
  const filters: Array<[string, any, any]> = [["user_id", "==", userId]];
  
  if (startDate) {
    filters.push(["date", ">=", startDate]);
  }
  if (endDate) {
    filters.push(["date", "<=", endDate]);
  }

  const completions = await getDocuments<HabitCompletion>(
    "habit_completions",
    filters,
    "date",
    "asc"
  );

  return completions.map((completion) => ({
    ...completion,
    completed_at: timestampToISO(completion.completed_at as any) || completion.completed_at || undefined,
    created_at: timestampToISO(completion.created_at as any) || completion.created_at || undefined,
  }));
};

