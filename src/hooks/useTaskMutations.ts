import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPToast } from "@/contexts/XPContext";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useSchedulingLearner } from "@/hooks/useSchedulingLearner";
import { useRef, createElement } from "react";
import { getEffectiveQuestXP, MAIN_QUEST_XP_MULTIPLIER } from "@/config/xpRewards";
import { calculateGuildBonus } from "@/utils/guildBonus";
import { format } from "date-fns";
import { TimeoutError, pollWithDeadline, withTimeout } from "@/utils/asyncTimeout";
import {
  normalizeTaskSchedulingState,
  normalizeTaskSchedulingUpdate,
} from "@/utils/taskSchedulingRules";
import {
  hasRecurrencePattern,
  recurrenceRequiresScheduledTime,
  RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR,
  RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE,
} from "@/utils/recurrenceValidation";
import type { QuestAttachmentInput } from "@/types/questAttachments";
import { useResilience } from "@/contexts/ResilienceContext";
import { isQueueableWriteError } from "@/utils/networkErrors";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { trackResilienceEvent } from "@/utils/resilienceTelemetry";
import type { ResilienceState } from "@/types/resilience";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import {
  createOfflinePlannerId,
  getLocalHabitCompletionsForDate,
  getLocalSubtasksForTask,
  getPlannerRecord,
  getLocalTasksByDate,
  removePlannerRecord,
  removePlannerRecords,
  upsertPlannerRecord,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";

type TaskCategory = 'mind' | 'body' | 'soul';
const validCategories: TaskCategory[] = ['mind', 'body', 'soul'];

const categoryKeywords: Record<TaskCategory, string[]> = {
  body: ['gym', 'run', 'exercise', 'workout', 'walk', 'yoga', 'stretch', 'fitness', 'sports'],
  soul: ['meditate', 'journal', 'breathe', 'gratitude', 'reflect', 'pray', 'mindful', 'relax', 'rest'],
  mind: ['read', 'learn', 'study', 'plan', 'organize', 'think', 'write', 'research', 'course']
};

function detectCategory(taskText: string, providedCategory?: string): TaskCategory | null {
  if (providedCategory && validCategories.includes(providedCategory as TaskCategory)) {
    return providedCategory as TaskCategory;
  }
  
  const text = taskText.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return cat as TaskCategory;
    }
  }
  return null;
}

export interface AddTaskParams {
  taskText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  taskDate?: string | null;
  isMainQuest?: boolean;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  recurrencePattern?: string | null;
  recurrenceDays?: number[] | null;
  recurrenceMonthDays?: number[] | null;
  recurrenceCustomPeriod?: "week" | "month" | null;
  recurrenceEndDate?: string | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  category?: string;
  notes?: string | null;
  contactId?: string | null;
  autoLogInteraction?: boolean;
  imageUrl?: string | null;
  attachments?: QuestAttachmentInput[];
  location?: string | null;
  subtasks?: string[];
}

interface TaskAttachmentPersistResult {
  attachmentsSkippedDueToSchema: boolean;
}

type TaskCreateQueueReason = "offline" | "outage_retry" | "network_timeout" | "network_error";

type TaskCreateMutationResult = Partial<DailyTask> & {
  attachmentsSkippedDueToSchema: boolean;
  queued?: boolean;
  queueReason?: TaskCreateQueueReason;
  syncPending?: boolean;
};

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const firstImageFromAttachments = (attachments?: QuestAttachmentInput[]): string | null => {
  if (!attachments || attachments.length === 0) return null;
  return attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null;
};

interface ToggleTaskVariables {
  taskId: string;
  completed: boolean;
  xpReward: number;
  forceUndo?: boolean;
}

interface TaskUpdateInput {
  task_text?: string;
  task_date?: string | null;
  difficulty?: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[];
  recurrence_month_days?: number[];
  recurrence_custom_period?: "week" | "month" | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  category?: string | null;
  notes?: string | null;
  image_url?: string | null;
  location?: string | null;
  attachments?: QuestAttachmentInput[];
}

interface TaskUpdateVariables {
  taskId: string;
  updates: TaskUpdateInput;
}

type RecurrenceCustomPeriod = "week" | "month";

interface RecurrenceWriteInput {
  recurrencePattern?: string | null;
  recurrenceDays?: number[] | null;
  recurrenceMonthDays?: number[] | null;
  recurrenceCustomPeriod?: RecurrenceCustomPeriod | null;
  recurrenceEndDate?: string | null;
}

interface RecurrenceWriteResult {
  fields: Record<string, unknown>;
  hasRecurrence: boolean;
  isMonthBased: boolean;
}

const MONTHLY_RECURRENCE_SCHEMA_MESSAGE = "Monthly recurrence is temporarily unavailable until backend update completes.";
const CREATE_TASK_REMOTE_TIMEOUT_MS = 3_000;
const CREATE_TASK_EXISTENCE_CHECK_MS = 1_500;
const CREATE_TASK_EXISTENCE_CHECK_INTERVAL_MS = 150;

const buildQueuedTogglePayload = (variables: ToggleTaskVariables) => ({
  taskId: variables.taskId,
  completed: variables.completed,
  completedAt: variables.completed ? new Date().toISOString() : null,
  forceUndo: variables.forceUndo ?? false,
});

const buildQueuedTaskUpdatePayload = (taskId: string, updates: Record<string, unknown>) => {
  const queueableUpdates = { ...updates };

  if ("attachments" in queueableUpdates) {
    const attachments = queueableUpdates.attachments as QuestAttachmentInput[] | undefined;
    queueableUpdates.image_url = firstImageFromAttachments(attachments) ?? queueableUpdates.image_url ?? null;
    delete queueableUpdates.attachments;
  }

  return {
    taskId,
    updates: queueableUpdates,
  };
};

export function isTaskAttachmentsTableMissingError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? '').toUpperCase();
  const haystack = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  const mentionsTaskAttachments = haystack.includes('task_attachments');

  if (code === '42P01' && mentionsTaskAttachments) return true;

  return mentionsTaskAttachments
    && (
      code.startsWith('PGRST')
      || haystack.includes('schema cache')
      || haystack.includes('does not exist')
      || haystack.includes('could not find the table')
      || haystack.includes('relation')
    );
}

function isDailyTasksRecurrenceColumnsMissingError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;

  const code = (error.code ?? '').toUpperCase();
  const haystack = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  const mentionsRecurrenceColumns = haystack.includes('recurrence_custom_period') || haystack.includes('recurrence_month_days');

  if (code === '42703' && mentionsRecurrenceColumns) return true;

  return mentionsRecurrenceColumns
    && (
      code.startsWith('PGRST')
      || haystack.includes('schema cache')
      || haystack.includes('does not exist')
      || haystack.includes('could not find the')
      || haystack.includes('column')
    );
}

function normalizeRecurrencePattern(pattern: string | null | undefined): string | null {
  if (!pattern) return null;
  const trimmedPattern = pattern.trim();
  return trimmedPattern.length > 0 ? trimmedPattern : null;
}

function buildRecurrenceRequiresScheduledTimeError(): Error {
  return new Error(RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR);
}

function isNavigatorOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function resolveTaskCreateQueueReason(
  resilienceState: ResilienceState,
  error?: unknown,
): TaskCreateQueueReason {
  if (isNavigatorOffline()) return "offline";
  if (resilienceState === "outage") return "outage_retry";
  if (error instanceof TimeoutError) return "network_timeout";
  return "network_error";
}

function getQueuedTaskCreateToastMessage(queueReason?: TaskCreateQueueReason): {
  title: string;
  description?: string;
} {
  if (queueReason === "offline") {
    return {
      title: "Quest saved offline",
      description: "We'll sync it when you're back online.",
    };
  }

  return {
    title: "Quest saved locally. Server sync will retry automatically.",
  };
}

function getTaskMutationErrorMessage(error: Error): string {
  if (error.message === RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR) {
    return RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE;
  }

  return error.message;
}

function isMonthBasedRecurrencePayload(payload: Record<string, unknown>): boolean {
  const recurrencePattern = typeof payload.recurrence_pattern === 'string'
    ? payload.recurrence_pattern.toLowerCase()
    : null;
  const recurrenceCustomPeriod = typeof payload.recurrence_custom_period === 'string'
    ? payload.recurrence_custom_period.toLowerCase()
    : null;
  const recurrenceMonthDays = Array.isArray(payload.recurrence_month_days) ? payload.recurrence_month_days : [];

  return recurrencePattern === 'monthly'
    || (recurrencePattern === 'custom' && (recurrenceCustomPeriod === 'month' || recurrenceMonthDays.length > 0));
}

function stripUnsupportedRecurrenceColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const nextPayload = { ...payload };
  delete nextPayload.recurrence_month_days;
  delete nextPayload.recurrence_custom_period;
  return nextPayload;
}

function buildRecurrenceWriteFields(input: RecurrenceWriteInput): RecurrenceWriteResult {
  const recurrencePattern = normalizeRecurrencePattern(input.recurrencePattern);
  const recurrenceCustomPeriod = recurrencePattern === 'custom'
    ? (input.recurrenceCustomPeriod ?? 'week')
    : null;
  const isMonthBased = recurrencePattern === 'monthly'
    || (recurrencePattern === 'custom' && recurrenceCustomPeriod === 'month');
  const fields: Record<string, unknown> = {
    recurrence_pattern: recurrencePattern,
    recurrence_days: input.recurrenceDays ?? null,
  };

  if (isMonthBased) {
    fields.recurrence_month_days = input.recurrenceMonthDays ?? null;
  }

  if (recurrencePattern === 'custom') {
    fields.recurrence_custom_period = recurrenceCustomPeriod;
  }

  if (input.recurrenceEndDate !== undefined) {
    fields.recurrence_end_date = input.recurrenceEndDate ?? null;
  }

  return {
    fields,
    hasRecurrence: recurrencePattern !== null,
    isMonthBased,
  };
}

async function runDailyTaskWriteWithRecurrenceFallback<T>(
  payload: Record<string, unknown>,
  write: (nextPayload: Record<string, unknown>) => Promise<{ data: T | null; error: SupabaseLikeError | null }>,
): Promise<{ data: T | null; error: SupabaseLikeError | null; fallbackUsed: boolean }> {
  let result = await write(payload);
  if (!isDailyTasksRecurrenceColumnsMissingError(result.error)) {
    return { ...result, fallbackUsed: false };
  }

  if (isMonthBasedRecurrencePayload(payload)) {
    throw new Error(MONTHLY_RECURRENCE_SCHEMA_MESSAGE);
  }

  const fallbackPayload = stripUnsupportedRecurrenceColumns(payload);
  result = await write(fallbackPayload);
  return { ...result, fallbackUsed: true };
}

const emptyAttachmentPersistResult = (): TaskAttachmentPersistResult => ({
  attachmentsSkippedDueToSchema: false,
});

