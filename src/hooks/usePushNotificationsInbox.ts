import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { resolvePushNotificationDestination } from "@/utils/pushNotificationNavigation";
import { PRODUCT, type ProductMode } from "@/config/product";

export const PUSH_NOTIFICATIONS_INBOX_QUERY_KEY = "push-notifications-inbox";
export const PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY = "push-notifications-unread-count";

const RECENT_NOTIFICATION_LIMIT = 30;

type PushNotificationQueueRow = Pick<
  Database["public"]["Tables"]["push_notification_queue"]["Row"],
  | "id"
  | "notification_type"
  | "title"
  | "body"
  | "payload"
  | "delivered_at"
  | "read_at"
  | "opened_at"
> & Partial<Pick<
  Database["public"]["Tables"]["push_notification_queue"]["Row"],
  | "source_table"
  | "source_id"
>>;

type DailyTaskRitualSourceRow = Pick<
  Database["public"]["Tables"]["daily_tasks"]["Row"],
  | "id"
  | "habit_source_id"
>;

export interface PushNotificationInboxItem {
  id: string;
  type: string;
  sourceLabel: string;
  title: string;
  body: string;
  deliveredAt: string;
  readAt: string | null;
  openedAt: string | null;
  destinationPath: string;
}

export const getPushNotificationsInboxQueryKey = (userId: string | undefined) =>
  [PUSH_NOTIFICATIONS_INBOX_QUERY_KEY, userId ?? "anonymous"] as const;

export const getPushNotificationsUnreadCountQueryKey = (userId: string | undefined) =>
  [PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY, userId ?? "anonymous"] as const;

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isTaskNotificationType = (type: string): boolean =>
  type === "task_start" || type === "task_reminder";

function hasRitualPayloadHint(payloadInput: unknown): boolean {
  const payload = readRecord(payloadInput);
  if (!payload) return false;

  return payload.is_ritual === true
    || Boolean(readString(payload.habit_source_id) ?? readString(payload.habitSourceId));
}

function getTaskIdFromNotificationRow(row: PushNotificationQueueRow): string | null {
  if (row.source_table === "daily_tasks") {
    return readString(row.source_id);
  }

  const payload = readRecord(row.payload);
  return readString(payload?.task_id) ?? readString(payload?.taskId);
}

function isRitualTaskNotificationRow(
  row: PushNotificationQueueRow,
  ritualTaskIds?: ReadonlySet<string>,
): boolean {
  if (!isTaskNotificationType(row.notification_type)) return false;
  if (hasRitualPayloadHint(row.payload)) return true;

  const taskId = getTaskIdFromNotificationRow(row);
  return Boolean(taskId && ritualTaskIds?.has(taskId));
}

export function getPushNotificationSourceLabel(
  type: string,
  payloadInput?: unknown,
  options: { isRitualTask?: boolean; productMode?: ProductMode } = {},
): string {
  const isRitualTask = options.isRitualTask === true || hasRitualPayloadHint(payloadInput);
  const productMode = options.productMode ?? PRODUCT.mode;

  switch (type) {
    case "daily_pep":
      return productMode === "christian" ? "Daily Grace" : "Daily encouragement";
    case "daily_quote":
      return "Daily quote";
    case "task_start":
      return isRitualTask ? "Rhythm ready" : "Action ready";
    case "task_reminder":
      return isRitualTask ? "Rhythm reminder" : "Action reminder";
    case "habit_reminder":
      return "Rhythm reminder";
    case "contact_reminder":
      return "Contact reminder";
    case "mentor_nudge":
      return "Guide note";
    case "checkin_morning_reminder":
      return "Morning check-in";
    case "checkin_evening_reminder":
      return "Evening Reflection";
    case "plan_day_overdue":
      return "Planner alert";
    default:
      return PRODUCT.name;
  }
}

