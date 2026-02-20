import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import type { TaskAttachment } from "@/types/questAttachments";

export interface DailySubtask {
  id: string;
  title: string;
  completed: boolean | null;
  sort_order: number | null;
}

export interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  difficulty: string | null;
  xp_reward: number;
  task_date: string;
  completed: boolean | null;
  completed_at: string | null;
  is_main_quest: boolean | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  is_recurring: boolean | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  reminder_sent: boolean | null;
  parent_template_id: string | null;
  category: string | null;
  is_bonus: boolean | null;
  created_at: string | null;
  // Enhanced task features
  priority: string | null;
  energy_level: string | null;
  is_top_three: boolean | null;
  actual_time_spent: number | null;
  ai_generated: boolean | null;
  context_id: string | null;
  source: string | null;
  // Habit integration
  habit_source_id: string | null;
  // Epic/Campaign integration
  epic_id: string | null;
  epic_title?: string | null;
  // Sort order for drag reordering
  sort_order?: number | null;
  // Contact integration
  contact_id: string | null;
  auto_log_interaction: boolean | null;
  contact?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  // Photo attachment
  image_url: string | null;
  attachments?: TaskAttachment[];
  // Additional metadata
  notes: string | null;
  location: string | null;
  subtasks?: DailySubtask[];
}

export const DAILY_TASKS_STALE_TIME = 2 * 60 * 1000;
export const DAILY_TASKS_GC_TIME = 30 * 60 * 1000;
const NETWORK_TASK_FETCH_ERROR_MESSAGE = 'Network error. Please check your connection and try again.';
const DAILY_TASKS_SELECT_WITH_ATTACHMENTS = `
  *,
  epics(title),
  contact:contacts!contact_id(id, name, avatar_url),
  subtasks(id, title, completed, sort_order),
  task_attachments(id, task_id, file_url, file_path, file_name, mime_type, file_size_bytes, is_image, sort_order, created_at)
`;
const DAILY_TASKS_SELECT_WITHOUT_ATTACHMENTS = `
  *,
  epics(title),
  contact:contacts!contact_id(id, name, avatar_url),
  subtasks(id, title, completed, sort_order)
`;

export const getDailyTasksQueryKey = (userId: string | undefined, taskDate: string) =>
  ['daily-tasks', userId, taskDate] as const;

export const fetchDailyTasks = async (userId: string, taskDate: string): Promise<DailyTask[]> => {
  const fetchWithSelect = (selectClause: string) =>
    supabase
      .from('daily_tasks')
      .select(selectClause)
      .eq('user_id', userId)
      .eq('task_date', taskDate)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

  let { data, error } = await fetchWithSelect(DAILY_TASKS_SELECT_WITH_ATTACHMENTS);

  if (isTaskAttachmentsRelationError(error)) {
    console.warn('daily_tasks query could not embed task_attachments, retrying without attachments relation');
    ({ data, error } = await fetchWithSelect(DAILY_TASKS_SELECT_WITHOUT_ATTACHMENTS));
  }

  if (error) {
    if (isNetworkFetchFailure(error)) {
      console.warn('Failed to fetch daily tasks (network):', {
        message: error.message,
      });
      throw new Error(NETWORK_TASK_FETCH_ERROR_MESSAGE);
    }

    console.error('Failed to fetch daily tasks:', error);
    throw error;
  }

  // Flatten epic title/contact and normalize subtasks.
  return (data || []).map(task => ({
    ...task,
    epic_title: (task.epics as { title: string } | null)?.title || null,
    contact: task.contact as { id: string; name: string; avatar_url: string | null } | null,
    subtasks: ((task.subtasks as DailySubtask[] | null) ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)),
    attachments: (((task.task_attachments as Array<{
      id: string;
      task_id: string;
      file_url: string;
      file_path: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
      is_image: boolean;
      sort_order: number | null;
      created_at: string;
    }> | null) ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER))
      .map((attachment) => ({
        id: attachment.id,
        taskId: attachment.task_id,
        fileUrl: attachment.file_url,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        fileSizeBytes: attachment.file_size_bytes,
        isImage: attachment.is_image,
        sortOrder: attachment.sort_order ?? undefined,
        createdAt: attachment.created_at,
      }))),
  })) as DailyTask[];
};

interface TasksQueryOptions {
  enabled?: boolean;
}

export const useTasksQuery = (selectedDate?: Date, options: TasksQueryOptions = {}) => {
  const { user } = useAuth();
  const { enabled = true } = options;
  
  // Using local device date for task queries
  const taskDate = selectedDate 
    ? format(selectedDate, 'yyyy-MM-dd') 
    : format(new Date(), 'yyyy-MM-dd');

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: getDailyTasksQueryKey(user?.id, taskDate),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      return fetchDailyTasks(user.id, taskDate);
    },
    enabled: enabled && !!user?.id,
    staleTime: DAILY_TASKS_STALE_TIME,
    gcTime: DAILY_TASKS_GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    isLoading,
    error,
    taskDate,
    completedCount,
    totalCount,
  };
};

function isNetworkFetchFailure(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('load failed')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('typeerror: failed to fetch');
}

function isTaskAttachmentsRelationError(
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
): boolean {
  if (!error) return false;

  const code = (error.code ?? '').toUpperCase();
  const haystack = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();

  return haystack.includes('task_attachments')
    && (
      code.startsWith('PGRST')
      || haystack.includes('relationship')
      || haystack.includes('embed')
      || haystack.includes('could not find')
    );
}
