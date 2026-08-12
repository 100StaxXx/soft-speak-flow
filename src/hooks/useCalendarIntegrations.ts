import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NativeCalendar } from '@/plugins/NativeCalendarPlugin';
import { parseFunctionInvokeError, toUserFacingFunctionError } from '@/utils/supabaseFunctionErrors';
import { toUserFacingCalendarOAuthError } from '@/utils/calendarOAuthErrors';
import { parseCalendarOAuthUrl } from '@/utils/calendarOAuthUrl';

export type CalendarProvider = 'google' | 'outlook' | 'apple';
export type CalendarSyncMode = 'send_only';
export type CalendarOAuthSource = 'web' | 'native';

export interface ConnectedCalendar {
  id: string;
  provider: CalendarProvider;
  calendar_email: string | null;
  primary_calendar_id: string | null;
  primary_calendar_name: string | null;
  primary_task_list_id: string | null;
  primary_task_list_name: string | null;
  sync_mode: CalendarSyncMode;
  sync_enabled: boolean | null;
  platform: 'web' | 'ios';
  last_synced_at: string | null;
}

interface CalendarUserSettings {
  user_id: string;
  integration_visible: boolean;
  nudge_dismissed_at: string | null;
  default_provider: CalendarProvider | null;
}

interface ProviderCalendarOption {
  id: string;
  name: string;
  isPrimary?: boolean;
}

interface ProviderTaskListOption {
  id: string;
  name: string;
  isPrimary?: boolean;
}

interface CalendarIntegrationsOptions {
  enabled?: boolean;
}

const providerToFunction = (provider: CalendarProvider) => `${provider}-calendar-auth`;
const SEND_ONLY_SYNC_MODE: CalendarSyncMode = 'send_only';

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
const APP_UPDATE_REQUIRED_MESSAGE = 'This app build needs an update to enable Apple Calendar.';

function isPluginAvailable(pluginName: string): boolean {
  const maybeChecker = (Capacitor as { isPluginAvailable?: (name: string) => boolean }).isPluginAvailable;
  return typeof maybeChecker === 'function' ? maybeChecker(pluginName) : false;
}

async function toCalendarInvokeError(args: {
  provider: Exclude<CalendarProvider, 'apple'>;
  action: string;
  error: unknown;
}): Promise<Error> {
  const { provider, action, error } = args;
  const parsed = await parseFunctionInvokeError(error);

  if (action === 'connect your calendar' || action === 'start calendar connection') {
    return new Error(toUserFacingCalendarOAuthError(provider, parsed));
  }

  return new Error(toUserFacingFunctionError(parsed, { action }));
}

