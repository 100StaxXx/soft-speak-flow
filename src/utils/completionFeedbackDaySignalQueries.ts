import { supabase } from "@/integrations/supabase/client";
import {
  getCompletionFeedbackLocalDayBounds,
  mergeCompletionFeedbackDaySignalTasks,
  type CompletionFeedbackDaySignalTask,
} from "@/utils/completionFeedbackDaySignals";

interface FetchCompletionFeedbackDaySignalTasksOptions {
  userId: string;
  taskDate: string;
  normalizeTaskId?: (taskId: string) => string;
}

interface CompletionFeedbackDaySignalTaskRow {
  id: string;
  completed: boolean | null;
  completed_at: string | null;
}

export const fetchCompletionFeedbackDaySignalTasks = async ({
  userId,
  taskDate,
  normalizeTaskId,
}: FetchCompletionFeedbackDaySignalTasksOptions): Promise<CompletionFeedbackDaySignalTask[]> => {
  const { start, end } = getCompletionFeedbackLocalDayBounds(taskDate);
  const [plannedTodayResult, completedTodayResult] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("id, completed, completed_at")
      .eq("user_id", userId)
      .eq("task_date", taskDate),
    supabase
      .from("daily_tasks")
      .select("id, completed, completed_at")
      .eq("user_id", userId)
      .gte("completed_at", start.toISOString())
      .lt("completed_at", end.toISOString()),
  ]);

  if (plannedTodayResult.error) throw plannedTodayResult.error;
  if (completedTodayResult.error) throw completedTodayResult.error;

  return mergeCompletionFeedbackDaySignalTasks(
    [
      ...((plannedTodayResult.data ?? []) as CompletionFeedbackDaySignalTaskRow[]),
      ...((completedTodayResult.data ?? []) as CompletionFeedbackDaySignalTaskRow[]),
    ],
    normalizeTaskId,
  );
};