export const useTaskMutations = (taskDate: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateDisciplineFromRitual } = useCompanionAttributes();
  const { showXPToast } = useXPToast();
  const { awardCustomXP } = useXPRewards();
  const { trackTaskCompletion, trackTaskCreation } = useSchedulingLearner();
  const {
    state: resilienceState,
    shouldQueueWrites,
    queueAction,
    queueTaskAction,
    reportApiFailure,
  } = useResilience();

  const addInProgress = useRef(false);
  const showAttachmentsUnavailableToast = () => {
    toast({
      title: "Attachments unavailable",
      description: "Quest saved, but attachments could not be stored. Please try again after the backend migration finishes.",
    });
  };

  const getRemoteTaskId = (taskId: string) => normalizeUuidLikeId(taskId);

  const getLocalTaskRecord = async (taskId: string) => {
    const localTask = await getPlannerRecord<DailyTask>("daily_tasks", taskId);
    if (localTask) return localTask;

    const normalizedTaskId = getRemoteTaskId(taskId);
    if (normalizedTaskId === taskId) return null;

    return getPlannerRecord<DailyTask>("daily_tasks", normalizedTaskId);
  };

  const getLocalSubtasksForAnyTaskId = async <T extends { id: string }>(taskId: string): Promise<T[]> => {
    const directMatches = await getLocalSubtasksForTask<T>(taskId);
    const normalizedTaskId = getRemoteTaskId(taskId);

    if (normalizedTaskId === taskId) {
      return directMatches;
    }

    const normalizedMatches = await getLocalSubtasksForTask<T>(normalizedTaskId);
    const seenIds = new Set<string>();
    return [...directMatches, ...normalizedMatches].filter((subtask) => {
      if (seenIds.has(subtask.id)) return false;
      seenIds.add(subtask.id);
      return true;
    });
  };

  const persistLocalSubtasks = async (
    taskId: string,
    titles: string[],
    providedSubtasks?: Array<{
      id: string;
      title: string;
      completed?: boolean | null;
      completed_at?: string | null;
      sort_order?: number | null;
    }>,
  ) => {
    if (!user?.id) return [];

    const existingSubtasks = await getLocalSubtasksForTask<Array<{
      id: string;
      task_id: string;
      user_id: string;
      title: string;
      completed: boolean;
      completed_at: string | null;
      sort_order: number;
      created_at: string;
    }>[number]>(taskId);

    if (existingSubtasks.length > 0) {
      await removePlannerRecords("subtasks", existingSubtasks.map((subtask) => subtask.id));
    }

    const subtasks = (providedSubtasks ?? titles
      .map((title) => title.trim())
      .filter((title) => title.length > 0)
      .map((title, index) => ({
        id: createOfflinePlannerId("subtask"),
        title,
        completed: false,
        completed_at: null,
        sort_order: index,
      })))
      .map((subtask, index) => ({
        id: subtask.id,
        task_id: taskId,
        user_id: user.id,
        title: subtask.title,
        completed: subtask.completed ?? false,
        completed_at: subtask.completed_at ?? null,
        sort_order: subtask.sort_order ?? index,
        created_at: new Date().toISOString(),
      }));

    if (subtasks.length > 0) {
      await upsertPlannerRecords("subtasks", subtasks);
    }

    return subtasks;
  };

  const persistLocalTaskRow = async (task: DailyTask) => {
    await upsertPlannerRecord("daily_tasks", task);
  };

  const persistLocalHabitCompletion = async (
    habitId: string,
    date: string,
    completed: boolean,
  ): Promise<string | null> => {
    if (!user?.id) return null;

    const existingCompletions = await getLocalHabitCompletionsForDate<Array<{
      id: string;
      habit_id: string | null;
      user_id: string;
      date: string;
      completed_at: string | null;
    }>[number]>(user.id, date);
    const existing = existingCompletions.find((completion) => completion.habit_id === habitId);

    if (!completed) {
      if (existing) {
        await removePlannerRecord("habit_completions", existing.id);
      }
      return null;
    }

    const completionId = existing?.id ?? createOfflinePlannerId("habit-completion");
    await upsertPlannerRecord("habit_completions", {
      id: completionId,
      habit_id: habitId,
      user_id: user.id,
      date,
      completed_at: new Date().toISOString(),
    });

    return completionId;
  };

  const fetchTaskSchedulingState = async (taskId: string) => {
    if (!user?.id) throw new Error('User not authenticated');
    const remoteTaskId = getRemoteTaskId(taskId);
    const localTask = await getLocalTaskRecord(taskId);
    if (typeof navigator !== "undefined" && !navigator.onLine && localTask) {
      return {
        task_date: localTask.task_date,
        scheduled_time: localTask.scheduled_time,
        habit_source_id: localTask.habit_source_id,
        source: localTask.source,
        recurrence_pattern: localTask.recurrence_pattern,
      };
    }

    const { data: task, error } = await supabase
      .from('daily_tasks')
      .select('task_date, scheduled_time, habit_source_id, source, recurrence_pattern')
      .eq('id', remoteTaskId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      if (localTask) {
        return {
          task_date: localTask.task_date,
          scheduled_time: localTask.scheduled_time,
          habit_source_id: localTask.habit_source_id,
          source: localTask.source,
          recurrence_pattern: localTask.recurrence_pattern,
        };
      }
      throw error;
    }
    if (!task) {
      if (localTask) {
        return {
          task_date: localTask.task_date,
          scheduled_time: localTask.scheduled_time,
          habit_source_id: localTask.habit_source_id,
          source: localTask.source,
          recurrence_pattern: localTask.recurrence_pattern,
        };
      }
      throw new Error('Task not found');
    }

    return task;
  };

  const fetchRemoteTaskById = async (taskId: string): Promise<Partial<DailyTask> | null> => {
    if (!user?.id) throw new Error("User not authenticated");
    const remoteTaskId = getRemoteTaskId(taskId);

    const { data, error } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("id", remoteTaskId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Partial<DailyTask> | null;
  };

  const persistRemoteSubtasks = async (
    taskId: string,
    subtasks: NonNullable<DailyTask["subtasks"]>,
  ): Promise<void> => {
    if (!user?.id || subtasks.length === 0) return;

    const { error } = await supabase
      .from("subtasks")
      .insert(
        subtasks.map((subtask) => ({
          id: subtask.id,
          task_id: taskId,
          user_id: user.id,
          title: subtask.title,
          completed: false,
          completed_at: null,
          sort_order: subtask.sort_order ?? 0,
        })),
      );

    if (error) {
      throw error;
    }
  };

  const persistTaskAttachments = async (
    taskId: string,
    attachments: QuestAttachmentInput[],
  ): Promise<TaskAttachmentPersistResult> => {
    if (!user?.id) throw new Error('User not authenticated');
    const remoteTaskId = getRemoteTaskId(taskId);

    const { error: deleteError } = await supabase
      .from('task_attachments' as any)
      .delete()
      .eq('task_id', remoteTaskId)
      .eq('user_id', user.id);

    if (deleteError) {
      if (isTaskAttachmentsTableMissingError(deleteError)) {
        return { attachmentsSkippedDueToSchema: true };
      }
      throw deleteError;
    }

    if (attachments.length === 0) return emptyAttachmentPersistResult();

    const rows = attachments.map((attachment, index) => ({
      task_id: remoteTaskId,
      user_id: user.id,
      file_url: attachment.fileUrl,
      file_path: attachment.filePath,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      file_size_bytes: attachment.fileSizeBytes,
      is_image: attachment.isImage,
      sort_order: attachment.sortOrder ?? index,
    }));

    const { error } = await supabase
      .from('task_attachments' as any)
      .insert(rows);

    if (error) {
      if (isTaskAttachmentsTableMissingError(error)) {
        return { attachmentsSkippedDueToSchema: true };
      }
      throw error;
    }

    return emptyAttachmentPersistResult();
  };

  const addTask = useMutation({
    mutationFn: async (params: AddTaskParams) => {
      if (addInProgress.current) throw new Error('Please wait...');
      addInProgress.current = true;

      const normalizedScheduling = normalizeTaskSchedulingState({
        task_date: params.taskDate !== undefined ? params.taskDate : taskDate,
        scheduled_time: params.scheduledTime || null,
        habit_source_id: null,
        source: params.taskDate === null ? 'inbox' : 'manual',
      });
      const normalizedAttachments = (params.attachments ?? []).slice(0, 10);
      const primaryImageUrl = firstImageFromAttachments(normalizedAttachments) ?? params.imageUrl ?? null;
      const detectedCategory = detectCategory(params.taskText, params.category);
      const recurrenceWrite = buildRecurrenceWriteFields({
        recurrencePattern: params.recurrencePattern,
        recurrenceDays: params.recurrenceDays,
        recurrenceMonthDays: params.recurrenceMonthDays,
        recurrenceCustomPeriod: params.recurrenceCustomPeriod,
        recurrenceEndDate: params.recurrenceEndDate,
      });

      if (recurrenceWrite.hasRecurrence && !normalizedScheduling.scheduled_time) {
        throw buildRecurrenceRequiresScheduledTimeError();
      }

      if (!user?.id) throw new Error('User not authenticated');

      const cleanedSubtasks = (params.subtasks || [])
        .map((title) => title.trim())
        .filter((title) => title.length > 0);

      const localExistingTasks = normalizedScheduling.task_date === null
        ? []
        : await getLocalTasksByDate<DailyTask>(user.id, normalizedScheduling.task_date);
      const questPosition = (localExistingTasks?.length || 0) + 1;
      const xpReward = getEffectiveQuestXP(params.difficulty, questPosition);
      const localTaskId = createOfflinePlannerId("task");

      const localTaskRow: DailyTask = {
        id: localTaskId,
        user_id: user.id,
        task_text: params.taskText,
        difficulty: params.difficulty,
        xp_reward: xpReward,
        task_date: normalizedScheduling.task_date,
        completed: false,
        completed_at: null,
        is_main_quest: params.isMainQuest ?? false,
        scheduled_time: normalizedScheduling.scheduled_time,
        estimated_duration: params.estimatedDuration || null,
        recurrence_pattern: recurrenceWrite.fields.recurrence_pattern as string | null,
        recurrence_days: recurrenceWrite.fields.recurrence_days as number[] | null,
        recurrence_month_days: (recurrenceWrite.fields.recurrence_month_days as number[] | null | undefined) ?? null,
        recurrence_custom_period: (recurrenceWrite.fields.recurrence_custom_period as "week" | "month" | null | undefined) ?? null,
        recurrence_end_date: (recurrenceWrite.fields.recurrence_end_date as string | null | undefined) ?? null,
        is_recurring: recurrenceWrite.hasRecurrence,
        reminder_enabled: params.reminderEnabled ?? false,
        reminder_minutes_before: params.reminderMinutesBefore ?? 15,
        reminder_sent: false,
        parent_template_id: null,
        category: detectedCategory,
        is_bonus: false,
        created_at: new Date().toISOString(),
        priority: null,
        is_top_three: null,
        actual_time_spent: null,
        ai_generated: null,
        context_id: null,
        source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? "inbox" : "manual"),
        habit_source_id: null,
        epic_id: null,
        sort_order: 0,
        contact_id: params.contactId || null,
        auto_log_interaction: params.autoLogInteraction ?? true,
        image_url: primaryImageUrl,
        notes: params.notes || null,
        location: params.location || null,
        attachments: normalizedAttachments.map((attachment) => ({
          fileUrl: attachment.fileUrl,
          filePath: attachment.filePath,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSizeBytes: attachment.fileSizeBytes,
          isImage: attachment.isImage,
          sortOrder: attachment.sortOrder,
        })),
        subtasks: cleanedSubtasks.map((title, index) => ({
          id: createOfflinePlannerId("subtask"),
          title,
          completed: false,
          sort_order: index,
        })),
      };

      const queuedCreatePayload = {
        id: localTaskId,
        task_text: params.taskText,
        difficulty: params.difficulty,
        xp_reward: xpReward,
        task_date: normalizedScheduling.task_date,
        is_main_quest: params.isMainQuest ?? false,
        scheduled_time: normalizedScheduling.scheduled_time,
        estimated_duration: params.estimatedDuration || null,
        ...recurrenceWrite.fields,
        is_recurring: recurrenceWrite.hasRecurrence,
        reminder_enabled: params.reminderEnabled ?? false,
        reminder_minutes_before: params.reminderMinutesBefore ?? 15,
        category: detectedCategory,
        notes: params.notes || null,
        contact_id: params.contactId || null,
        auto_log_interaction: params.autoLogInteraction ?? true,
        image_url: primaryImageUrl,
        location: params.location || null,
        source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? "inbox" : "manual"),
        subtasks: localTaskRow.subtasks?.map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          completed: false,
          completed_at: null,
          sort_order: subtask.sort_order ?? 0,
        })) ?? [],
      };

      const buildTaskCreateResult = (
        taskData: Partial<DailyTask> | null | undefined,
        attachmentPersistResult: TaskAttachmentPersistResult,
      ): TaskCreateMutationResult => ({
        ...localTaskRow,
        ...(taskData ?? {}),
        attachmentsSkippedDueToSchema: attachmentPersistResult.attachmentsSkippedDueToSchema,
      });

      let localPersistMs: number | null = null;
      let remoteInsertMs: number | null = null;
      let existenceCheckMs: number | null = null;

      const trackTaskCreateResult = (result: TaskCreateMutationResult) => {
        trackResilienceEvent("task_create_result", {
          queued: result.queued ?? false,
          queueReason: result.queueReason ?? null,
          syncPending: result.syncPending ?? false,
          localPersistMs,
          remoteInsertMs,
          existenceCheckMs,
        });
      };

      const queueCreateTask = async (queueReason: TaskCreateQueueReason): Promise<TaskCreateMutationResult> => {
        await queueTaskAction("CREATE_TASK", queuedCreatePayload);

        const queuedResult: TaskCreateMutationResult = {
          ...localTaskRow,
          queued: true,
          queueReason,
          syncPending: true,
          attachmentsSkippedDueToSchema: false,
        };
        trackTaskCreateResult(queuedResult);
        return queuedResult;
      };

      try {
        const localPersistStartedAt = Date.now();
        await persistLocalTaskRow(localTaskRow);
        await persistLocalSubtasks(localTaskId, cleanedSubtasks, localTaskRow.subtasks?.map((subtask) => ({
          id: subtask.id,
          title: subtask.title,
          completed: subtask.completed,
          sort_order: subtask.sort_order,
        })));
        localPersistMs = Date.now() - localPersistStartedAt;

        if (shouldQueueWrites) {
          return queueCreateTask("offline");
        }

        const insertPayload = {
          id: localTaskId,
          user_id: user.id,
          task_text: params.taskText,
          difficulty: params.difficulty,
          xp_reward: xpReward,
          task_date: normalizedScheduling.task_date,
          is_main_quest: params.isMainQuest ?? false,
          scheduled_time: normalizedScheduling.scheduled_time,
          estimated_duration: params.estimatedDuration || null,
          ...recurrenceWrite.fields,
          is_recurring: recurrenceWrite.hasRecurrence,
          reminder_enabled: params.reminderEnabled ?? false,
          reminder_minutes_before: params.reminderMinutesBefore ?? 15,
          category: detectedCategory,
          is_bonus: false,
          notes: params.notes || null,
          contact_id: params.contactId || null,
          auto_log_interaction: params.autoLogInteraction ?? true,
          image_url: primaryImageUrl,
          location: params.location || null,
          source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? 'inbox' : 'manual'),
        };

        let persistedRemoteTask: Partial<DailyTask> | null = null;
        let fallbackUsed = false;
        const remoteInsertStartedAt = Date.now();

        try {
          const abortController = new AbortController();
          const insertResult = await withTimeout(
            () => runDailyTaskWriteWithRecurrenceFallback(
              insertPayload,
              (nextPayload) => {
                const insertQuery = supabase
                  .from("daily_tasks")
                  .insert(nextPayload);

                insertQuery.abortSignal(abortController.signal);
                return insertQuery.select().single();
              },
            ),
            {
              timeoutMs: CREATE_TASK_REMOTE_TIMEOUT_MS,
              operation: "create quest insert",
              timeoutCode: "TASK_CREATE_TIMEOUT",
              onTimeout: () => abortController.abort(),
            },
          );

          remoteInsertMs = Date.now() - remoteInsertStartedAt;
          fallbackUsed = insertResult.fallbackUsed;
          if (insertResult.error) throw insertResult.error;
          persistedRemoteTask = insertResult.data as Partial<DailyTask> | null;
        } catch (error) {
          remoteInsertMs = Date.now() - remoteInsertStartedAt;

          if (error instanceof TimeoutError) {
            const existenceCheckStartedAt = Date.now();
            const existingRemoteTask = await pollWithDeadline({
              task: () => fetchRemoteTaskById(localTaskId),
              intervalMs: CREATE_TASK_EXISTENCE_CHECK_INTERVAL_MS,
              deadlineMs: CREATE_TASK_EXISTENCE_CHECK_MS,
            });
            existenceCheckMs = Date.now() - existenceCheckStartedAt;

            if (existingRemoteTask) {
              persistedRemoteTask = existingRemoteTask;
            } else {
              const queueReason = resolveTaskCreateQueueReason(resilienceState, error);
              reportApiFailure(error, {
                source: "task_add_timeout",
                queueReason,
                localPersistMs,
                remoteInsertMs,
                existenceCheckMs,
              });
              return queueCreateTask(queueReason);
            }
          } else if (isQueueableWriteError(error)) {
            const queueReason = resolveTaskCreateQueueReason(resilienceState, error);
            reportApiFailure(error, {
              source: "task_add",
              queueReason,
              localPersistMs,
              remoteInsertMs,
              existenceCheckMs,
            });
            return queueCreateTask(queueReason);
          } else {
            throw error;
          }
        }

        if (fallbackUsed) {
          console.warn("daily_tasks insert retried without month recurrence columns due to schema drift");
        }

        let attachmentPersistResult = emptyAttachmentPersistResult();
        if (persistedRemoteTask?.id) {
          try {
            attachmentPersistResult = await persistTaskAttachments(persistedRemoteTask.id, normalizedAttachments);
          } catch (attachmentsError) {
            await supabase
              .from('daily_tasks')
              .delete()
              .eq('id', persistedRemoteTask.id)
              .eq('user_id', user.id);
            throw attachmentsError;
          }
        }

        if (cleanedSubtasks.length > 0 && persistedRemoteTask?.id) {
          try {
            await persistRemoteSubtasks(
              persistedRemoteTask.id,
              (localTaskRow.subtasks ?? []) as NonNullable<DailyTask["subtasks"]>,
            );
          } catch (subtasksError) {
            // Best-effort rollback to keep create behavior predictable.
            await supabase
              .from('daily_tasks')
              .delete()
              .eq('id', persistedRemoteTask.id)
              .eq('user_id', user.id);
            throw subtasksError;
          }
        }

        const createResult = buildTaskCreateResult(persistedRemoteTask, attachmentPersistResult);
        trackTaskCreateResult(createResult);
        return createResult;
      } catch (error) {
        reportApiFailure(error, {
          source: "task_add_nonqueueable",
          localPersistMs,
          remoteInsertMs,
          existenceCheckMs,
        });
        throw error;
      } finally {
        addInProgress.current = false;
      }
    },
    onMutate: async (params: AddTaskParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['calendar-tasks'] });

      // Snapshot previous values
      const previousDailyTasks = queryClient.getQueriesData({ queryKey: ['daily-tasks'] });
      const previousCalendarTasks = queryClient.getQueriesData({ queryKey: ['calendar-tasks'] });

      const normalizedScheduling = normalizeTaskSchedulingState({
        task_date: params.taskDate !== undefined ? params.taskDate : taskDate,
        scheduled_time: params.scheduledTime || null,
        habit_source_id: null,
        source: params.taskDate === null ? 'inbox' : 'manual',
      });
      const recurrenceWrite = buildRecurrenceWriteFields({
        recurrencePattern: params.recurrencePattern,
        recurrenceDays: params.recurrenceDays,
        recurrenceMonthDays: params.recurrenceMonthDays,
        recurrenceCustomPeriod: params.recurrenceCustomPeriod,
        recurrenceEndDate: params.recurrenceEndDate,
      });

      // Create optimistic task with all required fields
      const primaryImageUrl = firstImageFromAttachments(params.attachments) ?? params.imageUrl ?? null;
      const optimisticTask = {
        id: `temp-${Date.now()}`,
        user_id: user?.id,
        task_text: params.taskText,
        difficulty: params.difficulty,
        task_date: normalizedScheduling.task_date,
        completed: false,
        completed_at: null,
        is_main_quest: params.isMainQuest ?? false,
        scheduled_time: normalizedScheduling.scheduled_time,
        estimated_duration: params.estimatedDuration || null,
        xp_reward: getEffectiveQuestXP(params.difficulty, 1),
        created_at: new Date().toISOString(),
        category: detectCategory(params.taskText, params.category),
        is_bonus: false,
        is_recurring: recurrenceWrite.hasRecurrence,
        recurrence_pattern: recurrenceWrite.fields.recurrence_pattern as string | null,
        recurrence_days: recurrenceWrite.fields.recurrence_days as number[] | null,
        recurrence_month_days: (recurrenceWrite.fields.recurrence_month_days as number[] | null | undefined) ?? null,
        recurrence_custom_period: (recurrenceWrite.fields.recurrence_custom_period as RecurrenceCustomPeriod | null | undefined) ?? null,
        recurrence_end_date: (recurrenceWrite.fields.recurrence_end_date as string | null | undefined) ?? null,
        reminder_enabled: params.reminderEnabled ?? false,
        reminder_minutes_before: params.reminderMinutesBefore ?? 15,
        reminder_sent: false,
        parent_template_id: null,
        notes: params.notes || null,
        image_url: primaryImageUrl,
        location: params.location || null,
        source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? 'inbox' : 'manual'),
      };

      // Only update the specific day query to avoid cross-day cache pollution
      if (optimisticTask.task_date) {
        queryClient.setQueryData(['daily-tasks', user?.id, optimisticTask.task_date], (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return [optimisticTask, ...old];
        });
      }

      return { previousDailyTasks, previousCalendarTasks };
    },
    onError: (error: Error, _params, context) => {
      // Rollback on error
      if (context?.previousDailyTasks) {
        context.previousDailyTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCalendarTasks) {
        context.previousCalendarTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      reportApiFailure(error, { source: "task_add_onError" });
      toast({
        title: "Failed to add quest",
        description: getTaskMutationErrorMessage(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
    },
    onSuccess: (data) => {
      if ((data as TaskCreateMutationResult | undefined)?.queued) {
        const queuedToast = getQueuedTaskCreateToastMessage(
          (data as TaskCreateMutationResult | undefined)?.queueReason,
        );
        toast(queuedToast);
        return;
      }
      toast({ title: "Quest added!" });
      if (data?.attachmentsSkippedDueToSchema) {
        showAttachmentsUnavailableToast();
      }
      window.dispatchEvent(
        new CustomEvent('task-added', {
          detail: {
            taskDate: data?.task_date ?? null,
            scheduledTime: data?.scheduled_time ?? null,
          },
        })
      );
      
      // Track task creation for learning
      if (data) {
        trackTaskCreation(
          data.scheduled_time,
          data.difficulty || 'medium',
          data.category,
          data.task_text
        );
      }
    },
  });

  const toggleTask = useMutation({
    mutationFn: async (variables: ToggleTaskVariables) => {
      const { taskId, completed, xpReward, forceUndo = false } = variables;
      if (!user?.id) throw new Error('User not authenticated');
      const remoteTaskId = getRemoteTaskId(taskId);
      const localTask = await getLocalTaskRecord(taskId);
      const intendedCompletedAt = completed ? new Date().toISOString() : null;

      if (localTask) {
        await persistLocalTaskRow({
          ...localTask,
          completed,
          completed_at: forceUndo || !completed ? null : intendedCompletedAt,
        });
      }

      if (shouldQueueWrites) {
        const localHabitSourceId = localTask?.habit_source_id ?? null;
        const localTaskDate = localTask?.task_date ?? format(new Date(), 'yyyy-MM-dd');

        if (localHabitSourceId) {
          const completionId = await persistLocalHabitCompletion(
            localHabitSourceId,
            localTaskDate,
            completed && !forceUndo,
          );

          await queueAction({
            actionKind: "HABIT_COMPLETION_SET",
            entityType: "habit_completion",
            entityId: localHabitSourceId,
            payload: {
              completionId: completionId ?? undefined,
              habitId: localHabitSourceId,
              date: localTaskDate,
              completed: completed && !forceUndo,
            },
          });
        }

        await queueTaskAction("COMPLETE_TASK", buildQueuedTogglePayload(variables));
        return {
          queued: true,
          taskId,
          completed,
          xpAwarded: 0,
          toastReason: null,
          wasAlreadyCompleted: false,
          isUndo: false,
          taskText: localTask?.task_text ?? "Quest",
          habitSourceId: localHabitSourceId,
          taskDifficulty: localTask?.difficulty ?? null,
          taskScheduledTime: localTask?.scheduled_time ?? null,
          taskCategory: localTask?.category ?? null,
        };
      }

      const { data: existingTask, error: existingError } = await supabase
        .from('daily_tasks')
        .select(`
          completed_at, task_text, habit_source_id, task_date, difficulty, scheduled_time, category,
          is_main_quest, xp_reward,
          contact_id, auto_log_interaction,
          contact:contacts!contact_id(id, name, avatar_url)
        `)
        .eq('id', remoteTaskId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const wasAlreadyCompleted = (existingTask?.completed_at ?? localTask?.completed_at ?? null) !== null;
      const taskText = existingTask?.task_text || localTask?.task_text || 'Task';
      const habitSourceId = existingTask?.habit_source_id ?? localTask?.habit_source_id ?? null;
      const taskDateValue = existingTask?.task_date || localTask?.task_date || format(new Date(), 'yyyy-MM-dd');
      const isMainQuest = existingTask?.is_main_quest === true || localTask?.is_main_quest === true;
      const storedTaskXP = Number(existingTask?.xp_reward ?? localTask?.xp_reward ?? xpReward);
      const mainQuestXP = Math.round(storedTaskXP * MAIN_QUEST_XP_MULTIPLIER);
      const normalizedTaskXP = isMainQuest && xpReward <= storedTaskXP
        ? mainQuestXP
        : xpReward;

      // Allow undo if forceUndo is true, otherwise block unchecking
      if (wasAlreadyCompleted && !completed && !forceUndo) {
        throw new Error('Cannot uncheck completed tasks');
      }

      // Handle undo case - revert task and deduct XP
      if (!completed && forceUndo) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', remoteTaskId)
          .eq('user_id', user.id);

        if (error) throw error;
        if (localTask) {
          await persistLocalTaskRow({
            ...localTask,
            completed: false,
            completed_at: null,
          });
        }

        // Deduct the XP that was awarded
        if (normalizedTaskXP > 0) {
          await awardCustomXP(-normalizedTaskXP, 'task_undo', 'Quest undone', { task_id: taskId });
        }

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
          await persistLocalHabitCompletion(habitSourceId, taskDateValue, false);
          await supabase
            .from('habit_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('habit_id', habitSourceId)
            .eq('date', taskDateValue);
        }

        return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted: true, isUndo: true, taskText, habitSourceId };
      }

      if (!completed) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', remoteTaskId)
          .eq('user_id', user.id);

        if (error) throw error;
        if (localTask) {
          await persistLocalTaskRow({
            ...localTask,
            completed: false,
            completed_at: null,
          });
        }

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
          await persistLocalHabitCompletion(habitSourceId, taskDateValue, false);
          await supabase
            .from('habit_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('habit_id', habitSourceId)
            .eq('date', taskDateValue);
        }

        return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted, isUndo: false, taskText, habitSourceId };
      }

      const { bonusXP, toastReason } = await calculateGuildBonus(user.id, normalizedTaskXP);
      const totalXP = normalizedTaskXP + bonusXP;

      const { data: updateResult, error: updateError } = await supabase
        .from('daily_tasks')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', remoteTaskId)
        .eq('user_id', user.id)
        .eq('completed', false)
        .select();

      if (updateError) throw updateError;
      if (!updateResult || updateResult.length === 0) {
        throw new Error('Task was already completed');
      }
      if (localTask) {
        await persistLocalTaskRow({
          ...localTask,
          completed: true,
          completed_at: new Date().toISOString(),
        });
      }

      const awardResult = await awardCustomXP(totalXP, 'task_complete', toastReason, { task_id: taskId });
      const awardedXP = awardResult?.xpAwarded ?? 0;

      // If this is a habit-sourced task, sync with habit_completions
      if (habitSourceId) {
        await persistLocalHabitCompletion(habitSourceId, taskDateValue, true);
        const { error: habitError } = await supabase
          .from('habit_completions')
          .upsert({
            user_id: user.id,
            habit_id: habitSourceId,
            date: taskDateValue,
          }, { onConflict: 'user_id,habit_id,date' });

        if (habitError) {
          console.error('[Task Toggle] Failed to sync habit completion:', habitError);
        } else {
          console.log('[Task Toggle] Synced habit completion for habit:', habitSourceId);
        }
      }

      const taskDifficulty = existingTask?.difficulty || 'medium';
      const taskScheduledTime = existingTask?.scheduled_time || null;
      const taskCategory = existingTask?.category || null;
      const contactId = existingTask?.contact_id || null;
      const autoLogInteraction = existingTask?.auto_log_interaction ?? true;
      const contact = existingTask?.contact as { id: string; name: string; avatar_url: string | null } | null;

      return { 
        taskId, 
        completed: true, 
        xpAwarded: awardedXP, 
        bonusXP, 
        toastReason, 
        wasAlreadyCompleted, 
        isUndo: false, 
        taskText, 
        habitSourceId,
        taskDifficulty,
        taskScheduledTime,
        taskCategory,
        contactId,
        autoLogInteraction,
        contact,
      };
    },
    onSuccess: async (result: any) => {
      const { completed, xpAwarded, toastReason, wasAlreadyCompleted, isUndo, taskId, taskText, habitSourceId, taskDifficulty, taskScheduledTime, taskCategory } = result ?? {};
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      if (habitSourceId) {
        queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
        queryClient.invalidateQueries({ queryKey: ['epics'] });
      }

      if (result?.queued) {
        toast({
          title: "Quest update queued",
          description: "We'll sync this change when connection is restored.",
        });
        return;
      }

      // Handle undo success
      if (isUndo) {
        toast({ 
          title: "Quest undone", 
          description: "XP has been adjusted",
        });
        return;
      }

      if (completed && !wasAlreadyCompleted) {
        if (xpAwarded > 0) {
          showXPToast(xpAwarded, toastReason || 'Quest Complete!');
        }
        if (companion?.id) {
          updateDisciplineFromRitual(companion.id).catch(console.error);
        }
        window.dispatchEvent(new CustomEvent('mission-completed'));
        window.dispatchEvent(new CustomEvent('quest-completed'));

        // Track completion for scheduling learner
        const now = new Date();
        console.log('[TaskMutations] About to track completion:', {
          taskId,
          taskText: taskText?.substring(0, 50),
          taskDifficulty,
          taskCategory,
        });
        
        try {
          await trackTaskCompletion({
            taskId,
            completedAt: now.toISOString(),
            difficulty: taskDifficulty || 'medium',
            scheduledTime: taskScheduledTime,
            actualCompletionHour: now.getHours(),
            dayOfWeek: now.getDay(),
            wasOnTime: taskScheduledTime 
              ? Math.abs(parseInt(taskScheduledTime.split(':')[0]) - now.getHours()) <= 1 
              : null,
            category: taskCategory || undefined,
            taskText,
          });
          console.log('[TaskMutations] trackTaskCompletion succeeded');
        } catch (trackError) {
          console.error('[TaskMutations] trackTaskCompletion failed:', trackError);
        }

        // Show undo toast with 5-second window
        toast({
          title: "Quest completed! ✨",
          description: taskText.length > 40 ? taskText.substring(0, 40) + '...' : taskText,
          duration: 5000,
          action: createElement(
            ToastAction,
            {
              altText: "Undo completion",
              onClick: () => {
                toggleTask.mutate({ 
                  taskId, 
                  completed: false, 
                  xpReward: xpAwarded,
                  forceUndo: true 
                });
              }
            },
            "Undo"
          ) as unknown as ToastActionElement,
        });
      }
    },
    onError: (error: Error, variables: ToggleTaskVariables) => {
      if (isQueueableWriteError(error)) {
        reportApiFailure(error, { source: "task_toggle_onError" });
        void (async () => {
          const localTask = await getPlannerRecord<DailyTask>('daily_tasks', variables.taskId);
          const habitSourceId = localTask?.habit_source_id ?? null;
          const taskDateValue = localTask?.task_date ?? format(new Date(), 'yyyy-MM-dd');

          if (habitSourceId) {
            const completionId = await persistLocalHabitCompletion(
              habitSourceId,
              taskDateValue,
              variables.completed && !(variables.forceUndo ?? false),
            );

            await queueAction({
              actionKind: "HABIT_COMPLETION_SET",
              entityType: "habit_completion",
              entityId: habitSourceId,
              payload: {
                completionId: completionId ?? undefined,
                habitId: habitSourceId,
                date: taskDateValue,
                completed: variables.completed && !(variables.forceUndo ?? false),
              },
            });
          }
        })();
        void queueTaskAction("COMPLETE_TASK", buildQueuedTogglePayload(variables));

        toast({
          title: "Quest update queued",
          description: "We'll sync this change when connection is restored.",
        });
        return;
      }

      reportApiFailure(error, { source: "task_toggle_onError_nonqueueable" });
      const errorMessage = error.message === 'Please wait...' 
        ? 'Please wait for the previous action to complete'
        : error.message.includes('Failed to fetch') || error.message.includes('Load failed')
        ? 'Network error. Please check your connection and try again.'
        : error.message;
      
      toast({ title: "Failed to toggle quest", description: errorMessage, variant: "destructive" });
    },
    retry: 2,
    retryDelay: 1000,
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!taskId) throw new Error('Invalid task ID');
      const remoteTaskId = getRemoteTaskId(taskId);
      const existingSubtasks = await getLocalSubtasksForAnyTaskId<Array<{ id: string }>[number]>(taskId);
      await removePlannerRecord("daily_tasks", taskId);
      if (remoteTaskId !== taskId) {
        await removePlannerRecord("daily_tasks", remoteTaskId);
      }
      if (existingSubtasks.length > 0) {
        await removePlannerRecords("subtasks", existingSubtasks.map((subtask) => subtask.id));
      }
      
      if (shouldQueueWrites) {
        await queueTaskAction("DELETE_TASK", { taskId });
        return { queued: true };
      }

      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', remoteTaskId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return { queued: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      if ((result as { queued?: boolean } | undefined)?.queued) {
        toast({
          title: "Quest deletion queued",
          description: "We'll sync this deletion when connection is restored.",
        });
      }
    },
    onError: (error: Error, taskId) => {
      if (isQueueableWriteError(error)) {
        reportApiFailure(error, { source: "task_delete_onError" });
        void queueTaskAction("DELETE_TASK", { taskId });
        toast({
          title: "Quest deletion queued",
          description: "We'll sync this deletion when connection is restored.",
        });
        return;
      }
      reportApiFailure(error, { source: "task_delete_onError_nonqueueable" });
      toast({ title: "Failed to delete quest", description: error.message, variant: "destructive" });
    },
  });

  // Restore a deleted task (for undo functionality)
  const restoreTask = useMutation({
    mutationFn: async (taskData: {
      task_text: string;
      task_date: string | null;
      xp_reward?: number;
      difficulty?: string | null;
      scheduled_time?: string | null;
      estimated_duration?: number | null;
      is_main_quest?: boolean;
      epic_id?: string | null;
      sort_order?: number | null;
      notes?: string | null;
      priority?: string | null;
      category?: string | null;
      habit_source_id?: string | null;
      is_recurring?: boolean;
      recurrence_pattern?: string | null;
      recurrence_days?: number[] | null;
      recurrence_month_days?: number[] | null;
      recurrence_custom_period?: "week" | "month" | null;
      recurrence_end_date?: string | null;
      reminder_enabled?: boolean;
      reminder_minutes_before?: number | null;
      source?: string | null;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const restoredTaskId = createOfflinePlannerId("task");

      const normalizedScheduling = normalizeTaskSchedulingState({
        task_date: taskData.task_date ?? null,
        scheduled_time: taskData.scheduled_time ?? null,
        habit_source_id: taskData.habit_source_id ?? null,
        source: taskData.source ?? null,
      });
      const recurrenceWrite = buildRecurrenceWriteFields({
        recurrencePattern: taskData.recurrence_pattern,
        recurrenceDays: taskData.recurrence_days,
        recurrenceMonthDays: taskData.recurrence_month_days,
        recurrenceCustomPeriod: taskData.recurrence_custom_period,
        recurrenceEndDate: taskData.recurrence_end_date,
      });
      const insertPayload = {
        id: restoredTaskId,
        user_id: user.id,
        task_text: taskData.task_text,
        task_date: normalizedScheduling.task_date,
        xp_reward: taskData.xp_reward ?? 10,
        difficulty: taskData.difficulty ?? 'medium',
        scheduled_time: normalizedScheduling.scheduled_time,
        estimated_duration: taskData.estimated_duration,
        is_main_quest: taskData.is_main_quest ?? false,
        epic_id: taskData.epic_id,
        sort_order: taskData.sort_order,
        notes: taskData.notes,
        priority: taskData.priority,
        category: taskData.category,
        habit_source_id: taskData.habit_source_id,
        is_recurring: taskData.is_recurring ?? recurrenceWrite.hasRecurrence,
        ...recurrenceWrite.fields,
        reminder_enabled: taskData.reminder_enabled ?? false,
        reminder_minutes_before: taskData.reminder_minutes_before,
        source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? 'inbox' : 'manual'),
      };

      await persistLocalTaskRow({
        ...(insertPayload as DailyTask),
        completed: false,
        completed_at: null,
        reminder_sent: false,
        contact_id: null,
        auto_log_interaction: true,
        image_url: null,
        notes: taskData.notes ?? null,
        location: null,
        actual_time_spent: null,
        ai_generated: null,
        context_id: null,
        attachments: [],
        subtasks: [],
      });

      if (shouldQueueWrites) {
        await queueTaskAction("CREATE_TASK", insertPayload);
        return {
          ...(insertPayload as DailyTask),
          completed: false,
          completed_at: null,
          queued: true,
        };
      }
      
      const { data, error, fallbackUsed } = await runDailyTaskWriteWithRecurrenceFallback(
        insertPayload,
        (nextPayload) => supabase
          .from('daily_tasks')
          .insert(nextPayload)
          .select()
          .single(),
      );

      if (fallbackUsed) {
        console.warn('daily_tasks restore retried without month recurrence columns due to schema drift');
      }
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to restore quest", description: error.message, variant: "destructive" });
    },
  });

  const setMainQuest = useMutation({
    mutationFn: async (taskId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const remoteTaskId = getRemoteTaskId(taskId);
      const localTasksForDate = await getLocalTasksByDate<DailyTask>(user.id, taskDate);
      const task = localTasksForDate.find((candidate) => getRemoteTaskId(candidate.id) === remoteTaskId);

      if (!task) throw new Error('Task not found or access denied');

      await Promise.all(
        localTasksForDate.map((candidate) =>
          persistLocalTaskRow({
            ...candidate,
            is_main_quest: getRemoteTaskId(candidate.id) === remoteTaskId,
          }),
        ),
      );

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "TASK_SET_MAIN_QUEST",
          entityType: "task",
          entityId: taskId,
          payload: {
            taskId,
            taskDate,
          },
        });
        return { queued: true };
      }

      await supabase
        .from('daily_tasks')
        .update({ is_main_quest: false })
        .eq('user_id', user.id)
        .eq('task_date', taskDate);

      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ is_main_quest: true })
        .eq('id', remoteTaskId)
        .eq('user_id', user.id);

      if (updateError) {
        await queueAction({
          actionKind: "TASK_SET_MAIN_QUEST",
          entityType: "task",
          entityId: taskId,
          payload: {
            taskId,
            taskDate,
          },
        });
        return { queued: true };
      }

      return { queued: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({
        title: result?.queued ? "Main quest saved offline" : "Main quest updated!",
        description: result?.queued ? "We'll sync this change when connection is restored." : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update main quest", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: TaskUpdateVariables) => {
      if (!user?.id) throw new Error('User not authenticated');
      const remoteTaskId = getRemoteTaskId(taskId);
      const localTask = await getLocalTaskRecord(taskId);
      let normalizedToInbox = false;
      let strippedScheduledTime = false;
      let movedFromInboxToScheduled = false;
      let attachmentsSkippedDueToSchema = false;
      let existingScheduling:
        | {
          task_date: string | null;
          scheduled_time: string | null;
          habit_source_id: string | null;
          source?: string | null;
          recurrence_pattern?: string | null;
        }
        | null = null;

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {};
      
      if (updates.task_text !== undefined) {
        updateData.task_text = updates.task_text;
      }
      if (updates.task_date !== undefined) {
        updateData.task_date = updates.task_date;
      }
      if (updates.difficulty !== undefined) {
        updateData.difficulty = updates.difficulty;
      }
      if (updates.scheduled_time !== undefined) {
        updateData.scheduled_time = updates.scheduled_time;
      }
      if (updates.estimated_duration !== undefined) {
        updateData.estimated_duration = updates.estimated_duration;
      }
      if (updates.recurrence_pattern !== undefined) {
        updateData.recurrence_pattern = updates.recurrence_pattern;
      }
      if (updates.recurrence_days !== undefined) {
        updateData.recurrence_days = updates.recurrence_days;
      }
      if (updates.recurrence_month_days !== undefined) {
        updateData.recurrence_month_days = updates.recurrence_month_days;
      }
      if (updates.recurrence_custom_period !== undefined) {
        updateData.recurrence_custom_period = updates.recurrence_custom_period;
      }
      if (updates.reminder_enabled !== undefined) {
        updateData.reminder_enabled = updates.reminder_enabled;
      }
      if (updates.reminder_minutes_before !== undefined) {
        updateData.reminder_minutes_before = updates.reminder_minutes_before;
      }
      if (updates.notes !== undefined) {
        updateData.notes = updates.notes;
      }
      
      // Handle category with validation
      if (updates.category !== undefined || updates.task_text !== undefined) {
        const validatedCategory = updates.category && validCategories.includes(updates.category as TaskCategory)
          ? updates.category
          : updates.task_text 
            ? detectCategory(updates.task_text, updates.category || undefined)
            : updates.category;
        updateData.category = validatedCategory;
      }
      
      // Handle image_url
      if (updates.image_url !== undefined) {
        updateData.image_url = updates.image_url;
      }

      const hasAttachmentUpdates = updates.attachments !== undefined;
      if (hasAttachmentUpdates) {
        updateData.image_url = firstImageFromAttachments(updates.attachments) ?? null;
      }
      
      // Handle location
      if (updates.location !== undefined) {
        updateData.location = updates.location;
      }

      const recurrenceFieldsUpdated = (
        updates.recurrence_pattern !== undefined
        || updates.recurrence_days !== undefined
        || updates.recurrence_month_days !== undefined
        || updates.recurrence_custom_period !== undefined
      );

      if (!shouldQueueWrites && (
        updates.task_date !== undefined
        || updates.scheduled_time !== undefined
        || recurrenceFieldsUpdated
      )) {
        existingScheduling = await fetchTaskSchedulingState(taskId);
      }

      if (!shouldQueueWrites && (updates.task_date !== undefined || updates.scheduled_time !== undefined)) {
        if (!existingScheduling) {
          existingScheduling = await fetchTaskSchedulingState(taskId);
        }

        const normalizedScheduling = normalizeTaskSchedulingUpdate(existingScheduling, {
          task_date: updates.task_date,
          scheduled_time: updates.scheduled_time,
        });

        updateData.task_date = normalizedScheduling.task_date;
        updateData.scheduled_time = normalizedScheduling.scheduled_time;

        if (normalizedScheduling.source !== existingScheduling.source) {
          updateData.source = normalizedScheduling.source;
        }

        normalizedToInbox = normalizedScheduling.normalizedToInbox;
        strippedScheduledTime = normalizedScheduling.strippedScheduledTime;
        movedFromInboxToScheduled = normalizedScheduling.movedFromInboxToScheduled;
      }

      const nextRecurrencePattern = normalizeRecurrencePattern(
        updates.recurrence_pattern !== undefined
          ? updates.recurrence_pattern
          : existingScheduling?.recurrence_pattern ?? null,
      );
      const nextScheduledTime = typeof updateData.scheduled_time === 'string' || updateData.scheduled_time === null
        ? updateData.scheduled_time
        : existingScheduling?.scheduled_time ?? null;

      if (recurrenceFieldsUpdated) {
        updateData.is_recurring = hasRecurrencePattern(nextRecurrencePattern);
      }

      if (recurrenceRequiresScheduledTime(nextRecurrencePattern, nextScheduledTime)) {
        throw buildRecurrenceRequiresScheduledTimeError();
      }

      if (
        shouldQueueWrites
        && updates.recurrence_pattern !== undefined
        && hasRecurrencePattern(updates.recurrence_pattern)
        && updates.scheduled_time !== undefined
        && !updates.scheduled_time
      ) {
        throw buildRecurrenceRequiresScheduledTimeError();
      }

      if (Object.keys(updateData).length === 0) {
        return {
          normalizedToInbox,
          strippedScheduledTime,
          movedFromInboxToScheduled,
          attachmentsSkippedDueToSchema,
          queued: false,
        };
      }

      if (localTask) {
        await persistLocalTaskRow({
          ...localTask,
          ...updateData,
          attachments: updates.attachments !== undefined
            ? updates.attachments.map((attachment) => ({
              fileUrl: attachment.fileUrl,
              filePath: attachment.filePath,
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              fileSizeBytes: attachment.fileSizeBytes,
              isImage: attachment.isImage,
              sortOrder: attachment.sortOrder,
            }))
            : localTask.attachments,
        });
      }

      if (shouldQueueWrites) {
        await queueTaskAction("UPDATE_TASK", buildQueuedTaskUpdatePayload(taskId, updateData));
        return {
          normalizedToInbox,
          strippedScheduledTime,
          movedFromInboxToScheduled,
          attachmentsSkippedDueToSchema,
          queued: true,
        };
      }

      const { error, fallbackUsed } = await runDailyTaskWriteWithRecurrenceFallback(
        updateData,
        (nextPayload) => supabase
          .from('daily_tasks')
          .update(nextPayload)
          .eq('id', remoteTaskId)
          .eq('user_id', user.id),
      );

      if (fallbackUsed) {
        console.warn('daily_tasks update retried without month recurrence columns due to schema drift');
      }

      if (error) throw error;

      if (hasAttachmentUpdates) {
        const attachmentPersistResult = await persistTaskAttachments(remoteTaskId, updates.attachments ?? []);
        attachmentsSkippedDueToSchema = attachmentPersistResult.attachmentsSkippedDueToSchema;
      }

      return {
        normalizedToInbox,
        strippedScheduledTime,
        movedFromInboxToScheduled,
        attachmentsSkippedDueToSchema,
        queued: false,
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      if (data?.queued) {
        toast({
          title: "Quest update queued",
          description: "We'll sync this change when connection is restored.",
        });
        return;
      }

      if (data?.attachmentsSkippedDueToSchema) {
        showAttachmentsUnavailableToast();
      }

      const definedFields = Object.entries(variables.updates)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const isScheduledTimeOnlyUpdate = definedFields.length === 1 && definedFields[0] === 'scheduled_time';

      if (data?.normalizedToInbox) {
        toast({
          title: "Moved to Inbox",
          description: "Regular quests without a time are kept in Inbox.",
        });
        return;
      }

      if (data?.movedFromInboxToScheduled) {
        toast({
          title: "Moved to Quests",
          description: "Added a time, so this quest is now scheduled in Quests.",
        });
        return;
      }

      if (!isScheduledTimeOnlyUpdate) {
        toast({ title: "Quest updated!" });
      }
    },
    onError: (error: Error, variables: TaskUpdateVariables) => {
      if (isQueueableWriteError(error)) {
        reportApiFailure(error, { source: "task_update_onError" });
        void queueTaskAction("UPDATE_TASK", buildQueuedTaskUpdatePayload(variables.taskId, variables.updates));

        toast({
          title: "Quest update queued",
          description: "We'll sync this change when connection is restored.",
        });
        return;
      }

      reportApiFailure(error, { source: "task_update_onError_nonqueueable" });
      toast({
        title: "Failed to update quest",
        description: getTaskMutationErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (reorderedTasks: { id: string; sort_order: number }[]) => {
      if (!user?.id) throw new Error('User not authenticated');

      for (const task of reorderedTasks) {
        const localTask = await getLocalTaskRecord(task.id);
        if (localTask) {
          await persistLocalTaskRow({
            ...localTask,
            sort_order: task.sort_order,
          });
        }
      }

      if (shouldQueueWrites) {
        await Promise.all(
          reorderedTasks.map((task) =>
            queueTaskAction("UPDATE_TASK", {
              taskId: task.id,
              updates: { sort_order: task.sort_order },
            }),
          ),
        );
        return { queued: true };
      }

      // Update all tasks with their new sort order
      for (const task of reorderedTasks) {
        const remoteTaskId = getRemoteTaskId(task.id);
        const { error } = await supabase
          .from('daily_tasks')
          .update({ sort_order: task.sort_order })
          .eq('id', remoteTaskId)
          .eq('user_id', user.id);

        if (error) {
          await queueTaskAction("UPDATE_TASK", {
            taskId: task.id,
            updates: { sort_order: task.sort_order },
          });
        }
      }
      return { queued: false };
    },
    onMutate: async (reorderedTasks: { id: string; sort_order: number }[]) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['calendar-tasks'] });

      // Snapshot previous values for rollback
      const previousDailyTasks = queryClient.getQueriesData({ queryKey: ['daily-tasks'] });
      const previousCalendarTasks = queryClient.getQueriesData({ queryKey: ['calendar-tasks'] });

      // Create a map of new sort orders
      const sortOrderMap = new Map(reorderedTasks.map(t => [t.id, t.sort_order]));

      // Optimistically update all daily-tasks queries
      queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [...old]
          .map(task => ({
            ...task,
            sort_order: sortOrderMap.has(task.id) 
              ? sortOrderMap.get(task.id) 
              : task.sort_order
          }))
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      });

      // Optimistically update all calendar-tasks queries
      queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [...old]
          .map(task => ({
            ...task,
            sort_order: sortOrderMap.has(task.id) 
              ? sortOrderMap.get(task.id) 
              : task.sort_order
          }))
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      });

      return { previousDailyTasks, previousCalendarTasks };
    },
    onError: (error: Error, _params, context) => {
      // Rollback to previous state on error
      if (context?.previousDailyTasks) {
        context.previousDailyTasks.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCalendarTasks) {
        context.previousCalendarTasks.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to reorder quests", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      // Sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Move task to a different time section
  const moveTaskToSection = useMutation({
    mutationFn: async ({ taskId, targetSection }: {
      taskId: string;
      targetSection: 'morning' | 'afternoon' | 'evening' | 'unscheduled';
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const remoteTaskId = getRemoteTaskId(taskId);
      const localTask = await getLocalTaskRecord(taskId);
      
      // Map section to scheduled_time
      const sectionTimeMap: Record<string, string | null> = {
        morning: '09:00',
        afternoon: '14:00',
        evening: '19:00',
        unscheduled: null,
      };

      const newTime = sectionTimeMap[targetSection];
      const existingScheduling = await fetchTaskSchedulingState(taskId);
      const normalizedScheduling = normalizeTaskSchedulingUpdate(existingScheduling, {
        scheduled_time: newTime,
      });

      const updateData: Record<string, unknown> = {
        task_date: normalizedScheduling.task_date,
        scheduled_time: normalizedScheduling.scheduled_time,
        sort_order: 0, // Place at top of new section
      };

      if (normalizedScheduling.source !== existingScheduling.source) {
        updateData.source = normalizedScheduling.source;
      }

      if (localTask) {
        await persistLocalTaskRow({
          ...localTask,
          ...(updateData as Partial<DailyTask>),
        });
      }

      if (shouldQueueWrites) {
        await queueTaskAction("UPDATE_TASK", {
          taskId,
          updates: updateData,
        });
        return { ...normalizedScheduling, queued: true };
      }

      const { error } = await supabase
        .from('daily_tasks')
        .update(updateData)
        .eq('id', remoteTaskId)
        .eq('user_id', user.id);

      if (error) {
        await queueTaskAction("UPDATE_TASK", {
          taskId,
          updates: updateData,
        });
        return { ...normalizedScheduling, queued: true };
      }
      return { ...normalizedScheduling, queued: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      if (data?.queued) {
        toast({
          title: "Quest move queued",
          description: "We'll sync this move when connection is restored.",
        });
      }
      if (data?.normalizedToInbox) {
        toast({
          title: "Moved to Inbox",
          description: "Regular quests without a time are kept in Inbox.",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to move quest", description: error.message, variant: "destructive" });
    },
  });

  // Move task to a different date (cross-day drag)
  const moveTaskToDate = useMutation({
    mutationFn: async ({ taskId, targetDate }: {
      taskId: string;
      targetDate: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      const remoteTaskId = getRemoteTaskId(taskId);
      const localTask = await getLocalTaskRecord(taskId);
      const existingScheduling = await fetchTaskSchedulingState(taskId);
      const normalizedScheduling = normalizeTaskSchedulingUpdate(existingScheduling, {
        task_date: targetDate,
      });

      const updateData: Record<string, unknown> = {
        task_date: normalizedScheduling.task_date,
        scheduled_time: normalizedScheduling.scheduled_time,
        sort_order: 0,
      };

      if (normalizedScheduling.source !== existingScheduling.source) {
        updateData.source = normalizedScheduling.source;
      }

      if (localTask) {
        await persistLocalTaskRow({
          ...localTask,
          ...(updateData as Partial<DailyTask>),
        });
      }

      if (shouldQueueWrites) {
        await queueTaskAction("UPDATE_TASK", {
          taskId,
          updates: updateData,
        });
        return {
          taskId,
          targetDate: normalizedScheduling.task_date,
          normalizedToInbox: normalizedScheduling.normalizedToInbox,
          queued: true,
        };
      }

      const { error } = await supabase
        .from('daily_tasks')
        .update(updateData)
        .eq('id', remoteTaskId)
        .eq('user_id', user.id);

      if (error) {
        await queueTaskAction("UPDATE_TASK", {
          taskId,
          updates: updateData,
        });
        return {
          taskId,
          targetDate: normalizedScheduling.task_date,
          normalizedToInbox: normalizedScheduling.normalizedToInbox,
          queued: true,
        };
      }
      return {
        taskId,
        targetDate: normalizedScheduling.task_date,
        normalizedToInbox: normalizedScheduling.normalizedToInbox,
        queued: false,
      };
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['calendar-tasks'] });

      // Snapshot previous values
      const previousDaily = queryClient.getQueriesData({ queryKey: ['daily-tasks'] });
      const previousCalendar = queryClient.getQueriesData({ queryKey: ['calendar-tasks'] });

      return { previousDaily, previousCalendar };
    },
    onError: (error: Error, _vars, context) => {
      // Rollback on error
      if (context?.previousDaily) {
        context.previousDaily.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      if (context?.previousCalendar) {
        context.previousCalendar.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast({ title: "Failed to move quest", description: error.message, variant: "destructive" });
    },
    onSuccess: (data) => {
      if (data?.queued) {
        toast({
          title: "Quest move queued",
          description: "We'll sync this move when connection is restored.",
        });
      }
      if (data?.normalizedToInbox) {
        toast({
          title: "Moved to Inbox",
          description: "Regular quests without a time are kept in Inbox.",
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  return {
    addTask: addTask.mutateAsync,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutateAsync,
    restoreTask: restoreTask.mutateAsync,
    setMainQuest: setMainQuest.mutate,
    updateTask: updateTask.mutateAsync,
    reorderTasks: reorderTasks.mutate,
    moveTaskToSection: moveTaskToSection.mutate,
    moveTaskToDate: moveTaskToDate.mutate,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    isDeleting: deleteTask.isPending,
    isRestoring: restoreTask.isPending,
    isUpdating: updateTask.isPending,
    isReordering: reorderTasks.isPending,
    isMoving: moveTaskToSection.isPending,
    isMovingDate: moveTaskToDate.isPending,
  };
};
