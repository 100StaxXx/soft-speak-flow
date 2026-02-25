import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import { sendAPNSNotification } from "../_shared/apns.ts";
import {
  addMinutes,
  getLocalDateTimeParts,
  getRetryDelayMinutes,
  isCriticalNotification,
  isUserInRolloutCohort,
  minutesBetween,
  normalizeTimezone,
  parseIntEnv,
  type NotificationType,
} from "../_shared/notificationsV2.ts";

interface QueueRow {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  scheduled_for: string;
  source_table: string;
  source_id: string;
  payload: Record<string, unknown> | null;
  attempt_count: number | null;
  status: string;
}

interface DeliveryBudgetState {
  timezone: string;
  localDate: string;
  sentTodayCount: number;
  lastSentAt: Date | null;
}

const TERMINAL_NO_DEVICE_ERROR = "no_device_tokens";

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function claimQueueRow(supabase: any, rowId: string, workerId: string): Promise<QueueRow | null> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("push_notification_queue")
    .update({
      status: "processing",
      claimed_at: nowIso,
      claimed_by: workerId,
    })
    .eq("id", rowId)
    .in("status", ["queued", "retry"])
    .select("id, user_id, notification_type, title, body, scheduled_for, source_table, source_id, payload, attempt_count, status")
    .maybeSingle();

  if (error) {
    console.error("[notifications-dispatch-v2] claim failed", rowId, error);
    return null;
  }

  return (data as QueueRow | null) ?? null;
}

async function updateQueueStatus(
  supabase: any,
  id: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("push_notification_queue")
    .update({
      ...updates,
      claimed_at: null,
      claimed_by: null,
    })
    .eq("id", id);

  if (error) {
    console.error("[notifications-dispatch-v2] status update failed", id, error);
  }
}

async function acknowledgeSourceDelivery(
  supabase: any,
  row: QueueRow,
  deliveredAtIso: string,
): Promise<void> {
  const sourceTable = row.source_table;
  const sourceId = row.source_id;

  if (!sourceTable || !sourceId) return;

  if (sourceTable === "user_daily_pushes") {
    await supabase.from("user_daily_pushes").update({ delivered_at: deliveredAtIso }).eq("id", sourceId);
    return;
  }

  if (sourceTable === "daily_tasks") {
    if (row.notification_type === "task_start") {
      await supabase.from("daily_tasks").update({ start_notification_sent: true }).eq("id", sourceId);
    } else if (row.notification_type === "task_reminder") {
      await supabase.from("daily_tasks").update({ reminder_sent: true }).eq("id", sourceId);
    }
    return;
  }

  if (sourceTable === "habits") {
    await supabase.from("habits").update({ reminder_sent_today: true }).eq("id", sourceId);
    return;
  }

  if (sourceTable === "contact_reminders") {
    await supabase
      .from("contact_reminders")
      .update({ sent: true, sent_at: deliveredAtIso })
      .eq("id", sourceId);
    return;
  }

  if (sourceTable === "mentor_nudges") {
    await supabase
      .from("mentor_nudges")
      .update({ push_sent_at: deliveredAtIso })
      .eq("id", sourceId);
  }
}

async function loadBudgetState(
  supabase: any,
  userId: string,
  now: Date,
): Promise<DeliveryBudgetState> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  const timezone = normalizeTimezone(profile?.timezone ?? "UTC");
  const localDate = getLocalDateTimeParts(now, timezone).localDate;

  const sinceIso = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();
  const { data: sentRows } = await supabase
    .from("push_notification_queue")
    .select("delivered_at")
    .eq("user_id", userId)
    .eq("status", "sent")
    .not("delivered_at", "is", null)
    .gte("delivered_at", sinceIso)
    .order("delivered_at", { ascending: false })
    .limit(20);

  let sentTodayCount = 0;
  let lastSentAt: Date | null = null;

  for (const sentRow of sentRows ?? []) {
    const deliveredAt = toDateOrNull(sentRow.delivered_at as string | null | undefined);
    if (!deliveredAt) continue;

    if (!lastSentAt || deliveredAt > lastSentAt) {
      lastSentAt = deliveredAt;
    }

    const deliveredLocalDate = getLocalDateTimeParts(deliveredAt, timezone).localDate;
    if (deliveredLocalDate === localDate) {
      sentTodayCount += 1;
    }
  }

  return { timezone, localDate, sentTodayCount, lastSentAt };
}

