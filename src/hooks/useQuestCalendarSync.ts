import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NativeCalendar } from '@/plugins/NativeCalendarPlugin';
import { useCalendarIntegrations, type CalendarProvider, type ConnectedCalendar } from '@/hooks/useCalendarIntegrations';
import { parseScheduledTime } from '@/utils/scheduledTime';
import { calendarProviderDisplayName } from '@/utils/calendarDestinationOptions';

export interface QuestCalendarLink {
  id: string;
  task_id: string;
  user_id: string;
  connection_id: string;
  provider: CalendarProvider;
  external_calendar_id: string | null;
  external_event_id: string;
  sync_mode: string;
  last_app_sync_at: string | null;
  last_provider_sync_at: string | null;
}

export interface QuestOutlookTaskLink {
  id: string;
  task_id: string;
  user_id: string;
  connection_id: string;
  provider: 'outlook';
  external_task_list_id: string;
  external_task_id: string;
  sync_mode: string;
  last_app_sync_at: string | null;
  last_provider_sync_at: string | null;
}

interface SendOptions {
  provider?: CalendarProvider;
  scheduledTime?: string;
  taskDate?: string;
  estimatedDuration?: number;
}

interface TaskLite {
  id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_month_days: number[] | null;
  recurrence_custom_period: "week" | "month" | null;
  location: string | null;
  notes: string | null;
}

interface QuestCalendarSyncOptions {
  enabled?: boolean;
}

export interface SendTaskToCalendarResult {
  provider: CalendarProvider;
  providerLabel: string;
  destinationKind: 'calendar' | 'todo';
  destinationName: string;
  externalId?: string;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const TASK_SELECT_WITH_MONTH_RECURRENCE = 'id, task_text, task_date, scheduled_time, estimated_duration, recurrence_pattern, recurrence_days, recurrence_month_days, recurrence_custom_period, location, notes';
const TASK_SELECT_LEGACY_RECURRENCE = 'id, task_text, task_date, scheduled_time, estimated_duration, recurrence_pattern, recurrence_days, location, notes';
const SEND_ONLY_SYNC_MODE = 'send_only';

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

function toIsoRange(task: TaskLite) {
  if (!task.task_date) {
    throw new Error('TASK_DATE_REQUIRED');
  }

  if (!task.scheduled_time) {
    throw new Error('SCHEDULED_TIME_REQUIRED');
  }

  const start = parseScheduledTime(task.scheduled_time, new Date(`${task.task_date}T00:00:00`));
  if (!start) {
    throw new Error('SCHEDULED_TIME_INVALID');
  }

  const minutes = task.estimated_duration && task.estimated_duration > 0
    ? task.estimated_duration
    : 30;

  const end = new Date(start.getTime() + minutes * 60_000);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function enforceCalendarRecurrenceSupport(task: TaskLite) {
  const recurrencePattern = task.recurrence_pattern?.toLowerCase() ?? null;
  const recurrenceMonthDays = Array.isArray(task.recurrence_month_days)
    ? Array.from(new Set(task.recurrence_month_days)).sort((a, b) => a - b)
    : [];
  const recurrenceCustomPeriod = task.recurrence_custom_period ?? 'week';

  const isMonthBased =
    recurrencePattern === 'monthly'
    || (recurrencePattern === 'custom' && recurrenceCustomPeriod === 'month');

  if (isMonthBased && recurrenceMonthDays.length > 1) {
    throw new Error('MULTI_DAY_MONTHLY_UNSUPPORTED');
  }
}

function shouldRouteOutlookTaskToTodo(task: Pick<TaskLite, 'task_date' | 'scheduled_time'>): boolean {
  return !task.task_date || !task.scheduled_time;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readInvokeLink(data: Record<string, unknown> | null): Record<string, unknown> {
  return data?.link && typeof data.link === 'object'
    ? data.link as Record<string, unknown>
    : {};
}

export function getCalendarSendSuccessCopy(
  result: SendTaskToCalendarResult,
  connectedProviderCount = 1,
): { title: string; description: string } {
  const title = result.destinationKind === 'todo'
    ? 'Quest sent to Microsoft To Do'
    : `Quest sent to ${result.providerLabel} Calendar`;
  const target = `${result.providerLabel} ${result.destinationKind === 'todo' ? 'To Do' : 'Calendar'} -> ${result.destinationName}`;
  const suffix = connectedProviderCount > 1
    ? ' Other connected providers are untouched.'
    : '';

  return {
    title,
    description: `Destination: ${target}.${suffix}`,
  };
}

export function useQuestCalendarSync(options: QuestCalendarSyncOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enabled = true } = options;
  const { connections, defaultProvider } = useCalendarIntegrations({ enabled });

  const linksQuery = useQuery({
    queryKey: ['quest-calendar-links', user?.id],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('quest_calendar_links')
        .select('id, task_id, user_id, connection_id, provider, external_calendar_id, external_event_id, sync_mode, last_app_sync_at, last_provider_sync_at')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as QuestCalendarLink[];
    },
  });

  const links = linksQuery.data || [];

  const linksByTask = useMemo(() => {
    const map = new Map<string, QuestCalendarLink[]>();
    for (const link of links) {
      const list = map.get(link.task_id) || [];
      list.push(link);
      map.set(link.task_id, list);
    }
    return map;
  }, [links]);

  const outlookTaskLinksQuery = useQuery({
    queryKey: ['quest-outlook-task-links', user?.id],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('quest_outlook_task_links')
        .select('id, task_id, user_id, connection_id, provider, external_task_list_id, external_task_id, sync_mode, last_app_sync_at, last_provider_sync_at')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as QuestOutlookTaskLink[];
    },
  });