export function mapPushNotificationRowToInboxItem(
  row: PushNotificationQueueRow,
  options: { ritualTaskIds?: ReadonlySet<string> } = {},
): PushNotificationInboxItem {
  const isRitualTask = isRitualTaskNotificationRow(row, options.ritualTaskIds);

  return {
    id: row.id,
    type: row.notification_type,
    sourceLabel: getPushNotificationSourceLabel(row.notification_type, row.payload, { isRitualTask }),
    title: row.title,
    body: row.body,
    deliveredAt: row.delivered_at ?? row.opened_at ?? row.read_at ?? "",
    readAt: row.read_at,
    openedAt: row.opened_at,
    destinationPath: resolvePushNotificationDestination(row.payload, row.notification_type),
  };
}

async function fetchRitualDailyTaskIdsForNotificationRows(
  userId: string,
  rows: readonly PushNotificationQueueRow[],
): Promise<Set<string>> {
  const taskIds = Array.from(new Set(
    rows
      .filter((row) => isTaskNotificationType(row.notification_type))
      .filter((row) => !hasRitualPayloadHint(row.payload))
      .map(getTaskIdFromNotificationRow)
      .filter((taskId): taskId is string => Boolean(taskId)),
  ));

  if (taskIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("daily_tasks")
    .select("id, habit_source_id")
    .eq("user_id", userId)
    .in("id", taskIds);

  if (error) {
    console.warn("Failed to resolve ritual notification sources", error);
    return new Set();
  }

  return new Set(
    ((data ?? []) as DailyTaskRitualSourceRow[])
      .filter((task) => Boolean(task.habit_source_id))
      .map((task) => task.id),
  );
}

export async function fetchPushNotificationInboxItems(userId: string): Promise<PushNotificationInboxItem[]> {
  const { data, error } = await supabase
    .from("push_notification_queue")
    .select("id, notification_type, title, body, payload, delivered_at, read_at, opened_at, source_table, source_id")
    .eq("user_id", userId)
    .eq("status", "sent")
    .not("delivered_at", "is", null)
    .order("delivered_at", { ascending: false })
    .limit(RECENT_NOTIFICATION_LIMIT);

  if (error) throw error;

  const rows = (data ?? []) as PushNotificationQueueRow[];
  const ritualTaskIds = await fetchRitualDailyTaskIdsForNotificationRows(userId, rows);

  return rows.map((row) => mapPushNotificationRowToInboxItem(row, { ritualTaskIds }));
}

export async function fetchUnreadPushNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("push_notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "sent")
    .not("delivered_at", "is", null)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export function usePushNotificationsInbox(options: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const enabled = options.enabled !== false && Boolean(userId);

  const invalidateNotifications = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_INBOX_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [PUSH_NOTIFICATIONS_UNREAD_COUNT_QUERY_KEY] });
  }, [queryClient]);

  const inboxQuery = useQuery({
    queryKey: getPushNotificationsInboxQueryKey(userId),
    enabled,
    queryFn: () => fetchPushNotificationInboxItems(userId!),
    staleTime: 30_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: getPushNotificationsUnreadCountQueryKey(userId),
    enabled,
    queryFn: () => fetchUnreadPushNotificationCount(userId!),
    staleTime: 15_000,
  });

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc("mark_push_notification_read", {
        p_queue_id: notificationId,
      });
      if (error) throw error;
    },
    onSuccess: invalidateNotifications,
  });

  const markOpened = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc("mark_push_notification_opened", {
        p_queue_id: notificationId,
      });
      if (error) throw error;
    },
    onSuccess: invalidateNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_all_push_notifications_read");
      if (error) throw error;
    },
    onSuccess: invalidateNotifications,
  });

  const unreadCount = unreadCountQuery.data ?? 0;
  const items = inboxQuery.data ?? [];

  return useMemo(() => ({
    items,
    unreadCount,
    isLoading: inboxQuery.isLoading || unreadCountQuery.isLoading,
    isError: inboxQuery.isError || unreadCountQuery.isError,
    markRead: markRead.mutateAsync,
    markOpened: markOpened.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    isMarkingAllRead: markAllRead.isPending,
    invalidateNotifications,
  }), [
    inboxQuery.isError,
    inboxQuery.isLoading,
    invalidateNotifications,
    items,
    markAllRead.isPending,
    markAllRead.mutateAsync,
    markOpened.mutateAsync,
    markRead.mutateAsync,
    unreadCount,
    unreadCountQuery.isError,
    unreadCountQuery.isLoading,
  ]);
}
