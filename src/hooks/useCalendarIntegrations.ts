import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { NativeCalendar } from '@/plugins/NativeCalendarPlugin';

export type CalendarProvider = 'google' | 'outlook' | 'apple';
export type CalendarSyncMode = 'send_only' | 'full_sync';

export interface ConnectedCalendar {
  id: string;
  provider: CalendarProvider;
  calendar_email: string | null;
  primary_calendar_id: string | null;
  primary_calendar_name: string | null;
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

interface CalendarIntegrationsOptions {
  enabled?: boolean;
}

const providerToFunction = (provider: CalendarProvider) => `${provider}-calendar-auth`;

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export function useCalendarIntegrations(options: CalendarIntegrationsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enabled = true } = options;

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
        .select('id, provider, calendar_email, primary_calendar_id, primary_calendar_name, sync_mode, sync_enabled, platform, last_synced_at')
        .eq('user_id', user.id)
        .eq('sync_enabled', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ConnectedCalendar[];
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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendar-user-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] }),
      queryClient.invalidateQueries({ queryKey: ['quest-calendar-links'] }),
    ]);
  };

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
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const beginOAuthConnection = useMutation({
    mutationFn: async ({
      provider,
      redirectUri,
      syncMode = 'send_only',
    }: {
      provider: Exclude<CalendarProvider, 'apple'>;
      redirectUri: string;
      syncMode?: CalendarSyncMode;
    }) => {
      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'getAuthUrl', redirectUri, syncMode },
      });

      if (error) throw new Error(error.message || `Failed to start ${provider} connection`);
      return (data?.url || data?.auth_url) as string;
    },
  });

  const completeOAuthConnection = useMutation({
    mutationFn: async ({
      provider,
      code,
      redirectUri,
      syncMode = 'send_only',
    }: {
      provider: Exclude<CalendarProvider, 'apple'>;
      code: string;
      redirectUri: string;
      syncMode?: CalendarSyncMode;
    }) => {
      const fn = providerToFunction(provider);
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { action: 'exchangeCode', code, redirectUri, syncMode },
      });

      if (error) throw new Error(error.message || `Failed to connect ${provider}`);
      return data;
    },
    onSuccess: invalidate,
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
      if (error) throw new Error(error.message || `Failed to disconnect ${provider}`);
    },
    onSuccess: invalidate,
  });

  const setProviderSyncMode = useMutation({
    mutationFn: async ({ provider, syncMode }: { provider: CalendarProvider; syncMode: CalendarSyncMode }) => {
      if (provider === 'apple') {
        if (!user?.id) throw new Error('User not authenticated');
        const { error } = await supabase
          .from('user_calendar_connections')
          .update({ sync_mode: syncMode })
          .eq('user_id', user.id)
          .eq('provider', 'apple');
        if (error) throw error;
        return;
      }

      const fn = providerToFunction(provider);
      const { error } = await supabase.functions.invoke(fn, {
        body: { action: 'setSyncMode', syncMode },
      });
      if (error) throw new Error(error.message || `Failed to set ${provider} sync mode`);
    },
    onSuccess: invalidate,
  });

  const listProviderCalendars = useMutation({
    mutationFn: async (provider: CalendarProvider): Promise<ProviderCalendarOption[]> => {
      if (provider === 'apple') {
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

      if (error) throw new Error(error.message || `Failed to list ${provider} calendars`);

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

      if (error) throw new Error(error.message || `Failed to set ${provider} primary calendar`);
    },
    onSuccess: invalidate,
  });

  const connectAppleNative = useMutation({
    mutationFn: async ({ syncMode = 'send_only' as CalendarSyncMode } = {}) => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!isNativeIOS()) throw new Error('Apple Calendar is only available on iOS native');

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
            sync_mode: syncMode,
            primary_calendar_id: primary.id,
            primary_calendar_name: primary.title,
            calendar_id: primary.id,
            platform: 'ios',
          },
          { onConflict: 'user_id,provider' },
        );

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    settings,
    connections,
    connectedByProvider,
    defaultProvider,
    integrationVisible,
    isLoading: settingsQuery.isLoading || connectionsQuery.isLoading,

    upsertSettings,
    beginOAuthConnection,
    completeOAuthConnection,
    disconnectProvider,
    setProviderSyncMode,
    listProviderCalendars,
    setPrimaryCalendar,
    connectAppleNative,
  };
}
