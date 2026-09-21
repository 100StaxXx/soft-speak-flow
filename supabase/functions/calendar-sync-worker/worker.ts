import { calendarAccessToken } from "../_shared/calendarConnectionAccess.ts";
import { calendarSyncWriteAllowed, validCalendarEtag, validCalendarDate } from "../_shared/calendarSyncLease.ts";
import { calendarQuestSnapshot } from "../_shared/calendarSyncMerge.ts";
import { planCalendarSync, type SyncLink } from "../_shared/calendarSyncPlan.ts";
import { normalizeEvent } from "../calendar-read-events/index.ts";
import { eventPatch } from "../calendar-linked-event/index.ts";
import { normalizeProviderTask } from "../calendar-task-items/index.ts";

export interface WorkerLink extends SyncLink {
  id: string; user_id: string; task_id: string; connection_id: string;
  provider: "google" | "outlook"; calendar_id: string; external_id: string;
  revision: number; sync_token: string; sync_enabled: boolean;
}
export interface WorkerDeps {
  db: any; fetch: typeof fetch; env: (name: string) => string | undefined;
  now?: () => number;
}
class RetryError extends Error {
  constructor(message: string, readonly retrySeconds = 0) { super(message); }
}
const taskColumns = "task_text,task_date,scheduled_time,estimated_duration,location,notes,completed";

export function linkedItemUrl(link: WorkerLink) {
  const list = encodeURIComponent(link.calendar_id), id = encodeURIComponent(link.external_id);
  if (link.resource_kind === "task") return link.provider === "google"
    ? `https://tasks.googleapis.com/tasks/v1/lists/${list}/tasks/${id}`
    : `https://graph.microsoft.com/v1.0/me/todo/lists/${list}/tasks/${id}`;
  return link.provider === "google"
    ? `https://www.googleapis.com/calendar/v3/calendars/${list}/events/${id}`
    : `https://graph.microsoft.com/v1.0/me/calendars/${list}/events/${id}`;
}

