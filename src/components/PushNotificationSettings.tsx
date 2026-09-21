import { useState, useEffect, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, AlertCircle, MapPin, Bug, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NotificationPreview } from "@/components/NotificationPreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  isNativePushSupported, 
  initializeNativePush, 
  unregisterNativePush,
  hasActiveNativePushSubscription,
  debugTestRegistration,
  getNativePushTokenDebugSnapshot,
  waitForNativePushToken,
} from "@/utils/nativePushNotifications";
import { PRODUCT } from "@/config/product";

const timeOptions = [
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
];

type QueueDebugRow = Pick<
  Database["public"]["Tables"]["push_notification_queue"]["Row"],
  | "id"
  | "notification_type"
  | "status"
  | "scheduled_for"
  | "delivered_at"
  | "last_error"
  | "dedupe_key"
  | "payload"
  | "source_table"
>;

type NotificationProfileUpdates = Partial<Pick<
  Profile,
  | "daily_push_enabled"
  | "daily_push_time"
  | "checkin_reminders_enabled"
>>;

const RECENT_QUEUE_LIMIT = 12;
const QUEST_NOTIFICATION_TYPES = new Set([
  "task_start",
  "task_reminder",
  "plan_day_overdue",
]);

const normalizeTimeSelectValue = (
  value: string | null | undefined,
  fallback: string,
): string => {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/.exec(value.trim());
  if (!match) return fallback;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const toQueuePayload = (value: QueueDebugRow["payload"]): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

const buildLogicalQueueKey = (row: QueueDebugRow): string => {
  if (typeof row.dedupe_key === "string" && row.dedupe_key.trim().length > 0 && !row.dedupe_key.startsWith("legacy:")) {
    return row.dedupe_key;
  }

  const payload = toQueuePayload(row.payload);

  if (typeof payload.pep_talk_id === "string") {
    return `daily_pep:${payload.pep_talk_id}`;
  }

  if (typeof payload.daily_quote_id === "string") {
    return `daily_quote:${payload.daily_quote_id}`;
  }

  if (typeof payload.task_id === "string") {
    const reminderMinutes = typeof payload.reminder_minutes_before === "number" ? payload.reminder_minutes_before : "start";
    return `${row.notification_type}:${payload.task_id}:${reminderMinutes}`;
  }

  if (typeof payload.habit_id === "string" && typeof payload.local_date === "string") {
    return `habit_reminder:${payload.habit_id}:${payload.local_date}`;
  }

  if (typeof payload.nudge_id === "string") {
    return `mentor_nudge:${payload.nudge_id}`;
  }

  if (typeof payload.reminder_id === "string") {
    return `contact_reminder:${payload.reminder_id}`;
  }

  if (typeof payload.local_date === "string") {
    return `${row.notification_type}:${payload.local_date}`;
  }

  return `${row.notification_type}:${row.source_table}:${String(row.scheduled_for).slice(0, 10)}`;
};

const findDuplicateLogicalQueueKeys = (rows: QueueDebugRow[]): string[] => {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = buildLogicalQueueKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
};

const formatRelativeTokenAge = (value: string | null): string => {
  if (!value) {
    return "No token on file";
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown";
  }

  const ageMs = Date.now() - timestamp.getTime();
  if (ageMs < 60_000) {
    return "Just now";
  }

  const ageMinutes = Math.floor(ageMs / 60_000);
  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return `${ageHours}h ago`;
  }

  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays}d ago`;
};

export const PushNotificationSettings = memo(() => {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Check platform support after mount
  useEffect(() => {
    setIsSupported(isNativePushSupported());
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (user) {
      void hasActiveNativePushSubscription(user.id)
        .then((value) => {
          if (cancelled) return;
          setPushEnabled(value);
        })
        .catch((error) => {
          console.warn("Could not read the current push subscription:", error);
          if (cancelled) return;
          setPushEnabled(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const persistProfileUpdates = async (updates: NotificationProfileUpdates) => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) throw error;

    queryClient.setQueryData<Profile | null | undefined>(["profile", user.id], (currentProfile) => {
      if (currentProfile == null) {
        return profile ? { ...profile, ...updates } as Profile : currentProfile;
      }

      return { ...currentProfile, ...updates } as Profile;
    });

    void queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const handleTogglePushPermission = async (enabled: boolean) => {
    if (!user) return;
    
    try {
      if (enabled) {
        // Subscribe to native push notifications
        await initializeNativePush(user.id);
        const hasToken = await waitForNativePushToken(user.id);
        setPushEnabled(hasToken);
        toast({
          title: hasToken ? "Notifications Enabled" : "Registration Started",
          description: hasToken
            ? "This device can now receive mobile push notifications."
            : "Permission is enabled, but we're still waiting for this device token to finish registering.",
        });
      } else {
        // Unsubscribe from push notifications
        await unregisterNativePush(user.id);
        setPushEnabled(false);
        toast({ title: "Notifications Disabled", description: "This device will no longer receive mobile push notifications." });
      }
    } catch (error) {
      console.error("Error toggling push notifications:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle notifications", variant: "destructive" });
    }
  };

  const handleTogglePepTalk = async (enabled: boolean) => {
    if (!user) return;
    
    if (enabled && !pushEnabled) {
      toast({ 
        title: "Enable push notifications first", 
        description: "Please enable mobile push notifications before activating daily encouragement",
        variant: "destructive" 
      });
      return;
    }
    
    try {
      await persistProfileUpdates({ daily_push_enabled: enabled });
      toast({
        title: enabled ? "Daily Encouragement Enabled" : "Daily Encouragement Disabled",
        description: enabled
          ? "Your Guide’s encouragement will arrive at the time you choose."
          : "Daily encouragement reminders are now off.",
      });
    } catch (error) {
      console.error("Error toggling daily encouragement:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update daily encouragement", variant: "destructive" });
    }
  };

  const handleToggleCheckInReminders = async (enabled: boolean) => {
    if (!user) return;

    if (enabled && !pushEnabled) {
      toast({
        title: "Enable push notifications first",
        description: "Please enable mobile push notifications before activating check-in reminders",
        variant: "destructive",
      });
      return;
    }

    try {
      await persistProfileUpdates({ checkin_reminders_enabled: enabled });
      toast({
        title: enabled ? "Evening Reflection Enabled" : "Evening Reflection Disabled",
        description: enabled
          ? `${PRODUCT.name} will invite you to reflect on the day around 8 PM.`
          : "Evening Reflection reminders are now off.",
      });
    } catch (error) {
      console.error("Error toggling check-in reminders:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to toggle check-in reminders", variant: "destructive" });
    }
  };

  const handleUpdateTime = async (value: string) => {
    if (!user) return;
    try {
      await persistProfileUpdates({ daily_push_time: value });
      toast({ title: "Time Updated", description: "Your push notification time has been updated" });
    } catch (error) {
      console.error("Error updating time:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update time", variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 bg-card border-border shadow-soft">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-accent/20 p-2 rounded-xl">
          <Bell className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="font-display text-2xl text-foreground">Daily Delivery</h2>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        {PRODUCT.mode === "christian"
          ? "Let Graceward bring the day to you: one morning package and, if you want it, one evening invitation."
          : "Let Cosmiq bring the day to you with the planning and reflection reminders you choose."}
      </p>

      {!isSupported && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Push notifications are only available on iOS devices.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
          {/* Native Push Permission */}
        {isSupported && (
          <div className="space-y-3 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground font-medium">Allow Notifications</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow this iPhone or iPad to receive push notifications
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={handleTogglePushPermission}
              />
            </div>
          </div>
        )}
        {/* Morning Daily Grace */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">
                {PRODUCT.mode === "christian" ? "Morning Daily Grace" : "Morning Plan"}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {PRODUCT.mode === "christian"
                  ? "Scripture, prayer, your Guide’s audio encouragement, and one ready-made daily practice"
                  : "Your plan, Guide context, and the actions you chose for the day"}
              </p>
            </div>
            <Switch
              checked={profile?.daily_push_enabled ?? false}
              onCheckedChange={handleTogglePepTalk}
              disabled={!pushEnabled}
            />
          </div>
          
          {profile?.daily_push_enabled && (
            <div className="ml-0 space-y-2">
              <Label className="text-sm text-muted-foreground">Delivery Time</Label>
              <Select
                value={normalizeTimeSelectValue(profile.daily_push_time, "08:00")}
                onValueChange={handleUpdateTime}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {timeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Timezone Display */}
        {profile?.timezone && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-muted-foreground text-sm">Timezone</Label>
              </div>
              <span className="text-sm text-foreground">{profile.timezone}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              All notification times are shown in your local timezone
            </p>
          </div>
        )}

        {/* Evening Reflection */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground font-medium">Evening Reflection</Label>
              <p className="text-xs text-muted-foreground mt-1">
                One invitation around 8 PM to notice grace and release the day
              </p>
            </div>
            <Switch
              checked={profile?.checkin_reminders_enabled ?? true}
              onCheckedChange={handleToggleCheckInReminders}
              disabled={!pushEnabled}
            />
          </div>
        </div>

        {/* Notification Preview */}
        {pushEnabled && profile?.daily_push_enabled && (
          <div className="pt-6 mt-6 border-t border-border">
            <NotificationPreview />
          </div>
        )}

        {/* Debug Panel */}
        {import.meta.env.DEV ? <PushDebugPanel userId={user?.id} /> : null}
      </div>
    </Card>
  );
});
PushNotificationSettings.displayName = 'PushNotificationSettings';

// Push Debug Panel Component - memoized
const PushDebugPanel = memo(({ userId }: { userId?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    platform: string;
    isNative: boolean;
    isSupported: boolean;
    permissionStatus: string;
    hasToken: boolean;
    profileTimezone: string | null;
    tokenCount: number;
    installationCount: number;
    legacyTokenCount: number;
    latestTokenUpdatedAt: string | null;
    latestTokenPreview: string | null;
    currentInstallationIdPreview: string | null;
    recentQueueRows: QueueDebugRow[];
    recentSkippedBudget: boolean;
    recentFailedTerminal: boolean;
    recentNoDeviceTokens: boolean;
    recentSkippedDisabled: boolean;
    recentShadowMode: boolean;
    recentRollbackEnabled: boolean;
    recentRolloutBlocked: boolean;
    recentQuestRows: QueueDebugRow[];
    duplicateLogicalQueueKeys: string[];
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();

  const loadDebugInfo = async () => {
    setIsLoading(true);
    try {
      const info = await debugTestRegistration(userId || '');
      if (!userId) {
        setDebugInfo({
          ...info,
          hasToken: false,
          profileTimezone: null,
          tokenCount: 0,
          installationCount: 0,
          legacyTokenCount: 0,
          latestTokenUpdatedAt: null,
          latestTokenPreview: null,
          currentInstallationIdPreview: null,
          recentQueueRows: [],
          recentSkippedBudget: false,
          recentFailedTerminal: false,
          recentNoDeviceTokens: false,
          recentSkippedDisabled: false,
          recentShadowMode: false,
          recentRollbackEnabled: false,
          recentRolloutBlocked: false,
          recentQuestRows: [],
          duplicateLogicalQueueKeys: [],
        });
        return;
      }

      const [hasToken, tokenSnapshot, queueResult, profileResult] = await Promise.all([
        hasActiveNativePushSubscription(userId),
        getNativePushTokenDebugSnapshot(userId),
        supabase
          .from("push_notification_queue")
          .select("id, notification_type, status, scheduled_for, delivered_at, last_error, dedupe_key, payload, source_table")
          .eq("user_id", userId)
          .order("scheduled_for", { ascending: false })
          .limit(RECENT_QUEUE_LIMIT),
        supabase
          .from("profiles")
          .select("timezone")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (queueResult.error) {
        throw queueResult.error;
      }
      if (profileResult.error) {
        throw profileResult.error;
      }

      const recentQueueRows = (queueResult.data ?? []) as QueueDebugRow[];
      const recentQuestRows = recentQueueRows.filter((row) => QUEST_NOTIFICATION_TYPES.has(row.notification_type));
      const duplicateLogicalQueueKeys = findDuplicateLogicalQueueKeys(recentQueueRows);

      setDebugInfo({
        ...info,
        hasToken,
        profileTimezone: profileResult.data?.timezone ?? null,
        tokenCount: tokenSnapshot.tokenCount,
        installationCount: tokenSnapshot.installationCount,
        legacyTokenCount: tokenSnapshot.legacyTokenCount,
        latestTokenUpdatedAt: tokenSnapshot.latestUpdatedAt,
        latestTokenPreview: tokenSnapshot.latestTokenPreview,
        currentInstallationIdPreview: tokenSnapshot.currentInstallationIdPreview,
        recentQueueRows,
        recentQuestRows,
        recentSkippedBudget: recentQueueRows.some((row) => row.status === "skipped_budget"),
        recentFailedTerminal: recentQueueRows.some((row) => row.status === "failed_terminal"),
        recentNoDeviceTokens: recentQueueRows.some((row) => row.last_error === "no_device_tokens"),
        recentSkippedDisabled: recentQueueRows.some((row) => row.status === "skipped_disabled"),
        recentShadowMode: recentQueueRows.some((row) => row.last_error === "shadow_mode"),
        recentRollbackEnabled: recentQueueRows.some((row) => row.last_error === "rollback_enabled"),
        recentRolloutBlocked: recentQueueRows.some((row) => String(row.last_error ?? "").startsWith("rollout_")),
        duplicateLogicalQueueKeys,
      });
    } catch (error) {
      console.error('Debug info error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRegistration = async () => {
    if (!userId) {
      toast({ title: "Error", description: "No user ID available", variant: "destructive" });
      return;
    }
    
    setIsRegistering(true);
    try {
      await initializeNativePush(userId);
      await waitForNativePushToken(userId, { timeoutMs: 5000, pollMs: 250 });
      await loadDebugInfo();
      toast({ title: "Registration Checked", description: "Refreshed this device's push token and queue diagnostics." });
    } catch (error) {
      toast({ 
        title: "Registration Failed", 
        description: error instanceof Error ? error.message : "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (isOpen && !debugInfo) {
      loadDebugInfo();
    }
  }, [isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="pt-4 border-t border-border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Debug Push Notifications</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : debugInfo ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Platform:</span>
                <span className="font-mono text-foreground">{debugInfo.platform}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.isNative ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Native:</span>
                <span className="text-foreground">{debugInfo.isNative ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.isSupported ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Supported:</span>
                <span className="text-foreground">{debugInfo.isSupported ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.permissionStatus === 'granted' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span className="text-muted-foreground">Permission:</span>
                <span className="text-foreground">{debugInfo.permissionStatus}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                {debugInfo.hasToken ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-muted-foreground">Token in DB:</span>
                <span className="text-foreground">{debugInfo.hasToken ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground">iOS Tokens:</span>
                <span className="text-foreground">{debugInfo.tokenCount}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground">Installations:</span>
                <span className="text-foreground">{debugInfo.installationCount}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground">Legacy Token Rows:</span>
                <span className="text-foreground">{debugInfo.legacyTokenCount}</span>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground">Profile Timezone:</span>
                <span className="text-foreground font-mono text-xs">{debugInfo.profileTimezone ?? "Unknown"}</span>
              </div>
              {debugInfo.currentInstallationIdPreview && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-muted-foreground">This Installation:</span>
                  <span className="text-foreground font-mono text-xs">{debugInfo.currentInstallationIdPreview}</span>
                </div>
              )}
              {debugInfo.latestTokenUpdatedAt && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-muted-foreground">Latest Token Updated:</span>
                  <span className="text-foreground font-mono text-xs">{new Date(debugInfo.latestTokenUpdatedAt).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2 col-span-2">
                <span className="text-muted-foreground">Token Freshness:</span>
                <span className="text-foreground">{formatRelativeTokenAge(debugInfo.latestTokenUpdatedAt)}</span>
              </div>
              {debugInfo.latestTokenPreview && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-muted-foreground">Latest Token:</span>
                  <span className="text-foreground font-mono text-xs">{debugInfo.latestTokenPreview}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recent Queue Signals</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {debugInfo.recentSkippedBudget && (
                  <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-300">
                    Recent skipped_budget
                  </span>
                )}
                {debugInfo.recentFailedTerminal && (
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                    Recent failed_terminal
                  </span>
                )}
                {debugInfo.recentNoDeviceTokens && (
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">
                    Recent no_device_tokens
                  </span>
                )}
                {debugInfo.recentSkippedDisabled && (
                  <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                    Recent disabled daily push
                  </span>
                )}
                {debugInfo.recentShadowMode && (
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-xs text-sky-700 dark:text-sky-300">
                    Recent shadow_mode
                  </span>
                )}
                {debugInfo.recentRollbackEnabled && (
                  <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                    Recent rollback_enabled
                  </span>
                )}
                {debugInfo.recentRolloutBlocked && (
                  <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                    Recent rollout block
                  </span>
                )}
                {debugInfo.tokenCount > 1 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                    Multiple iOS token rows
                  </span>
                )}
                {debugInfo.legacyTokenCount > 0 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                    Legacy token rows
                  </span>
                )}
                {debugInfo.duplicateLogicalQueueKeys.length > 0 && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
                    Repeated logical notifications
                  </span>
                )}
                {!debugInfo.recentSkippedBudget && !debugInfo.recentFailedTerminal && !debugInfo.recentNoDeviceTokens && !debugInfo.recentSkippedDisabled && (
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                    No recent queue failures
                  </span>
                )}
              </div>
            </div>

            {(
              debugInfo.legacyTokenCount > 0 ||
              debugInfo.duplicateLogicalQueueKeys.length > 0 ||
              debugInfo.tokenCount > Math.max(debugInfo.installationCount, 1)
            ) && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Potential duplicate risk detected. Legacy token records, repeated logical queue entries, or more token rows than tracked installations can fan out extra alerts unless the install-aware path fully replaces the old rows.
                </AlertDescription>
              </Alert>
            )}
            
            {debugInfo.error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{debugInfo.error}</AlertDescription>
              </Alert>
            )}
            
            {debugInfo.permissionStatus === "granted" && !debugInfo.hasToken && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Push permission is granted, but this device does not have a saved iOS token yet. Use Test Registration, then verify a quest queue row no longer fails with <code>no_device_tokens</code>.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDebugInfo}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleTestRegistration}
                disabled={isRegistering || !debugInfo.isSupported}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Test Registration'
                )}
              </Button>
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recent action queue rows</span>
                <span className="text-foreground">{debugInfo.recentQuestRows.length}</span>
              </div>

              {debugInfo.recentQuestRows.length > 0 ? (
                <div className="space-y-2">
                  {debugInfo.recentQuestRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground font-medium">{row.notification_type}</span>
                        <span className="text-muted-foreground font-mono text-xs">{row.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Scheduled: {new Date(row.scheduled_for).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Delivered: {row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "Not yet"}
                      </div>
                      {row.last_error && (
                        <div className="text-xs text-destructive break-all">
                          Reason: {row.last_error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent quest reminder or quest start queue activity</p>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Recent Queue Rows</span>
                <span className="text-foreground">{debugInfo.recentQueueRows.length}</span>
              </div>

              {debugInfo.recentQueueRows.length > 0 ? (
                <div className="space-y-2">
                  {debugInfo.recentQueueRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-foreground font-medium">{row.notification_type}</span>
                        <span className="text-muted-foreground font-mono text-xs">{row.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Scheduled: {new Date(row.scheduled_for).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Delivered: {row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "Not yet"}
                      </div>
                      {row.last_error && (
                        <div className="text-xs text-destructive break-all">
                          Reason: {row.last_error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent notification queue activity</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load debug info</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
});
PushDebugPanel.displayName = 'PushDebugPanel';