export function useCalendarIntegrations(options: CalendarIntegrationsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enabled = true } = options;
  const applePluginAvailable = isNativeIOS() && isPluginAvailable('NativeCalendar');
  const canConnectAppleNative = isNativeIOS() && applePluginAvailable;
  const appleNativeUnavailableReason = canConnectAppleNative ? null : APP_UPDATE_REQUIRED_MESSAGE;

  const settingsQuery = useQuery({
    queryKey: ['calendar-user-settings', user?.id],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('calendar_user_settings')
        .select('user_id, integration_visible, nudge_dismissed_at, default_provider')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as CalendarUserSettings | null;
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ['calendar-connections', user?.id],
    enabled: enabled && !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_calendar_connections')
        .select(
          'id, provider, calendar_email, primary_calendar_id, primary_calendar_name, primary_task_list_id, primary_task_list_name, sync_mode, sync_enabled, platform, last_synced_at',
        )
        .eq('user_id', user.id)
        .eq('sync_enabled', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data || []) as unknown as ConnectedCalendar[]).map((connection) => ({
        ...connection,
        sync_mode: SEND_ONLY_SYNC_MODE,
      }));
    },
  });

  const settings = settingsQuery.data;
  const connections = connectionsQuery.data || [];

  const connectedByProvider = useMemo(() => {
    const map: Partial<Record<CalendarProvider, ConnectedCalendar>> = {};
    for (const connection of connections) {
      map[connection.provider] = connection;
    }
    return map;
  }, [connections]);

  const defaultProvider = (settings?.default_provider || null) as CalendarProvider | null;
  const integrationVisible = settings?.integration_visible ?? false;

  const refreshCalendarIntegrations = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar-user-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] }),
      queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] }),
      queryClient.invalidateQueries({ queryKey: ['quest-outlook-task-links'] }),
      queryClient.invalidateQueries({ queryKey: ['external-calendar-events'] }),
    ]);
  }, [queryClient]);

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<CalendarUserSettings>) => {
      if (!user?.id) throw new Error('User not authenticated');

      const payload: Record<string, unknown> = {
        user_id: user.id,
        integration_visible: integrationVisible,
        default_provider: defaultProvider,
        ...updates,
      };

      const { error } = await supabase
        .from('calendar_user_settings')
        .upsert(payload as never, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: refreshCalendarIntegrations,
  });

  const beginOAuthConnection = useMutation({
    mutationFn: async ({
      provider,
      redirectUri,
      source = 'web',
    }: {
      provider: Exclude<CalendarProvider, 'apple'>;
      redirectUri: string;
      syncMode?: CalendarSyncMode;
      source?: CalendarOAuthSource;
    }) => {
      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'getAuthUrl', redirectUri, syncMode: SEND_ONLY_SYNC_MODE, source },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'start calendar connection',
          error,
        });
      }

      return parseCalendarOAuthUrl(data);
    },
  });

  const completeOAuthConnection = useMutation({
    mutationFn: async ({
      provider,
      code,
      redirectUri,
      state,
    }: {
      provider: Exclude<CalendarProvider, 'apple'>;
      code: string;
      redirectUri: string;
      syncMode?: CalendarSyncMode;
      state?: string;
    }) => {
      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'exchangeCode', code, redirectUri, syncMode: SEND_ONLY_SYNC_MODE, state },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'connect your calendar',
          error,
        });
      }

      return data;
    },
    onSuccess: refreshCalendarIntegrations,
  });

  const disconnectProvider = useMutation({
    mutationFn: async (provider: CalendarProvider) => {
      if (provider === 'apple') {
        if (!user?.id) throw new Error('User not authenticated');
        const { error } = await supabase
          .from('user_calendar_connections')
          .delete()
          .eq('user_id', user.id)
          .eq('provider', 'apple');
        if (error) throw error;
        return;
      }

      const fn = providerToFunction(provider);
      const { error } = await supabase.functions.invoke(fn, {
        body: { action: 'disconnect' },
      });
      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'disconnect your calendar',
          error,
        });
      }
    },
    onSuccess: refreshCalendarIntegrations,
  });

  const listProviderCalendars = useMutation({
    mutationFn: async (provider: CalendarProvider): Promise<ProviderCalendarOption[]> => {
      if (provider === 'apple') {
        if (!canConnectAppleNative) {
          throw new Error(appleNativeUnavailableReason ?? APP_UPDATE_REQUIRED_MESSAGE);
        }

        const available = await NativeCalendar.isAvailable();
        if (!available.available) return [];

        const permission = await NativeCalendar.requestPermissions();
        if (!permission.granted) return [];

        const { calendars } = await NativeCalendar.listCalendars();
        return calendars.map((calendar) => ({
          id: calendar.id,
          name: calendar.title,
          isPrimary: calendar.isPrimary,
        }));
      }

      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'listCalendars' },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'list calendars',
          error,
        });
      }

      const calendars = Array.isArray(data?.calendars) ? data.calendars : [];
      return calendars.map((calendar: Record<string, unknown>) => ({
        id: String(calendar.id),
        name: String(calendar.summary || calendar.name || calendar.id),
        isPrimary: Boolean(calendar.primary || calendar.isDefaultCalendar),
      }));
    },
  });

  const setPrimaryCalendar = useMutation({
    mutationFn: async ({
      provider,
      calendarId,
      calendarName,
    }: {
      provider: CalendarProvider;
      calendarId: string;
      calendarName?: string;
    }) => {
      if (!calendarId) throw new Error('calendarId is required');

      if (provider === 'apple') {
        if (!user?.id) throw new Error('User not authenticated');
        const { error } = await supabase
          .from('user_calendar_connections')
          .update({
            primary_calendar_id: calendarId,
            primary_calendar_name: calendarName ?? calendarId,
            calendar_id: calendarId,
          })
          .eq('user_id', user.id)
          .eq('provider', 'apple');
        if (error) throw error;
        return;
      }

      const fn = providerToFunction(provider);
      const { error } = await supabase.functions.invoke(fn, {
        body: {
          action: 'setPrimaryCalendar',
          calendarId,
          calendarName,
        },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'set a primary calendar',
          error,
        });
      }
    },
    onSuccess: refreshCalendarIntegrations,
  });

  const listProviderTaskLists = useMutation({
    mutationFn: async (provider: Extract<CalendarProvider, 'outlook'>): Promise<ProviderTaskListOption[]> => {
      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'listTaskLists' },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'list task lists',
          error,
        });
      }

      const taskLists = Array.isArray(data?.taskLists)
        ? data.taskLists
        : Array.isArray(data?.task_lists)
          ? data.task_lists
          : [];

      return taskLists.map((taskList: Record<string, unknown>) => ({
        id: String(taskList.id),
        name: String(taskList.displayName || taskList.name || taskList.id),
        isPrimary: Boolean(taskList.isDefaultTaskList || taskList.isPrimary),
      }));
    },
  });

  const setPrimaryTaskList = useMutation({
    mutationFn: async ({ taskListId, taskListName }: { taskListId: string; taskListName?: string }) => {
      if (!taskListId) throw new Error('taskListId is required');

      const provider: Extract<CalendarProvider, 'outlook'> = 'outlook';
      const fn = providerToFunction(provider);
      const { error } = await supabase.functions.invoke(fn, {
        body: {
          action: 'setPrimaryTaskList',
          taskListId,
          taskListName,
        },
      });

      if (error) {
        throw await toCalendarInvokeError({
          provider,
          action: 'set a primary task list',
          error,
        });
      }
    },
    onSuccess: refreshCalendarIntegrations,
  });

  const connectAppleNative = useMutation({
    mutationFn: async (_variables?: { syncMode?: CalendarSyncMode }) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!isNativeIOS()) throw new Error('Apple Calendar is only available on iOS native');
      if (!canConnectAppleNative) throw new Error(appleNativeUnavailableReason ?? APP_UPDATE_REQUIRED_MESSAGE);

      const available = await NativeCalendar.isAvailable();
      if (!available.available) throw new Error('Native Apple Calendar plugin unavailable');

      const permission = await NativeCalendar.requestPermissions();
      if (!permission.granted) {
        throw new Error('Calendar permission not granted');
      }

      const { calendars } = await NativeCalendar.listCalendars();
      const primary = calendars.find((c) => c.isPrimary) || calendars[0];
      if (!primary) {
        throw new Error('No writable Apple calendars found on this device');
      }

      const { error } = await supabase
        .from('user_calendar_connections')
        .upsert(
          {
            user_id: user.id,
            provider: 'apple',
            sync_enabled: true,
            sync_mode: SEND_ONLY_SYNC_MODE,
            primary_calendar_id: primary.id,
            primary_calendar_name: primary.title,
            calendar_id: primary.id,
            platform: 'ios',
          },
          { onConflict: 'user_id,provider' },
        );

      if (error) throw error;
    },
    onSuccess: refreshCalendarIntegrations,
  });

  return {
    settings,
    connections,
    connectedByProvider,
    defaultProvider,
    integrationVisible,
    applePluginAvailable,
    canConnectAppleNative,
    appleNativeUnavailableReason,
    isLoading: settingsQuery.isLoading || connectionsQuery.isLoading,
    refreshCalendarIntegrations,

    upsertSettings,
    beginOAuthConnection,
    completeOAuthConnection,
    disconnectProvider,
    listProviderCalendars,
    setPrimaryCalendar,
    listProviderTaskLists,
    setPrimaryTaskList,
    connectAppleNative,
  };
}