  const outlookTaskLinks = outlookTaskLinksQuery.data || [];

  const outlookTaskLinksByTask = useMemo(() => {
    const map = new Map<string, QuestOutlookTaskLink[]>();
    for (const link of outlookTaskLinks) {
      const list = map.get(link.task_id) || [];
      list.push(link);
      map.set(link.task_id, list);
    }
    return map;
  }, [outlookTaskLinks]);

  const getProviderConnection = (provider: CalendarProvider): ConnectedCalendar | null => {
    return connections.find((connection) => connection.provider === provider) || null;
  };

  const invalidateSyncQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] }),
      queryClient.invalidateQueries({ queryKey: ['quest-outlook-task-links'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] }),
    ]);
  };

  const resolveProvider = (provider?: CalendarProvider): CalendarProvider => {
    if (provider) {
      if (!getProviderConnection(provider)) {
        throw new Error('NO_CALENDAR_CONNECTION');
      }
      return provider;
    }
    if (defaultProvider && getProviderConnection(defaultProvider)) {
      return defaultProvider;
    }
    if (connections.length > 1) {
      throw new Error('CALENDAR_DEFAULT_REQUIRED');
    }
    const first = connections[0]?.provider;
    if (!first) throw new Error('NO_CALENDAR_CONNECTION');
    return first;
  };

  const fetchTask = async (taskId: string): Promise<TaskLite> => {
    if (!user?.id) throw new Error('User not authenticated');
    const queryTask = (selectClause: string) => supabase
      .from('daily_tasks')
      .select(selectClause)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();
    let { data, error } = await queryTask(TASK_SELECT_WITH_MONTH_RECURRENCE);

    if (isDailyTasksRecurrenceColumnsMissingError(error)) {
      const fallback = await queryTask(TASK_SELECT_LEGACY_RECURRENCE);
      const fallbackData = fallback.data as unknown as Record<string, unknown> | null;
      data = fallbackData ? ({
        ...fallbackData,
        recurrence_month_days: null,
        recurrence_custom_period: null,
      } as unknown as typeof data) : null;
      error = fallback.error;
    }

    if (error || !data) throw new Error('Task not found');
    return data as unknown as TaskLite;
  };

  const applyTaskTimingOverride = async (taskId: string, options: SendOptions) => {
    if (!user?.id) throw new Error('User not authenticated');

    const patch: Record<string, unknown> = {};
    if (options.taskDate !== undefined) patch.task_date = options.taskDate;
    if (options.scheduledTime !== undefined) patch.scheduled_time = options.scheduledTime;
    if (options.estimatedDuration !== undefined) patch.estimated_duration = options.estimatedDuration;

    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from('daily_tasks')
      .update(patch)
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) throw error;
  };

  const invokeCalendarFunction = async (
    functionName: string,
    body: Record<string, unknown>,
    fallbackMessage: string,
  ) => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(error.message || fallbackMessage);
    return data as Record<string, unknown> | null;
  };

  const syncOutlookRoutedTask = async ({
    taskId,
    task,
    connection,
    existingCalendarLink,
    existingOutlookTaskLink,
  }: {
    taskId: string;
    task: TaskLite;
    connection: ConnectedCalendar;
    existingCalendarLink?: QuestCalendarLink;
    existingOutlookTaskLink?: QuestOutlookTaskLink;
  }): Promise<SendTaskToCalendarResult> => {
    if (shouldRouteOutlookTaskToTodo(task)) {
      if (existingCalendarLink) {
        await invokeCalendarFunction(
          'outlook-calendar-events',
          {
            action: 'deleteLinkedEvent',
            taskId,
          },
          'Failed to remove Outlook calendar event before moving task to Microsoft To Do',
        );
      }

      const data = await invokeCalendarFunction(
        'outlook-todo-tasks',
          {
            action: existingOutlookTaskLink ? 'updateLinkedTask' : 'createLinkedTask',
            taskId,
            syncMode: SEND_ONLY_SYNC_MODE,
          },
        'Failed to sync task to Outlook To Do',
      );
      const link = readInvokeLink(data);
      return {
        provider: 'outlook',
        providerLabel: calendarProviderDisplayName('outlook'),
        destinationKind: 'todo',
        destinationName:
          connection.primary_task_list_name
          || readString(link.externalTaskListId)
          || 'Tasks',
        externalId: readString(link.externalTaskId),
      };
    }

    if (existingOutlookTaskLink) {
      await invokeCalendarFunction(
        'outlook-todo-tasks',
        {
          action: 'deleteLinkedTask',
          taskId,
        },
        'Failed to remove Outlook To Do task before moving task to Outlook Calendar',
      );
    }

    const data = await invokeCalendarFunction(
      'outlook-calendar-events',
      {
        action: existingCalendarLink ? 'updateLinkedEvent' : 'createLinkedEvent',
        taskId,
        syncMode: SEND_ONLY_SYNC_MODE,
      },
      'Failed to sync task to Outlook Calendar',
    );
    const link = readInvokeLink(data);
    return {
      provider: 'outlook',
      providerLabel: calendarProviderDisplayName('outlook'),
      destinationKind: 'calendar',
      destinationName:
        connection.primary_calendar_name
        || readString(link.externalCalendarId)
        || 'Calendar',
      externalId: readString(link.externalEventId),
    };
  };

  const sendTask = async ({ taskId, options }: { taskId: string; options?: SendOptions }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const provider = resolveProvider(options?.provider);
      const connection = getProviderConnection(provider);
      if (!connection) throw new Error('NO_CALENDAR_CONNECTION');

      if (options) {
        await applyTaskTimingOverride(taskId, options);
      }

      const task = await fetchTask(taskId);
      enforceCalendarRecurrenceSupport(task);
      const existingCalendarLink = (linksByTask.get(taskId) || []).find((link) => link.provider === provider);
      const existingOutlookTaskLink = (outlookTaskLinksByTask.get(taskId) || []).find((link) => link.provider === 'outlook');
      if (provider === 'outlook') {
        return await syncOutlookRoutedTask({
          taskId,
          task,
          connection,
          existingCalendarLink,
          existingOutlookTaskLink,
        });
      }

      if (!task.task_date) {
        throw new Error('TASK_DATE_REQUIRED');
      }

      if (!task.scheduled_time) {
        throw new Error('SCHEDULED_TIME_REQUIRED');
      }

      if (provider === 'apple') {
        const available = await NativeCalendar.isAvailable();
        if (!available.available) {
          throw new Error('Apple Calendar is only available on iOS native builds');
        }

        const permission = await NativeCalendar.requestPermissions();
        if (!permission.granted) {
          throw new Error('Calendar permission not granted');
        }

        const primaryCalendarId = connection.primary_calendar_id;
        if (!primaryCalendarId) {
          throw new Error('No primary Apple calendar selected');
        }

        const range = toIsoRange(task);
        const { eventId } = await NativeCalendar.createOrUpdateEvent({
          calendarId: primaryCalendarId,
          eventId: existingCalendarLink?.external_event_id,
          title: task.task_text,
          notes: task.notes,
          location: task.location,
          startDate: range.startDate,
          endDate: range.endDate,
          isAllDay: false,
        });

        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from('quest_calendar_links')
          .upsert(
            {
              user_id: user.id,
              task_id: task.id,
              connection_id: connection.id,
              provider: 'apple',
              external_calendar_id: primaryCalendarId,
              external_event_id: eventId,
              sync_mode: SEND_ONLY_SYNC_MODE,
              last_app_sync_at: nowIso,
              last_provider_sync_at: nowIso,
            },
            { onConflict: 'task_id,connection_id' },
          );

        if (error) throw error;
        return {
          provider: 'apple',
          providerLabel: calendarProviderDisplayName('apple'),
          destinationKind: 'calendar',
          destinationName: connection.primary_calendar_name || primaryCalendarId,
          externalId: eventId,
        } satisfies SendTaskToCalendarResult;
      }

      const functionName = `${provider}-calendar-events`;
      const action = existingCalendarLink ? 'updateLinkedEvent' : 'createLinkedEvent';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          action,
          taskId,
          syncMode: SEND_ONLY_SYNC_MODE,
        },
      });

      if (error) throw new Error(error.message || `Failed to send task to ${provider}`);
      const link = readInvokeLink((data ?? null) as Record<string, unknown> | null);
      return {
        provider,
        providerLabel: calendarProviderDisplayName(provider),
        destinationKind: 'calendar',
        destinationName:
          connection.primary_calendar_name
          || readString(link.externalCalendarId)
          || (provider === 'google' ? 'Primary calendar' : 'Calendar'),
        externalId: readString(link.externalEventId),
      } satisfies SendTaskToCalendarResult;
  };

  const sendTaskToCalendar = useMutation({
    mutationFn: sendTask,
    onSuccess: invalidateSyncQueries,
  });

  const removeProviderCalendarLinks = async (taskId: string, provider: CalendarProvider) => {
    if (!user?.id) throw new Error('User not authenticated');

    if (provider === 'google' || provider === 'outlook') {
      await invokeCalendarFunction(
        `${provider}-calendar-events`,
        { action: 'deleteLinkedEvent', taskId },
        `Failed to remove linked ${calendarProviderDisplayName(provider)} calendar event`,
      );
      return;
    }

    const appleLinks = (linksByTask.get(taskId) || []).filter((link) => link.provider === 'apple');
    for (const link of appleLinks) {
      await NativeCalendar.deleteEvent({ eventId: link.external_event_id });
    }
    if (appleLinks.length === 0) return;

    const { error } = await supabase
      .from('quest_calendar_links')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .eq('provider', 'apple');
    if (error) throw error;
  };

  const syncLinkedTask = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      const providers = Array.from(new Set<CalendarProvider>([
        ...(linksByTask.get(taskId) || []).map((link) => link.provider),
        ...(outlookTaskLinksByTask.get(taskId) || []).map(() => 'outlook' as const),
      ]));

      const results: SendTaskToCalendarResult[] = [];
      for (const provider of providers) {
        try {
          results.push(await sendTask({ taskId, options: { provider } }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isNoLongerCalendarReady = provider !== 'outlook'
            && (
              message.includes('TASK_DATE_REQUIRED')
              || message.includes('SCHEDULED_TIME_REQUIRED')
              || message.includes('SCHEDULED_TIME_INVALID')
            );

          if (!isNoLongerCalendarReady) throw error;
          await removeProviderCalendarLinks(taskId, provider);
        }
      }
      return results;
    },
    onSuccess: invalidateSyncQueries,
  });

  const removeTaskFromCalendars = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const taskCalendarLinks = linksByTask.get(taskId) || [];
      const taskOutlookLinks = outlookTaskLinksByTask.get(taskId) || [];
      const providers = new Set(taskCalendarLinks.map((link) => link.provider));

      if (providers.has('google')) {
        await removeProviderCalendarLinks(taskId, 'google');
      }

      if (providers.has('outlook')) {
        await removeProviderCalendarLinks(taskId, 'outlook');
      }

      if (providers.has('apple')) {
        await removeProviderCalendarLinks(taskId, 'apple');
      }

      if (taskOutlookLinks.length > 0) {
        await invokeCalendarFunction(
          'outlook-todo-tasks',
          { action: 'deleteLinkedTask', taskId },
          'Failed to remove linked Microsoft To Do task',
        );
      }
    },
    onSuccess: invalidateSyncQueries,
  });

  const hasLinkedEvent = (taskId: string) =>
    (linksByTask.get(taskId) || []).length > 0 || (outlookTaskLinksByTask.get(taskId) || []).length > 0;

  return {
    links,
    linksByTask,
    outlookTaskLinks,
    outlookTaskLinksByTask,
    hasLinkedEvent,
    sendTaskToCalendar,
    syncLinkedTask,
    removeTaskFromCalendars,
  };
}
