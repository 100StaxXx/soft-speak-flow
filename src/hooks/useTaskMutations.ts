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
  const { shouldQueueWrites, queueTaskAction, reportApiFailure } = useResilience();

  const addInProgress = useRef(false);
  const showAttachmentsUnavailableToast = () => {
    toast({
      title: "Attachments unavailable",
      description: "Quest saved, but attachments could not be stored. Please try again after the backend migration finishes.",
    });
  };

  const fetchTaskSchedulingState = async (taskId: string) => {
    if (!user?.id) throw new Error('User not authenticated');

    const { data: task, error } = await supabase
      .from('daily_tasks')
      .select('task_date, scheduled_time, habit_source_id, source, recurrence_pattern')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!task) throw new Error('Task not found');

    return task;
  };

  const persistTaskAttachments = async (
    taskId: string,
    attachments: QuestAttachmentInput[],
  ): Promise<TaskAttachmentPersistResult> => {
    if (!user?.id) throw new Error('User not authenticated');

    const { error: deleteError } = await supabase
      .from('task_attachments' as any)
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    if (deleteError) {
      if (isTaskAttachmentsTableMissingError(deleteError)) {
        return { attachmentsSkippedDueToSchema: true };
      }
      throw deleteError;
    }

    if (attachments.length === 0) return emptyAttachmentPersistResult();

    const rows = attachments.map((attachment, index) => ({
      task_id: taskId,
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

      const queueCreateTask = async () => {
        const queueId = await queueTaskAction("CREATE_TASK", {
          task_text: params.taskText,
          difficulty: params.difficulty,
          xp_reward: getEffectiveQuestXP(params.difficulty, 1),
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
          source: normalizedScheduling.source ?? (normalizedScheduling.task_date === null ? 'inbox' : 'manual'),
        });

        return {
          id: "queued-" + queueId,
          task_date: normalizedScheduling.task_date,
          scheduled_time: normalizedScheduling.scheduled_time,
          task_text: params.taskText,
          difficulty: params.difficulty,
          queued: true,
          attachmentsSkippedDueToSchema: false,
        };
      };

      try {
        if (!user?.id) throw new Error('User not authenticated');
        if (shouldQueueWrites) {
          return queueCreateTask();
        }

        const effectiveDate = normalizedScheduling.task_date;
        let countQuery = supabase
          .from('daily_tasks')
          .select('id')
          .eq('user_id', user.id);

        if (effectiveDate === null) {
          countQuery = countQuery.is('task_date', null);
        } else {
          countQuery = countQuery.eq('task_date', effectiveDate);
        }

        const { data: existingTasks, error: countError } = await countQuery;

        if (countError) throw countError;

        const questPosition = (existingTasks?.length || 0) + 1;
        const xpReward = getEffectiveQuestXP(params.difficulty, questPosition);

        const insertPayload = {
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

        const { data, error, fallbackUsed } = await runDailyTaskWriteWithRecurrenceFallback(
          insertPayload,
          (nextPayload) => supabase
            .from('daily_tasks')
            .insert(nextPayload)
            .select()
            .single(),
        );

        if (fallbackUsed) {
          console.warn('daily_tasks insert retried without month recurrence columns due to schema drift');
        }

        if (error) throw error;

        let attachmentPersistResult = emptyAttachmentPersistResult();
        if (data?.id) {
          try {
            attachmentPersistResult = await persistTaskAttachments(data.id, normalizedAttachments);
          } catch (attachmentsError) {
            await supabase
              .from('daily_tasks')
              .delete()
              .eq('id', data.id)
              .eq('user_id', user.id);
            throw attachmentsError;
          }
        }

        const cleanedSubtasks = (params.subtasks || [])
          .map((title) => title.trim())
          .filter((title) => title.length > 0);

        if (cleanedSubtasks.length > 0 && data?.id) {
          const { error: subtasksError } = await supabase
            .from('subtasks')
            .insert(
              cleanedSubtasks.map((title, index) => ({
                task_id: data.id,
                user_id: user.id,
                title,
                sort_order: index,
              }))
            );

          if (subtasksError) {
            // Best-effort rollback to keep create behavior predictable.
            await supabase
              .from('daily_tasks')
              .delete()
              .eq('id', data.id)
              .eq('user_id', user.id);
            throw subtasksError;
          }
        }

        return {
          ...(data ?? {}),
          attachmentsSkippedDueToSchema: attachmentPersistResult.attachmentsSkippedDueToSchema,
        };
      } catch (error) {
        if (isQueueableWriteError(error)) {
          reportApiFailure(error, { source: "task_add" });
          return queueCreateTask();
        }

        reportApiFailure(error, { source: "task_add_nonqueueable" });
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
      if ((data as { queued?: boolean } | undefined)?.queued) {
        toast({
          title: "Quest queued",
          description: "We'll sync it as soon as connection is restored.",
        });
        return;
      } else {
        toast({ title: "Quest added!" });
      }
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

      if (shouldQueueWrites) {
        await queueTaskAction("COMPLETE_TASK", buildQueuedTogglePayload(variables));
        return {
          queued: true,
          taskId,
          completed,
          xpAwarded: 0,
          toastReason: null,
          wasAlreadyCompleted: false,
          isUndo: false,
          taskText: "Quest",
          habitSourceId: null,
          taskDifficulty: null,
          taskScheduledTime: null,
          taskCategory: null,
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
        .eq('id', taskId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const wasAlreadyCompleted = existingTask?.completed_at !== null;
      const taskText = existingTask?.task_text || 'Task';
      const habitSourceId = existingTask?.habit_source_id;
      const taskDateValue = existingTask?.task_date || format(new Date(), 'yyyy-MM-dd');
      const isMainQuest = existingTask?.is_main_quest === true;
      const storedTaskXP = Number(existingTask?.xp_reward ?? xpReward);
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
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Deduct the XP that was awarded
        if (normalizedTaskXP > 0) {
          await awardCustomXP(-normalizedTaskXP, 'task_undo', 'Quest undone', { task_id: taskId });
        }

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
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
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
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
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('completed', false)
        .select();

      if (updateError) throw updateError;
      if (!updateResult || updateResult.length === 0) {
        throw new Error('Task was already completed');
      }

      const awardResult = await awardCustomXP(totalXP, 'task_complete', toastReason, { task_id: taskId });
      const awardedXP = awardResult?.xpAwarded ?? 0;

      // If this is a habit-sourced task, sync with habit_completions
      if (habitSourceId) {
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

      if (result?.queued) {
        toast({
          title: "Quest update queued",
          description: "We'll sync this change when connection is restored.",
        });
        return;
      }

      // Also invalidate habit-related queries if this was a habit-sourced task
      if (habitSourceId) {
        queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
        queryClient.invalidateQueries({ queryKey: ['epics'] });
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
      
      if (shouldQueueWrites) {
        await queueTaskAction("DELETE_TASK", { taskId });
        return { queued: true };
      }

      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId)
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

      const { data: task, error: fetchError } = await supabase
        .from('daily_tasks')
        .select('id, user_id, task_date')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!task) throw new Error('Task not found or access denied');

      await supabase
        .from('daily_tasks')
        .update({ is_main_quest: false })
        .eq('user_id', user.id)
        .eq('task_date', taskDate);

      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ is_main_quest: true })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: "Main quest updated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update main quest", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: TaskUpdateVariables) => {
      if (!user?.id) throw new Error('User not authenticated');
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

      if (!shouldQueueWrites && (
        updates.task_date !== undefined
        || updates.scheduled_time !== undefined
        || updates.recurrence_pattern !== undefined
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
          .eq('id', taskId)
          .eq('user_id', user.id),
      );

      if (fallbackUsed) {
        console.warn('daily_tasks update retried without month recurrence columns due to schema drift');
      }

      if (error) throw error;

      if (hasAttachmentUpdates) {
        const attachmentPersistResult = await persistTaskAttachments(taskId, updates.attachments ?? []);
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

      // Update all tasks with their new sort order
      for (const task of reorderedTasks) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ sort_order: task.sort_order })
          .eq('id', task.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }
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

      const { error } = await supabase
        .from('daily_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
      return normalizedScheduling;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
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

      const { error } = await supabase
        .from('daily_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
      return {
        taskId,
        targetDate: normalizedScheduling.task_date,
        normalizedToInbox: normalizedScheduling.normalizedToInbox,
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
