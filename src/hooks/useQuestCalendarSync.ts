import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NativeCalendar } from '@/plugins/NativeCalendarPlugin';
import { useCalendarIntegrations, type CalendarProvider, type ConnectedCalendar } from '@/hooks/useCalendarIntegrations';
import { parseScheduledTime } from '@/utils/scheduledTime';

export interface QuestCalendarLink {
  id: string;
  task_id: string;
  user_id: string;
  connection_id: string;
  provider: CalendarProvider;
  external_calendar_id: string | null;
  external_event_id: string;
  sync_mode: 'send_only' | 'full_sync';
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
  location: string | null;
  notes: string | null;
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

export function useQuestCalendarSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { connections, defaultProvider } = useCalendarIntegrations();

  const linksQuery = useQuery({
    queryKey: ['quest-calendar-links', user?.id],
    enabled: !!user?.id,
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

  const getProviderConnection = (provider: CalendarProvider): ConnectedCalendar | null => {
    return connections.find((connection) => connection.provider === provider) || null;
  };

  const resolveProvider = (provider?: CalendarProvider): CalendarProvider => {
    if (provider) return provider;
    if (defaultProvider) return defaultProvider;
    const first = connections[0]?.provider;
    if (!first) throw new Error('NO_CALENDAR_CONNECTION');
    return first;
  };

  const fetchTask = async (taskId: string): Promise<TaskLite> => {
    if (!user?.id) throw new Error('User not authenticated');
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('id, task_text, task_date, scheduled_time, estimated_duration, location, notes')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) throw new Error('Task not found');
    return data as TaskLite;
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

  const sendTaskToCalendar = useMutation({
    mutationFn: async ({ taskId, options }: { taskId: string; options?: SendOptions }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const provider = resolveProvider(options?.provider);
      const connection = getProviderConnection(provider);
      if (!connection) throw new Error('NO_CALENDAR_CONNECTION');

      if (options) {
        await applyTaskTimingOverride(taskId, options);
      }

      const task = await fetchTask(taskId);

      if (!task.task_date) {
        throw new Error('TASK_DATE_REQUIRED');
      }

      if (!task.scheduled_time) {
        throw new Error('SCHEDULED_TIME_REQUIRED');
      }

      const existingLink = (linksByTask.get(taskId) || []).find((link) => link.provider === provider);

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
          eventId: existingLink?.external_event_id,
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
              sync_mode: connection.sync_mode,
              last_app_sync_at: nowIso,
              last_provider_sync_at: nowIso,
            },
            { onConflict: 'task_id,connection_id' },
          );

        if (error) throw error;
        return;
      }

      const functionName = `${provider}-calendar-events`;
      const action = existingLink ? 'updateLinkedEvent' : 'createLinkedEvent';
      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          action,
          taskId,
          syncMode: connection.sync_mode,
        },
      });

      if (error) throw new Error(error.message || `Failed to send task to ${provider}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] }),
      ]);
    },
  });

  const syncTaskUpdate = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const taskLinks = (linksByTask.get(taskId) || []).filter((link) => link.sync_mode === 'full_sync');
      if (taskLinks.length === 0) return;

      const task = await fetchTask(taskId);
      if (!task.task_date || !task.scheduled_time) {
        return;
      }

      for (const link of taskLinks) {
        if (link.provider === 'apple') {
          const connection = getProviderConnection('apple');
          if (!connection?.primary_calendar_id) continue;

          const range = toIsoRange(task);
          const { eventId } = await NativeCalendar.createOrUpdateEvent({
            calendarId: link.external_calendar_id || connection.primary_calendar_id,
            eventId: link.external_event_id,
            title: task.task_text,
            notes: task.notes,
            location: task.location,
            startDate: range.startDate,
            endDate: range.endDate,
            isAllDay: false,
          });

          await supabase
            .from('quest_calendar_links')
            .update({
              external_event_id: eventId,
              last_app_sync_at: new Date().toISOString(),
            })
            .eq('id', link.id)
            .eq('user_id', user.id);

          continue;
        }

        const functionName = `${link.provider}-calendar-events`;
        const { error } = await supabase.functions.invoke(functionName, {
          body: {
            action: 'updateLinkedEvent',
            taskId,
          },
        });

        if (error) throw new Error(error.message || `Failed full sync update for ${link.provider}`);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] });
    },
  });

  const syncTaskDelete = useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const taskLinks = (linksByTask.get(taskId) || []).filter((link) => link.sync_mode === 'full_sync');
      if (taskLinks.length === 0) return;

      for (const link of taskLinks) {
        if (link.provider === 'apple') {
          await NativeCalendar.deleteEvent({ eventId: link.external_event_id }).catch(() => null);
          await supabase.from('quest_calendar_links').delete().eq('id', link.id).eq('user_id', user.id);
          continue;
        }

        const functionName = `${link.provider}-calendar-events`;
        await supabase.functions.invoke(functionName, {
          body: {
            action: 'deleteLinkedEvent',
            taskId,
          },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] });
    },
  });

  const syncProviderPull = useMutation({
    mutationFn: async ({ provider }: { provider: Exclude<CalendarProvider, 'apple'> }) => {
      const functionName = `${provider}-calendar-events`;
      const { error } = await supabase.functions.invoke(functionName, {
        body: {
          action: 'syncLinkedChanges',
        },
      });

      if (error) throw new Error(error.message || `Failed to sync ${provider} updates`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] }),
      ]);
    },
  });

  const hasLinkedEvent = (taskId: string) => (linksByTask.get(taskId) || []).length > 0;

  return {
    links,
    linksByTask,
    hasLinkedEvent,
    sendTaskToCalendar,
    syncTaskUpdate,
    syncTaskDelete,
    syncProviderPull,
  };
}
