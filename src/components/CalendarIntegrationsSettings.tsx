import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { CalendarDays, Link2, Unlink2, RefreshCcw, EyeOff, Eye, ChevronDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  useCalendarIntegrations,
  type CalendarProvider,
  type CalendarSyncMode,
} from '@/hooks/useCalendarIntegrations';
import { useQuestCalendarSync } from '@/hooks/useQuestCalendarSync';
import { getCalendarOAuthRedirectUri, getCalendarOAuthSource } from '@/utils/calendarOAuthRedirect';
import { PRODUCT } from '@/config/product';

const PROVIDERS: Array<{ key: CalendarProvider; label: string; web: boolean; ios: boolean }> = [
  { key: 'google', label: 'Google Calendar', web: true, ios: true },
  { key: 'outlook', label: 'Outlook Calendar', web: true, ios: true },
  { key: 'apple', label: 'Apple Calendar', web: false, ios: true },
];

const SYNC_MODE_LABELS: Record<CalendarSyncMode, string> = {
  send_only: 'Send only',
  full_sync: 'Two-way sync',
};

const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const providerLabel = (provider: CalendarProvider): string =>
  PROVIDERS.find((item) => item.key === provider)?.label ?? provider;

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const plural = (count: number, singular: string, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`;

const formatLastSyncedAt = (value: string | null | undefined): string => {
  if (!value) return 'Waiting for first sync';
  const syncedAt = new Date(value);
  if (Number.isNaN(syncedAt.getTime())) return 'Sync time unavailable';
  return `Last synced ${syncedAt.toLocaleString()}`;
};

const summarizeSyncResult = (result: unknown): string => {
  if (!result || typeof result !== 'object') {
    return 'No linked updates found.';
  }

  const payload = result as {
    linkedEvents?: Record<string, unknown> | null;
    linkedTasks?: Record<string, unknown> | null;
    plannerWindow?: Record<string, unknown> | null;
    plannerTasks?: Record<string, unknown> | null;
  };
  const responses = [payload.linkedEvents, payload.linkedTasks, payload.plannerTasks]
    .filter((item): item is Record<string, unknown> => Boolean(item));

  const checked = responses.reduce((total, item) => total + toCount(item.linksChecked), 0);
  const providerUpdates = responses.reduce((total, item) => total + toCount(item.pulledProviderChanges), 0);
  const imported = toCount(payload.plannerTasks?.importedCount);
  const updated = providerUpdates + toCount(payload.plannerTasks?.updatedCount);
  const removed = responses.reduce(
    (total, item) =>
      total
      + toCount(item.removedCancelled)
      + toCount(item.removedMissing)
      + (Array.isArray(item.removedTaskIds) ? item.removedTaskIds.length : 0),
    0,
  );
  const cachedAvailability = toCount(payload.plannerWindow?.cachedCount);

  const parts: string[] = [];
  if (checked > 0) parts.push(`${plural(checked, 'linked item')} checked`);
  if (imported > 0) parts.push(`${plural(imported, 'To Do task')} imported`);
  if (updated > 0) parts.push(`${plural(updated, 'item')} updated`);
  if (removed > 0) parts.push(`${plural(removed, 'stale item')} removed`);
  if (parts.length === 0 && cachedAvailability > 0) {
    parts.push(`${plural(cachedAvailability, 'calendar item')} refreshed`);
  }

  return parts.length > 0 ? `${parts.join(', ')}.` : 'No linked updates found.';
};

export function CalendarIntegrationsSettings() {
  const { toast } = useToast();
  const {
    connections,
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
    refreshCalendarIntegrations,
  } = useCalendarIntegrations();

  const { syncProviderPull } = useQuestCalendarSync();

  const [calendarOptionsByProvider, setCalendarOptionsByProvider] = useState<
    Partial<Record<CalendarProvider, Array<{ id: string; name: string }>>>
  >({});
  const [taskListOptionsByProvider, setTaskListOptionsByProvider] = useState<
    Partial<Record<CalendarProvider, Array<{ id: string; name: string }>>>
  >({});
  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<Exclude<CalendarProvider, 'apple'> | null>(null);
  const [isAutoLoadingOutlookOptions, setIsAutoLoadingOutlookOptions] = useState(false);
  const [isActivatingOutlookPlanning, setIsActivatingOutlookPlanning] = useState(false);
  const [autoLoadedOutlookConnectionId, setAutoLoadedOutlookConnectionId] = useState<string | null>(null);
  const [advancedOpenByProvider, setAdvancedOpenByProvider] = useState<Partial<Record<CalendarProvider, boolean>>>({});

  const canUseApple = isNativeIOS();
  const hasConnectedProviders = connections.length > 0;
  const isEffectivelyVisible = integrationVisible || !hasConnectedProviders;
  const outlookConnection = connectedByProvider.outlook;
  const isOutlookPlannerReady = Boolean(
    outlookConnection
    && outlookConnection.sync_mode === 'full_sync'
    && defaultProvider === 'outlook'
    && outlookConnection.primary_calendar_id
    && outlookConnection.primary_task_list_id,
  );

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
      void refreshCalendarIntegrations();
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
  }, [clearOauthParams, refreshCalendarIntegrations, toast]);

  const visibleProviders = useMemo(
    () => PROVIDERS.filter((provider) => (canUseApple ? provider.ios : provider.web)),
    [canUseApple],
  );

  const loadCalendarsForProvider = useCallback(async (
    provider: CalendarProvider,
    options?: {
      autoSelectIfMissing?: boolean;
      silent?: boolean;
    },
  ) => {
    const calendars = await listProviderCalendars.mutateAsync(provider);
    setCalendarOptionsByProvider((prev) => ({
      ...prev,
      [provider]: calendars.map((calendar) => ({ id: calendar.id, name: calendar.name })),
    }));

    const connection = connectedByProvider[provider];
    if (!options?.autoSelectIfMissing || connection?.primary_calendar_id || calendars.length === 0) {
      return calendars;
    }

    const preferred = calendars.find((calendar) => calendar.isPrimary) ?? calendars[0];
    if (!preferred) return calendars;

    try {
      await setPrimaryCalendar.mutateAsync({
        provider,
        calendarId: preferred.id,
        calendarName: preferred.name,
      });
    } catch (err) {
      if (!options?.silent) {
        toast({
          title: 'Failed setting primary calendar',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    }

    return calendars;
  }, [connectedByProvider, listProviderCalendars, setPrimaryCalendar, toast]);

  const loadOutlookTaskLists = useCallback(async (options?: {
    autoSelectIfMissing?: boolean;
    silent?: boolean;
  }) => {
    const taskLists = await listProviderTaskLists.mutateAsync('outlook');
    setTaskListOptionsByProvider((prev) => ({
      ...prev,
      outlook: taskLists.map((taskList) => ({ id: taskList.id, name: taskList.name })),
    }));

    if (!options?.autoSelectIfMissing || outlookConnection?.primary_task_list_id || taskLists.length === 0) {
      return taskLists;
    }

    const preferred = taskLists.find((taskList) => taskList.isPrimary) ?? taskLists[0];
    if (!preferred) return taskLists;

    try {
      await setPrimaryTaskList.mutateAsync({
        taskListId: preferred.id,
        taskListName: preferred.name,
      });
    } catch (err) {
      if (!options?.silent) {
        toast({
          title: 'Failed setting primary task list',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    }

    return taskLists;
  }, [listProviderTaskLists, outlookConnection?.primary_task_list_id, setPrimaryTaskList, toast]);

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

  useEffect(() => {
    if (!outlookConnection) return;
    if (isAutoLoadingOutlookOptions) return;
    if (autoLoadedOutlookConnectionId === outlookConnection.id) return;

    const hasLoadedCalendars = (calendarOptionsByProvider.outlook?.length ?? 0) > 0;
    const hasLoadedTaskLists = (taskListOptionsByProvider.outlook?.length ?? 0) > 0;
    if (hasLoadedCalendars && hasLoadedTaskLists) return;

    let cancelled = false;

    const run = async () => {
      setIsAutoLoadingOutlookOptions(true);
      try {
        if (!hasLoadedCalendars) {
          await loadCalendarsForProvider('outlook', {
            autoSelectIfMissing: true,
            silent: true,
          });
        }

        if (!hasLoadedTaskLists) {
          await loadOutlookTaskLists({
            autoSelectIfMissing: true,
            silent: true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to auto-load Outlook destinations:', error);
        }
      } finally {
        if (!cancelled) {
          setAutoLoadedOutlookConnectionId(outlookConnection.id);
          setIsAutoLoadingOutlookOptions(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    calendarOptionsByProvider.outlook?.length,
    loadCalendarsForProvider,
    loadOutlookTaskLists,
    autoLoadedOutlookConnectionId,
    outlookConnection?.id,
    taskListOptionsByProvider.outlook?.length,
    isAutoLoadingOutlookOptions,
  ]);

  const handleConnect = async (provider: CalendarProvider) => {
    try {
      setConnectingProvider(provider);

      if (provider === 'apple') {
        await connectAppleNative.mutateAsync({ syncMode: 'send_only' });
        toast({ title: 'Apple Calendar connected' });
        return;
      }

      const source = getCalendarOAuthSource();
      const callbackBase = getCalendarOAuthRedirectUri({ provider, source });
      const url = await beginOAuthConnection.mutateAsync({
        provider,
        redirectUri: callbackBase,
        syncMode: 'full_sync',
        source,
      });
      if (source === 'native') {
        await Browser.open({ url });
        return;
      }
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
      const calendars = await loadCalendarsForProvider(provider);
      toast({
        title: 'Calendars loaded',
        description: `${plural(calendars.length, 'calendar')} available for ${providerLabel(provider)}.`,
      });
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
      const taskLists = await loadOutlookTaskLists();
      toast({
        title: 'To Do lists loaded',
        description: `${plural(taskLists.length, 'list')} available for Outlook.`,
      });
    } catch (err) {
      toast({
        title: 'Failed loading Outlook task lists',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleSyncNow = async (provider: Exclude<CalendarProvider, 'apple'>) => {
    setSyncingProvider(provider);
    try {
      const result = await syncProviderPull.mutateAsync({ provider });
      toast({
        title: `${providerLabel(provider)} synced`,
        description: summarizeSyncResult(result),
      });
    } catch (err) {
      toast({
        title: `Failed to sync ${providerLabel(provider)}`,
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleEnableOutlookPlanning = async () => {
    if (!outlookConnection) return;

    setIsActivatingOutlookPlanning(true);
    try {
      const calendars = await loadCalendarsForProvider('outlook', {
        autoSelectIfMissing: true,
      });
      const taskLists = await loadOutlookTaskLists({
        autoSelectIfMissing: true,
      });

      if (!outlookConnection.primary_calendar_id && calendars.length === 0) {
        throw new Error('No Outlook calendars are available for this account.');
      }

      if (!outlookConnection.primary_task_list_id && taskLists.length === 0) {
        throw new Error('No Microsoft To Do lists are available for this account.');
      }

      if (outlookConnection.sync_mode !== 'full_sync') {
        await setProviderSyncMode.mutateAsync({
          provider: 'outlook',
          syncMode: 'full_sync',
        });
      }

      if (defaultProvider !== 'outlook' || !integrationVisible) {
        await upsertSettings.mutateAsync({
          default_provider: 'outlook',
          integration_visible: true,
        });
      }

      toast({
        title: 'Outlook ready for planning',
        description: 'Planner changes will now read from and sync back to Outlook.',
      });
    } catch (err) {
      toast({
        title: 'Failed to enable Outlook planning',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsActivatingOutlookPlanning(false);
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

  if (!isEffectivelyVisible) {
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
          Two-way sync keeps {PRODUCT.name} and your external calendars current automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasConnectedProviders && (
          <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
            <div className="text-xs text-muted-foreground">Hide this section from everyday view</div>
            <Button onClick={toggleVisibility} variant="ghost" size="sm">
              <EyeOff className="h-4 w-4 mr-2" />
              Hide
            </Button>
          </div>
        )}

        {visibleProviders.map((provider) => {
          const connection = connectedByProvider[provider.key];
          const calendars = calendarOptionsByProvider[provider.key] || [];
          const taskLists = provider.key === 'outlook'
            ? taskListOptionsByProvider.outlook || []
            : [];
          const syncableProvider = provider.key === 'google' || provider.key === 'outlook'
            ? provider.key
            : null;
          const isSyncing = syncableProvider !== null && syncingProvider === syncableProvider;
          const shouldCollapseDestinationRefresh = provider.key === 'outlook' && isOutlookPlannerReady;
          const destinationRefreshActions = (
            <>
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
            </>
          );

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
                  {connection?.sync_mode === 'full_sync' && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatLastSyncedAt(connection.last_synced_at)}
                    </p>
                  )}
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
                  {provider.key === 'outlook' && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {isOutlookPlannerReady
                          ? 'Outlook is the active planning source.'
                          : 'Finish setup once to make Outlook the planner source.'}
                      </div>
                      {isOutlookPlannerReady ? (
                        <Badge variant="secondary">Planner active</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => void handleEnableOutlookPlanning()}
                          disabled={isActivatingOutlookPlanning}
                        >
                          {isActivatingOutlookPlanning ? 'Activating Outlook...' : 'Use Outlook for Planning'}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {syncableProvider ? (
                      <Select
                        value={connection.sync_mode}
                        onValueChange={(value) => {
                          void setProviderSyncMode
                            .mutateAsync({ provider: syncableProvider, syncMode: value as CalendarSyncMode })
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
                    ) : (
                      <div className="flex h-9 items-center rounded-md border border-border/60 px-3 text-xs text-muted-foreground">
                        Apple Calendar · {SYNC_MODE_LABELS.send_only}
                      </div>
                    )}

                    <Select
                      value={defaultProvider || undefined}
                      onValueChange={(value) => {
                        void upsertSettings
                          .mutateAsync({
                            default_provider: value as CalendarProvider,
                            integration_visible: true,
                          })
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
                    {!shouldCollapseDestinationRefresh && destinationRefreshActions}

                    {syncableProvider && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSyncNow(syncableProvider)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4 mr-2" />
                        )}
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                    )}

                    <Button size="sm" variant="outline" onClick={() => handleDisconnect(provider.key)}>
                      <Unlink2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>

                    {shouldCollapseDestinationRefresh && (
                      <Collapsible
                        open={Boolean(advancedOpenByProvider[provider.key])}
                        onOpenChange={(open) =>
                          setAdvancedOpenByProvider((prev) => ({ ...prev, [provider.key]: open }))
                        }
                        className="w-full"
                      >
                        <CollapsibleTrigger asChild>
                          <Button size="sm" variant="ghost" className="px-1">
                            Advanced
                            <ChevronDown
                              className={`ml-2 h-4 w-4 transition-transform ${
                                advancedOpenByProvider[provider.key] ? 'rotate-180' : ''
                              }`}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {destinationRefreshActions}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
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
