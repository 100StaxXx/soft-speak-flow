import { getDocuments, getDocument, setDocument, updateDocument, deleteDocument, timestampToISO } from "./firestore";

export interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  difficulty: "easy" | "medium" | "hard";
  xp_reward: number;
  task_date: string;
  completed?: boolean;
  completed_at?: string;
  is_main_quest?: boolean;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  more_information?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const getDailyTasks = async (
  userId: string,
  taskDate: string
): Promise<DailyTask[]> => {
  const tasks = await getDocuments<DailyTask>(
    "daily_tasks",
    [
      ["user_id", "==", userId],
      ["task_date", "==", taskDate],
    ],
    "scheduled_time",
    "asc"
  );

  return tasks.map((task) => ({
    ...task,
    completed_at: timestampToISO(task.completed_at as any) || task.completed_at || undefined,
    created_at: timestampToISO(task.created_at as any) || task.created_at || undefined,
    updated_at: timestampToISO(task.updated_at as any) || task.updated_at || undefined,
  }));
};

export const getDailyTask = async (taskId: string): Promise<DailyTask | null> => {
  return await getDocument<DailyTask>("daily_tasks", taskId);
};

export const createDailyTask = async (task: Omit<DailyTask, "id" | "created_at" | "updated_at">): Promise<DailyTask> => {
  const taskId = `${task.user_id}_${task.task_date}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  await setDocument("daily_tasks", taskId, {
    ...task,
    created_at: now,
    updated_at: now,
  }, false);

  return {
    ...task,
    id: taskId,
    created_at: now,
    updated_at: now,
  };
};

export const updateDailyTask = async (taskId: string, updates: Partial<DailyTask>): Promise<void> => {
  await updateDocument("daily_tasks", taskId, updates);
};

export const deleteDailyTask = async (taskId: string): Promise<void> => {
  await deleteDocument("daily_tasks", taskId);
};

