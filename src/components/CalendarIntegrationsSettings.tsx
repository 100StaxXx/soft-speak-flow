import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CalendarDays, Link2, Unlink2, RefreshCcw, EyeOff, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useCalendarIntegrations,
  type CalendarProvider,
  type CalendarSyncMode,
} from '@/hooks/useCalendarIntegrations';
import { useQuestCalendarSync } from '@/hooks/useQuestCalendarSync';
import { getRedirectUrlWithPath } from '@/utils/redirectUrl';

const PROVIDERS: Array<{ key: CalendarProvider; label: string; web: boolean; ios: boolean }> = [
  { key: 'google', label: 'Google Calendar', web: true, ios: true },
  { key: 'outlook', label: 'Outlook Calendar', web: true, ios: true },
  { key: 'apple', label: 'Apple Calendar', web: false, ios: true },
];

const SYNC_MODE_LABELS: Record<CalendarSyncMode, string> = {
  send_only: 'Send only',
  full_sync: 'Full sync',
};

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export function CalendarIntegrationsSettings() {
  const { toast } = useToast();
  const {
    integrationVisible,
    defaultProvider,
    connectedByProvider,
    isLoading,
    upsertSettings,
    beginOAuthConnection,
    completeOAuthConnection,
    disconnectProvider,
    setProviderSyncMode,
    listProviderCalendars,
    setPrimaryCalendar,
    listProviderTaskLists,
    setPrimaryTaskList,
    connectAppleNative,
    canConnectAppleNative,
    appleNativeUnavailableReason,
  } = useCalendarIntegrations();

  const { syncProviderPull } = useQuestCalendarSync();

  const [calendarOptionsByProvider, setCalendarOptionsByProvider] = useState<
    Partial<Record<CalendarProvider, Array<{ id: string; name: string }>>>
  >({});
  const [taskListOptionsByProvider, setTaskListOptionsByProvider] = useState<
    Partial<Record<CalendarProvider, Array<{ id: string; name: string }>>>
  >({});
  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null);

  const canUseApple = isNativeIOS();

  const clearOauthParams = useCallback((params: URLSearchParams, keys: string[]) => {
    keys.forEach((key) => params.delete(key));
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`,
    );
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('calendar_oauth_provider') as CalendarProvider | null;
    const status = params.get('calendar_oauth_status');
    const message = params.get('calendar_oauth_message');

    if (!provider || !status) return;

    if (status === 'success') {
      toast({ title: 'Calendar connected', description: `${provider} connected successfully.` });
    } else {
      toast({
        title: 'Failed to complete connection',
        description: message || 'Unable to connect calendar. Please try again.',
        variant: 'destructive',
      });
    }

    clearOauthParams(params, [
      'calendar_oauth_provider',
      'calendar_oauth_status',
      'calendar_oauth_message',
    ]);
  }, [clearOauthParams, toast]);

  const visibleProviders = useMemo(
    () => PROVIDERS.filter((provider) => (canUseApple ? provider.ios : provider.web)),
    [canUseApple],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('calendar_provider') as CalendarProvider | null;
    const code = params.get('code');
    const error = params.get('error');
    const state = params.get('state');

    if (!provider || (!code && !error)) return;

    if (error) {
      toast({ title: 'Calendar connection cancelled', description: `Provider: ${provider}` });
      clearOauthParams(params, ['calendar_provider', 'error', 'error_description']);
      return;
    }

    if (!code) return;

    const redirectUri = `${window.location.origin}${window.location.pathname}?calendar_provider=${provider}`;

    completeOAuthConnection
      .mutateAsync({ provider: provider as Exclude<CalendarProvider, 'apple'>, code, redirectUri, state: state ?? undefined })
      .then(() => {
        toast({ title: 'Calendar connected', description: `${provider} connected successfully.` });
      })
      .catch((err) => {
        toast({
          title: 'Failed to complete connection',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      })
      .finally(() => {
        clearOauthParams(params, ['calendar_provider', 'code', 'scope', 'state']);
      });
  }, [clearOauthParams, completeOAuthConnection, toast]);

  const handleConnect = async (provider: CalendarProvider) => {
    try {
      setConnectingProvider(provider);

      if (provider === 'apple') {
        await connectAppleNative.mutateAsync({ syncMode: 'send_only' });
        toast({ title: 'Apple Calendar connected' });
        return;
      }

      const source = Capacitor.isNativePlatform() ? 'native' : 'web';
      const callbackBase = getRedirectUrlWithPath('/calendar/oauth/callback');
      const redirectUri = `${callbackBase}?calendar_provider=${provider}&calendar_source=${source}`;
      const url = await beginOAuthConnection.mutateAsync({ provider, redirectUri, syncMode: 'send_only' });
      window.location.href = url;
    } catch (err) {
      toast({
        title: 'Failed to start connection',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: CalendarProvider) => {
    try {
      await disconnectProvider.mutateAsync(provider);
      toast({ title: `${provider} disconnected` });
    } catch (err) {
      toast({
        title: 'Disconnect failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleLoadCalendars = async (provider: CalendarProvider) => {
    try {
      const calendars = await listProviderCalendars.mutateAsync(provider);
      setCalendarOptionsByProvider((prev) => ({
        ...prev,
        [provider]: calendars.map((calendar) => ({ id: calendar.id, name: calendar.name })),
      }));
    } catch (err) {
      toast({
        title: `Failed loading ${provider} calendars`,
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleLoadTaskLists = async () => {
    try {
      const taskLists = await listProviderTaskLists.mutateAsync('outlook');
      setTaskListOptionsByProvider((prev) => ({
        ...prev,
        outlook: taskLists.map((taskList) => ({ id: taskList.id, name: taskList.name })),
      }));
    } catch (err) {
      toast({
        title: 'Failed loading Outlook task lists',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const toggleVisibility = async () => {
    try {
      await upsertSettings.mutateAsync({ integration_visible: !integrationVisible });
    } catch (err) {
      toast({
        title: 'Failed to update visibility',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Calendar Integrations</CardTitle>
          <CardDescription className="text-xs">Loading calendar settings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!integrationVisible) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar Integrations
          </CardTitle>
          <CardDescription className="text-xs">
            Keep this hidden unless you want to connect Google, Outlook, or Apple Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={toggleVisibility} variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Show Calendar Integrations
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Calendar Integrations
        </CardTitle>
        <CardDescription className="text-xs">
          Optional sync. Choose send-only or full sync per provider.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
          <div className="text-xs text-muted-foreground">Hide this section from everyday view</div>
          <Button onClick={toggleVisibility} variant="ghost" size="sm">
            <EyeOff className="h-4 w-4 mr-2" />
            Hide
          </Button>
        </div>

        {visibleProviders.map((provider) => {
          const connection = connectedByProvider[provider.key];
          const calendars = calendarOptionsByProvider[provider.key] || [];
          const taskLists = provider.key === 'outlook'
            ? taskListOptionsByProvider.outlook || []
            : [];

          return (
            <div key={provider.key} className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {connection
                      ? connection.calendar_email || connection.primary_calendar_name || 'Connected'
                      : provider.key === 'apple' && !canUseApple
                        ? 'Apple Calendar works only on iOS native'
                        : provider.key === 'apple' && !canConnectAppleNative
                          ? appleNativeUnavailableReason || 'Apple Calendar is unavailable in this app build.'
                        : 'Not connected'}
                  </p>
                </div>

                {connection ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>

              {!connection ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    connectingProvider === provider.key
                    || (provider.key === 'apple' && (!canUseApple || !canConnectAppleNative))
                  }
                  onClick={() => handleConnect(provider.key)}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {connectingProvider === provider.key
                    ? 'Connecting...'
                    : provider.key === 'apple' && canUseApple && !canConnectAppleNative
                      ? 'Update App to Connect Apple Calendar'
                      : `Connect ${provider.label}`}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      value={connection.sync_mode}
                      onValueChange={(value) => {
                        void setProviderSyncMode
                          .mutateAsync({ provider: provider.key, syncMode: value as CalendarSyncMode })
                          .catch((err) => {
                            toast({
                              title: 'Failed to update sync mode',
                              description: err instanceof Error ? err.message : 'Unknown error',
                              variant: 'destructive',
                            });
                          });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Sync mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_only">{SYNC_MODE_LABELS.send_only}</SelectItem>
                        <SelectItem value="full_sync">{SYNC_MODE_LABELS.full_sync}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={defaultProvider || undefined}
                      onValueChange={(value) => {
                        void upsertSettings
                          .mutateAsync({ default_provider: value as CalendarProvider })
                          .catch((err) => {
                            toast({
                              title: 'Failed to set default provider',
                              description: err instanceof Error ? err.message : 'Unknown error',
                              variant: 'destructive',
                            });
                          });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Default provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleProviders
                          .filter((p) => connectedByProvider[p.key])
                          .map((p) => (
                            <SelectItem key={p.key} value={p.key}>
                              {p.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleLoadCalendars(provider.key)}>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Load Calendars
                    </Button>

                    {provider.key === 'outlook' && (
                      <Button size="sm" variant="outline" onClick={() => void handleLoadTaskLists()}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Load To Do Lists
                      </Button>
                    )}

                    {provider.key !== 'apple' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void syncProviderPull.mutateAsync({ provider: provider.key as 'google' | 'outlook' })}
                      >
                        Pull Linked Updates
                      </Button>
                    )}

                    <Button size="sm" variant="outline" onClick={() => handleDisconnect(provider.key)}>
                      <Unlink2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  </div>

                  {calendars.length > 0 && (
                    <Select
                      value={connection.primary_calendar_id || ''}
                      onValueChange={(value) => {
                        const selected = calendars.find((calendar) => calendar.id === value);
                        void setPrimaryCalendar
                          .mutateAsync({ provider: provider.key, calendarId: value, calendarName: selected?.name })
                          .catch((err) => {
                            toast({
                              title: 'Failed setting primary calendar',
                              description: err instanceof Error ? err.message : 'Unknown error',
                              variant: 'destructive',
                            });
                          });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Primary destination calendar" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendars.map((calendar) => (
                          <SelectItem key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {provider.key === 'outlook' && taskLists.length > 0 && (
                    <Select
                      value={connection.primary_task_list_id || ''}
                      onValueChange={(value) => {
                        const selected = taskLists.find((taskList) => taskList.id === value);
                        void setPrimaryTaskList
                          .mutateAsync({ taskListId: value, taskListName: selected?.name })
                          .catch((err) => {
                            toast({
                              title: 'Failed setting primary task list',
                              description: err instanceof Error ? err.message : 'Unknown error',
                              variant: 'destructive',
                            });
                          });
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Primary Microsoft To Do list" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskLists.map((taskList) => (
                          <SelectItem key={taskList.id} value={taskList.id}>
                            {taskList.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