function budgetDecision(input: {
  row: QueueRow;
  state: DeliveryBudgetState;
  now: Date;
}): { allow: boolean; reason?: string } {
  const { row, state, now } = input;
  const isCritical = isCriticalNotification(row.notification_type);

  if (state.sentTodayCount >= 2) {
    return { allow: false, reason: "daily_cap_reached" };
  }

  if (state.sentTodayCount === 1 && !isCritical) {
    return { allow: false, reason: "soft_target_enforced" };
  }

  if (state.lastSentAt) {
    const minutesSinceLast = minutesBetween(now, state.lastSentAt);
    if (minutesSinceLast < 240) {
      const scheduledFor = toDateOrNull(row.scheduled_for);
      const overdueMinutes = scheduledFor ? minutesBetween(now, scheduledFor) : 0;
      const allowCriticalOverride = isCritical && overdueMinutes > 30;

      if (!allowCriticalOverride) {
        return { allow: false, reason: "spacing_guard" };
      }
    }
  }

  return { allow: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (!auth.isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const mode = (Deno.env.get("NOTIFICATIONS_V2_MODE") ?? "shadow").toLowerCase();
    const rollbackEnabled = (Deno.env.get("NOTIFICATIONS_V2_ROLLBACK_TO_LEGACY") ?? "false").toLowerCase() === "true";
    const rolloutPercent = Math.max(0, Math.min(100, parseIntEnv("NOTIFICATIONS_V2_ROLLOUT_PERCENT", 0)));
    const maxAttempts = Math.max(1, parseIntEnv("NOTIFICATIONS_V2_MAX_ATTEMPTS", 5));
    const batchSize = Math.max(1, parseIntEnv("NOTIFICATIONS_V2_DISPATCH_BATCH_SIZE", 100));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const workerId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: dueRows, error: fetchError } = await supabase
      .from("push_notification_queue")
      .select("id, user_id, notification_type, title, body, scheduled_for, source_table, source_id, payload, attempt_count, status")
      .in("status", ["queued", "retry"])
      .lte("scheduled_for", nowIso)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("priority", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(batchSize);

    if (fetchError) throw fetchError;

    const budgetCache = new Map<string, DeliveryBudgetState>();

    let processed = 0;
    let sent = 0;
    let retried = 0;
    let failedTerminal = 0;
    let skippedBudget = 0;
    let skippedRollout = 0;
    let shadowed = 0;

    for (const candidate of (dueRows as QueueRow[] | null) ?? []) {
      const row = await claimQueueRow(supabase, candidate.id, workerId);
      if (!row) continue;

      processed += 1;
      const attemptCount = (row.attempt_count ?? 0) + 1;

      if (rollbackEnabled) {
        skippedRollout += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "skipped_rollout",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          last_error: "rollback_enabled",
          next_retry_at: null,
        });
        continue;
      }

      if (mode === "shadow") {
        shadowed += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "shadow",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          last_error: "shadow_mode",
          next_retry_at: null,
        });
        continue;
      }

      if (mode !== "send") {
        skippedRollout += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "skipped_rollout",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          last_error: `unknown_mode:${mode}`,
          next_retry_at: null,
        });
        continue;
      }

      const inCohort = await isUserInRolloutCohort(row.user_id, rolloutPercent);
      if (!inCohort) {
        skippedRollout += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "skipped_rollout",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          last_error: `rollout_${rolloutPercent}`,
          next_retry_at: null,
        });
        continue;
      }

      if (!budgetCache.has(row.user_id)) {
        budgetCache.set(row.user_id, await loadBudgetState(supabase, row.user_id, now));
      }
      const budgetState = budgetCache.get(row.user_id)!;

      const budget = budgetDecision({ row, state: budgetState, now });
      if (!budget.allow) {
        skippedBudget += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "skipped_budget",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          last_error: budget.reason,
          next_retry_at: null,
        });
        continue;
      }

      const { data: deviceTokens, error: tokenError } = await supabase
        .from("push_device_tokens")
        .select("id, device_token")
        .eq("user_id", row.user_id)
        .eq("platform", "ios");

      if (tokenError) {
        const nextRetryAt = addMinutes(now, getRetryDelayMinutes(attemptCount));
        retried += 1;
        await updateQueueStatus(supabase, row.id, {
          status: attemptCount < maxAttempts ? "retry" : "failed_terminal",
          delivered: attemptCount >= maxAttempts,
          delivered_at: attemptCount >= maxAttempts ? nowIso : null,
          attempt_count: attemptCount,
          next_retry_at: attemptCount < maxAttempts ? nextRetryAt.toISOString() : null,
          last_error: `token_query_failed:${tokenError.message}`,
        });
        if (attemptCount >= maxAttempts) failedTerminal += 1;
        continue;
      }

      if (!deviceTokens || deviceTokens.length === 0) {
        failedTerminal += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "failed_terminal",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          next_retry_at: null,
          last_error: TERMINAL_NO_DEVICE_ERROR,
        });
        continue;
      }

      let successCount = 0;
      let transientFailure = false;
      let terminalReason: string | null = null;
      const tokenIdsToDelete: string[] = [];

      for (const token of deviceTokens) {
        try {
          const sendResult = await sendAPNSNotification(token.device_token, {
            title: row.title,
            body: row.body,
            data: {
              ...(row.payload ?? {}),
              queue_id: row.id,
              type: row.notification_type,
            },
          });

          if (sendResult.success) {
            successCount += 1;
            continue;
          }

          if (sendResult.shouldDeleteToken) {
            tokenIdsToDelete.push(token.id);
          }

          if (sendResult.terminal) {
            terminalReason = sendResult.reason ?? `terminal_status_${sendResult.status}`;
          } else {
            transientFailure = true;
          }
        } catch (error) {
          transientFailure = true;
          const message = error instanceof Error ? error.message : String(error);
          console.error("[notifications-dispatch-v2] send failed", row.id, token.id, message);
        }
      }

      if (tokenIdsToDelete.length > 0) {
        await supabase
          .from("push_device_tokens")
          .delete()
          .in("id", tokenIdsToDelete);
      }

      if (successCount > 0) {
        sent += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "sent",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          next_retry_at: null,
          last_error: null,
        });
        await acknowledgeSourceDelivery(supabase, row, nowIso);

        budgetState.sentTodayCount += 1;
        budgetState.lastSentAt = now;
        continue;
      }

      if (transientFailure && attemptCount < maxAttempts) {
        retried += 1;
        const nextRetryAt = addMinutes(now, getRetryDelayMinutes(attemptCount));
        await updateQueueStatus(supabase, row.id, {
          status: "retry",
          delivered: false,
          delivered_at: null,
          attempt_count: attemptCount,
          next_retry_at: nextRetryAt.toISOString(),
          last_error: terminalReason ?? "transient_delivery_failure",
        });
      } else {
        failedTerminal += 1;
        await updateQueueStatus(supabase, row.id, {
          status: "failed_terminal",
          delivered: true,
          delivered_at: nowIso,
          attempt_count: attemptCount,
          next_retry_at: null,
          last_error: terminalReason ?? "delivery_failed",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        sent,
        retried,
        failed_terminal: failedTerminal,
        skipped_budget: skippedBudget,
        skipped_rollout: skippedRollout,
        shadowed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[notifications-dispatch-v2] fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
