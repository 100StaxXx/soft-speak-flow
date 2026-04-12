import type { NotificationType } from "../_shared/notificationsV2.ts";
import {
  composeNotificationCopy,
  type CompanionNotificationContext,
} from "../_shared/notificationComposer.ts";

export interface QueueDeliverySourceRow {
  source_table: string;
  source_id: string;
  notification_type: NotificationType;
  payload: Record<string, unknown> | null;
}

export interface QueueStatusUpdate {
  status: "failed_terminal";
  delivered: true;
  delivered_at: string;
  attempt_count: number;
  next_retry_at: null;
  last_error: string;
}

export interface QueueSourceAcknowledgement {
  table: string;
  id: string;
  updates: Record<string, unknown>;
}

export interface QueueDeliveryCopyRow {
  notification_type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
}

export const TERMINAL_NO_DEVICE_ERROR = "no_device_tokens";

function shouldRefreshCompanionLedCopy(notificationType: NotificationType): boolean {
  return notificationType === "daily_pep" || notificationType === "mentor_nudge";
}

export function resolveDeliveryCopy(
  row: QueueDeliveryCopyRow,
  companion?: CompanionNotificationContext | null,
): { title: string; body: string } {
  if (!shouldRefreshCompanionLedCopy(row.notification_type)) {
    return {
      title: row.title,
      body: row.body,
    };
  }

  const copy = composeNotificationCopy({
    type: row.notification_type,
    payload: row.payload ?? {},
    companion,
  });

  return {
    title: copy.title,
    body: typeof row.body === "string" && row.body.trim().length > 0 ? row.body : copy.body,
  };
}

export function buildNoDeviceTokenFailureUpdate(
  attemptCount: number,
  nowIso: string,
): QueueStatusUpdate {
  return {
    status: "failed_terminal",
    delivered: true,
    delivered_at: nowIso,
    attempt_count: attemptCount,
    next_retry_at: null,
    last_error: TERMINAL_NO_DEVICE_ERROR,
  };
}

export function resolveSourceAcknowledgement(
  row: QueueDeliverySourceRow,
  deliveredAtIso: string,
): QueueSourceAcknowledgement | null {
  if (!row.source_table || !row.source_id) return null;

  if (row.source_table === "user_daily_pushes") {
    return {
      table: "user_daily_pushes",
      id: row.source_id,
      updates: { delivered_at: deliveredAtIso },
    };
  }

  if (row.source_table === "user_daily_quote_pushes") {
    return {
      table: "user_daily_quote_pushes",
      id: row.source_id,
      updates: { delivered_at: deliveredAtIso },
    };
  }

  if (row.source_table === "daily_tasks") {
    if (row.notification_type === "task_start") {
      return {
        table: "daily_tasks",
        id: row.source_id,
        updates: { start_notification_sent: true },
      };
    }

    if (row.notification_type === "task_reminder") {
      return {
        table: "daily_tasks",
        id: row.source_id,
        updates: { reminder_sent: true },
      };
    }
  }

  if (row.source_table === "habits") {
    const payloadLocalDate = row.payload?.local_date;
    return {
      table: "habits",
      id: row.source_id,
      updates: {
        reminder_last_sent_for_date: typeof payloadLocalDate === "string" ? payloadLocalDate : null,
      },
    };
  }

  if (row.source_table === "contact_reminders") {
    return {
      table: "contact_reminders",
      id: row.source_id,
      updates: { sent: true, sent_at: deliveredAtIso },
    };
  }

  if (row.source_table === "mentor_nudges") {
    return {
      table: "mentor_nudges",
      id: row.source_id,
      updates: { push_sent_at: deliveredAtIso },
    };
  }

  return null;
}