export async function syncBackgroundLink(link: WorkerLink, runToken: string, deps: WorkerDeps) {
  const { db } = deps;
  // Defence in depth: never process arbitrary accounts, Apple, paused or blocked links.
  if (!["google", "outlook"].includes(link.provider) || !link.sync_enabled
    || !["linked", "retry"].includes(link.sync_status)) return;
  const { data: task, error: taskError } = await db.from("daily_tasks").select(taskColumns)
    .eq("id", link.task_id).eq("user_id", link.user_id).maybeSingle();
  if (taskError || !task) throw new Error("Linked quest is unavailable");
  const local = calendarQuestSnapshot({ ...task, completed: link.resource_kind === "task" ? task.completed : undefined });
  const record = async (status: string, snapshot = local, message: string | null = null, retrySeconds = 0) => {
    const result = await db.rpc("finish_calendar_background_sync", {
      p_user_id: link.user_id, p_link_id: link.id, p_revision: link.revision, p_token: link.sync_token,
      p_expected: local, p_snapshot: snapshot, p_status: status, p_error: message, p_retry_seconds: retrySeconds,
    });
    if (result.error) throw new Error("Sync result could not be saved");
    return result.data === true;
  };
  try {
    const { data: conn, error } = await db.from("user_calendar_connections").select("*")
      .eq("id", link.connection_id).eq("user_id", link.user_id).eq("provider", link.provider).eq("sync_enabled", true).maybeSingle();
    if (error || !conn) throw new RetryError("Reconnect this account in Preferences.");
    const access = await calendarAccessToken(db, conn, deps.env, deps.fetch);
    const headers = { Authorization: `Bearer ${access}`, Prefer: 'outlook.timezone="UTC"' };
    const request = async (init?: RequestInit) => {
      const response = await deps.fetch(linkedItemUrl(link), { headers, ...init, signal: AbortSignal.timeout(20000) });
      if (response.status === 404 || response.status === 410) return null;
      if (response.status === 412) throw new RetryError("This item changed elsewhere. It will be checked again.");
      if (!response.ok) {
        const retry = response.headers.get("Retry-After");
        const retrySeconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : 0;
        throw new RetryError(response.status === 401 || response.status === 403
          ? "Reconnect this account and approve calendar/task access."
          : "The calendar provider is temporarily unavailable.", Number.isFinite(retrySeconds) ? Math.max(0, retrySeconds) : 0);
      }
      return response;
    };
    const response = await request();
    if (!response) return await record("missing", local, "The outside item is missing. Your quest has been kept.");
    const raw = await response.json();
    if (raw.deleted || raw.status === "cancelled" || raw.isCancelled === true) return await record("missing", local, "The outside item is missing. Your quest has been kept.");
    const item = link.resource_kind === "task" ? normalizeProviderTask(link.provider, raw, link.calendar_id)
      : normalizeEvent(link.provider, raw, link.calendar_id, "Calendar");
    if (!item) throw new RetryError("This item could not be read safely.");
    const plan = planCalendarSync(link, local, item);
    if (plan.status === "conflict") return await record("conflict", local, plan.error);
    if (plan.status === "unchanged") return await record("linked");
    if (plan.event || plan.task) {
      const etag = raw.etag || raw["@odata.etag"];
      if (!validCalendarEtag(etag)) throw new RetryError("This item has no safe update version. Open it in its calendar to edit.");
      let patch: unknown;
      if (plan.event) patch = eventPatch(link.provider, plan.event);
      else {
        const task = plan.task!;
        if (!task.title.trim() || task.title.length > 1024 || (task.dueDate !== null && !validCalendarDate(task.dueDate))) throw new RetryError("Choose a valid task title and date.");
        patch = { title: task.title, status: task.completed ? "completed" : link.provider === "google" ? "needsAction" : "notStarted",
          ...(link.provider === "google" ? { due: task.dueDate ? `${task.dueDate}T00:00:00Z` : null }
            : { dueDateTime: task.dueDate ? { dateTime: `${task.dueDate}T00:00:00`, timeZone: "UTC" } : null }) };
      }
      const { data: control, error: controlError } = await db.from("calendar_sync_worker_control").select("enabled,run_token,lease_until").eq("singleton", true).maybeSingle();
      if (controlError || !control?.enabled || control.run_token !== runToken || !(Date.parse(control.lease_until) > Date.now())
        || !await calendarSyncWriteAllowed(db, link.user_id, link.id, link.revision, link.sync_token)) {
        throw new RetryError("This sync was paused or changed. It will be checked again.");
      }
      const updated = await request({ method: "PATCH", headers: { ...headers, "Content-Type": "application/json", "If-Match": etag }, body: JSON.stringify(patch) });
      if (!updated) return await record("missing", local, "The outside item disappeared. Your quest has been kept.");
    }
    return await record("linked", plan.snapshot);
  } catch (error) {
    // Never persist raw provider bodies, credentials or private event content.
    return await record("retry", local, error instanceof RetryError ? error.message : "Calendar sync could not finish. It will retry.",
      error instanceof RetryError ? error.retrySeconds : 0);
  }
}

/** Bounded, globally leased dispatcher; claims one link at a time, not an expiring batch. */
export async function runCalendarSyncWorker(deps: WorkerDeps) {
  const { data: token, error } = await deps.db.rpc("claim_calendar_sync_worker");
  if (error) throw new Error("Worker claim failed");
  if (!token) return { processed: 0, failed: 0 };
  const now = deps.now ?? Date.now, deadline = now() + 50000;
  let processed = 0, failed = 0;
  try {
    while (processed < 10 && now() < deadline) {
      const claim = await deps.db.rpc("claim_next_calendar_background_sync", { p_run_token: token });
      if (claim.error) throw new Error("Calendar queue is unavailable");
      const link = claim.data?.[0];
      if (!link) break;
      try { await syncBackgroundLink(link, token, deps); } catch { failed++; }
      processed++;
    }
  } finally {
    // If execution is interrupted, per-link and dispatcher leases expire safely.
    await deps.db.rpc("release_calendar_sync_worker", { p_run_token: token });
  }
  return { processed, failed };
}
