import { supabase } from "@/integrations/supabase/client";
import { NativeCalendar } from "@/plugins/NativeCalendarPlugin";
import { normalizeExternalCalendarEvent } from "@/types/externalCalendar";
import { calendarQuestSnapshot } from "@/utils/calendarSyncMerge";
import type { CalendarQuestImport } from "@/hooks/useCalendarQuestImports";
import { planCalendarSync } from "../../supabase/functions/_shared/calendarSyncPlan.ts";

const runs = new Map<string, Promise<void>>();
export function syncImportedCalendarQuest(link: CalendarQuestImport, userId: string, resolution?: "local" | "remote") {
  const key = `${userId}:${link.id}`;
  const running = runs.get(key); if (running) return running;
  const promise = sync(link, userId, resolution).finally(() => runs.delete(key));
  runs.set(key, promise); return promise;
}
async function sync(link: CalendarQuestImport, userId: string, resolution?: "local" | "remote") {
  if (!link.sync_enabled) return;
  const { data: token, error: claimError } = await supabase.rpc("claim_calendar_quest_sync" as never, {
    p_link_id: link.id, p_revision: link.revision,
  } as never);
  if (claimError) throw claimError;
  if (!token) return;
  try { await syncClaimed(link, userId, String(token), resolution); }
  finally { await supabase.rpc("release_calendar_quest_sync" as never, { p_link_id: link.id, p_token: token } as never); }
}
async function syncClaimed(link: CalendarQuestImport, userId: string, token: string, resolution?: "local" | "remote") {
  const { data: task, error: taskError } = await supabase.from("daily_tasks")
    .select("task_text,task_date,scheduled_time,estimated_duration,location,notes,completed")
    .eq("id", link.task_id).eq("user_id", userId).maybeSingle();
  if (taskError) throw taskError;
  if (!task || !link.sync_enabled) return;
  const isTask = link.resource_kind === "task";
  const local = calendarQuestSnapshot({ ...task, completed: isTask ? task.completed : undefined });
  const record = async (status: CalendarQuestImport["sync_status"], snapshot = local, error?: string) => {
    const { data, error: rpcError } = await supabase.rpc("apply_calendar_quest_sync" as never, {
      p_link_id: link.id, p_revision: link.revision, p_token: token, p_expected: local, p_snapshot: snapshot,
      p_status: status, p_error: error ?? null,
    } as never);
    if (rpcError) throw rpcError;
    if (!data) throw new Error("The quest changed during sync. It will be checked again.");
  };
  const cloud = async (action: string, extra = {}) => {
    const { data, error } = await supabase.functions.invoke(isTask ? "calendar-task-items" : "calendar-linked-event", {
      body: { action, linkId: link.id, revision: link.revision, syncToken: token, ...extra },
    });
    if (error) throw new Error("Calendar could not sync. Retry or reconnect it in Preferences.");
    return data;
  };
  const verifyNativeOwner = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error("Sign in again before syncing device calendars.");
    const { data: current, error: currentError } = await supabase.rpc("calendar_quest_sync_is_current" as never, {
      p_link_id: link.id, p_revision: link.revision, p_token: token,
    } as never);
    if (currentError || !current) throw new Error("This link changed or was paused. Refresh before syncing again.");
  };
  try {
    const response = link.provider !== "apple" ? await cloud("read") : isTask
      ? await NativeCalendar.getReminder({ id: link.external_id })
      : await NativeCalendar.getEvent({ eventId: link.external_id });
    if (response.missing || (isTask ? !response.task : !response.event)) {
      await record("missing", local, "The outside item is missing. Your quest has been kept."); return;
    }
    const item = isTask ? response.task : normalizeExternalCalendarEvent(response.event, link.provider, "Calendar");
    if (!item) throw new Error("This event could not be read safely.");
    const plan = planCalendarSync(link, local, item, resolution);
    if (plan.status === "unchanged") return;
    if (plan.status === "conflict") { await record("conflict", local, plan.error); return; }
    if (plan.task || plan.event) {
      if (link.provider === "apple") {
        await verifyNativeOwner();
        if (plan.task) await NativeCalendar.updateReminder({ ...plan.task, id: link.external_id, etag: response.task.etag ?? "" });
        else if (plan.event) {
          if (typeof response.event.modifiedAt !== "string" || !response.event.modifiedAt) throw new Error("This event has no safe update version. Open it in Apple Calendar to make changes.");
          const nativeDate = (date: string) => date.length === 10 ? new Date(`${date}T00:00:00`).toISOString() : date;
          await NativeCalendar.createOrUpdateEvent({ ...plan.event, calendarId: link.calendar_id, eventId: link.external_id,
            startDate: nativeDate(plan.event.startDate), endDate: nativeDate(plan.event.endDate), expectedModifiedAt: response.event.modifiedAt });
        }
      } else {
        const updated = await cloud("update", plan.task ? { task: plan.task, etag: response.task.etag } : { event: plan.event, etag: response.etag });
        if (updated.missing) { await record("missing", local, "The outside item disappeared. Your quest has been kept."); return; }
      }
    }
    await record("linked", plan.snapshot);
  } catch (error) {
    await record("retry", local, error instanceof Error ? error.message : "Calendar sync will retry.");
  }
}
