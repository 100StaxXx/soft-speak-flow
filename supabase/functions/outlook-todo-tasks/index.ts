import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite", "Tasks.ReadWrite"].join(" ");

type SyncMode = "send_only";

type Action =
  | "createLinkedTask"
  | "updateLinkedTask"
  | "deleteLinkedTask";

export interface TaskRecurrenceFields {
  recurrence_pattern: "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "custom" | null;
  recurrence_days: number[] | null;
  recurrence_month_days: number[] | null;
  recurrence_custom_period: "week" | "month" | null;
  recurrence_end_date: string | null;
  is_recurring: boolean;
}

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  primary_task_list_id: string | null;
  sync_mode: SyncMode;
}

interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  difficulty: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_month_days: number[] | null;
  recurrence_custom_period: "week" | "month" | null;
  recurrence_end_date: string | null;
  location: string | null;
  notes: string | null;
}

interface SubtaskRow {
  id: string;
  title: string;
  completed: boolean;
  sort_order: number;
}

interface OutlookTaskLink {
  id: string;
  task_id: string;
  user_id: string;
  connection_id: string;
  provider: "outlook";
  external_task_list_id: string;
  external_task_id: string;
  sync_mode: SyncMode;
  last_app_sync_at: string | null;
  last_provider_sync_at?: string | null;
}

const APP_DAY_TO_GRAPH_DAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const WEEKDAY_APP_DAYS = [0, 1, 2, 3, 4];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeAction(raw: string | undefined): Action | null {
  if (!raw) return null;
  const map: Record<string, Action> = {
    createLinkedTask: "createLinkedTask",
    create_linked_task: "createLinkedTask",
    updateLinkedTask: "updateLinkedTask",
    update_linked_task: "updateLinkedTask",
    deleteLinkedTask: "deleteLinkedTask",
    delete_linked_task: "deleteLinkedTask",
  };
  return map[raw] ?? null;
}

function normalizeSyncMode(mode: unknown): SyncMode {
  return "send_only";
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim() || null;
}

async function getAuthedUserId(supabaseAdmin: any, req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization bearer token");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user?.id) throw new Error("Unauthorized");
  return user.id;
}

async function refreshAccessTokenIfNeeded(
  supabase: any,
  connection: CalendarConnection,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const shouldRefresh =
    !connection.access_token ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh && connection.access_token) return connection.access_token;

  if (!connection.refresh_token) {
    throw new Error("No refresh token available. Please reconnect your Outlook account.");
  }

  const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Failed to refresh Outlook token: ${details}`);
  }

  const tokens = await tokenResponse.json();
  const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("user_calendar_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) {
    throw new Error(`Failed to persist refreshed token: ${updateError.message}`);
  }

  return tokens.access_token as string;
}

function toGraphDateTime(date: Date): string {
  return date.toISOString().replace("Z", "");
}

function toDateTimeTimeZone(date: Date) {
  return {
    dateTime: toGraphDateTime(date),
    timeZone: "UTC",
  };
}

function buildTimedDate(taskDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const base = new Date(`${taskDate}T00:00:00`);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

function toAppDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function toGraphDaysFromAppDays(days: number[]): string[] {
  const mapped = days
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .map((day) => APP_DAY_TO_GRAPH_DAY[day] as string);
  return Array.from(new Set(mapped));
}

function resolveRecurrenceDays(task: DailyTask): number[] {
  if (task.recurrence_days && task.recurrence_days.length > 0) {
    return Array.from(new Set(task.recurrence_days)).sort((a, b) => a - b);
  }

  if (task.task_date) {
    return [toAppDayIndex(new Date(`${task.task_date}T00:00:00`))];
  }

  return [];
}

function normalizeMonthDays(days: number[] | null | undefined): number[] {
  if (!Array.isArray(days)) return [];
  const mapped = days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31) as number[];
  return Array.from(new Set(mapped)).sort((a, b) => a - b);
}

function resolveMonthDays(task: DailyTask): number[] {
  const explicitMonthDays = normalizeMonthDays(task.recurrence_month_days);
  if (explicitMonthDays.length > 0) return explicitMonthDays;

  const fallbackDay = Number(task.task_date?.slice(8, 10));
  if (Number.isInteger(fallbackDay) && fallbackDay >= 1 && fallbackDay <= 31) {
    return [fallbackDay];
  }

  return [];
}

function toOutlookRecurrence(task: DailyTask): Record<string, unknown> | undefined {
  if (!task.task_date || !task.recurrence_pattern) return undefined;

  const pattern = String(task.recurrence_pattern).toLowerCase();
  let recurrencePattern: Record<string, unknown> | null = null;

  if (pattern === "daily") {
    recurrencePattern = { type: "daily", interval: 1 };
  } else if (pattern === "weekdays") {
    recurrencePattern = {
      type: "weekly",
      interval: 1,
      daysOfWeek: toGraphDaysFromAppDays(WEEKDAY_APP_DAYS),
    };
  } else if (pattern === "weekly") {
    recurrencePattern = {
      type: "weekly",
      interval: 1,
      daysOfWeek: toGraphDaysFromAppDays(resolveRecurrenceDays(task).slice(0, 1)),
    };
  } else if (pattern === "biweekly") {
    recurrencePattern = {
      type: "weekly",
      interval: 2,
      daysOfWeek: toGraphDaysFromAppDays(resolveRecurrenceDays(task).slice(0, 1)),
    };
  } else if (pattern === "custom") {
    const customPeriod = task.recurrence_custom_period ?? "week";
    if (customPeriod === "month") {
      const monthDays = resolveMonthDays(task);
      if (monthDays.length > 1) throw new Error("MULTI_DAY_MONTHLY_UNSUPPORTED");
      if (monthDays.length === 1) {
        recurrencePattern = {
          type: "absoluteMonthly",
          interval: 1,
          dayOfMonth: monthDays[0],
        };
      }
    } else {
      recurrencePattern = {
        type: "weekly",
        interval: 1,
        daysOfWeek: toGraphDaysFromAppDays(resolveRecurrenceDays(task)),
      };
    }
  } else if (pattern === "monthly") {
    const monthDays = resolveMonthDays(task);
    if (monthDays.length > 1) throw new Error("MULTI_DAY_MONTHLY_UNSUPPORTED");
    const dayOfMonth = monthDays[0] ?? Math.min(31, Math.max(1, Number(task.task_date.slice(8, 10))));
    recurrencePattern = {
      type: "absoluteMonthly",
      interval: 1,
      dayOfMonth,
    };
  }

  if (!recurrencePattern) return undefined;

  const range: Record<string, unknown> = {
    startDate: task.task_date,
  };

  if (task.recurrence_end_date) {
    range.type = "endDate";
    range.endDate = task.recurrence_end_date;
  } else {
    range.type = "noEnd";
  }

  return {
    pattern: recurrencePattern,
    range,
  };
}

function getTaskStartDate(task: DailyTask): Date | null {
  if (!task.task_date || !task.scheduled_time) return null;
  return buildTimedDate(task.task_date, task.scheduled_time);
}

function getTaskDueDate(task: DailyTask): Date | null {
  if (!task.task_date) return null;

  if (task.scheduled_time) {
    const start = buildTimedDate(task.task_date, task.scheduled_time);
    const minutes = task.estimated_duration && task.estimated_duration > 0 ? task.estimated_duration : 30;
    return new Date(start.getTime() + minutes * 60_000);
  }

  return new Date(`${task.task_date}T23:59:00`);
}

function getReminderDate(task: DailyTask, start: Date | null, due: Date | null): Date | null {
  if (!task.reminder_enabled) return null;

  const anchor = start ?? due;
  if (!anchor) return null;

  const reminderMinutes = task.reminder_minutes_before && task.reminder_minutes_before > 0
    ? task.reminder_minutes_before
    : 15;
  return new Date(anchor.getTime() - reminderMinutes * 60_000);
}

function difficultyToImportance(difficulty: string | null): "low" | "normal" | "high" {
  if (difficulty === "easy") return "low";
  if (difficulty === "hard") return "high";
  return "normal";
}

function toOutlookTodoPayload(task: DailyTask, override: Record<string, unknown> = {}) {
  const start = getTaskStartDate(task);
  const due = getTaskDueDate(task);
  const reminderDate = getReminderDate(task, start, due);

  const title = (override.title as string | undefined) ?? task.task_text;
  const bodyText = (override.description as string | undefined) ?? task.notes ?? "";

  return {
    title,
    body: {
      content: bodyText,
      contentType: "text",
    },
    importance: difficultyToImportance(task.difficulty),
    startDateTime: start ? toDateTimeTimeZone(start) : undefined,
    dueDateTime: due ? toDateTimeTimeZone(due) : undefined,
    isReminderOn: Boolean(reminderDate),
    reminderDateTime: reminderDate ? toDateTimeTimeZone(reminderDate) : undefined,
    recurrence: toOutlookRecurrence(task),
  };
}

async function outlookApi(
  accessToken: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${GRAPH_BASE}${path}`;

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Outlook To Do API ${method} ${path} failed (${resp.status}): ${details}`);
  }

  if (resp.status === 204) return null;
  return await resp.json();
}

function isOutlookNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("(404)") || message.includes("erroritemnotfound") || message.includes("not found");
}

async function getTaskById(
  supabase: any,
  userId: string,
  taskId: string,
): Promise<DailyTask> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select(
      "id, user_id, task_text, task_date, scheduled_time, estimated_duration, difficulty, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_days, recurrence_month_days, recurrence_custom_period, recurrence_end_date, location, notes",
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Task not found");
  }

  return data as DailyTask;
}

async function getTaskSubtasks(
  supabase: any,
  userId: string,
  taskId: string,
): Promise<SubtaskRow[]> {
  const { data, error } = await supabase
    .from("subtasks")
    .select("id, title, completed, sort_order")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []) as SubtaskRow[];
}

async function replaceSubtasksFromChecklist(
  supabase: any,
  userId: string,
  taskId: string,
  checklistItems: Array<{ displayName: string; isChecked: boolean }>,
) {
  const { error: deleteError } = await supabase
    .from("subtasks")
    .delete()
    .eq("user_id", userId)
    .eq("task_id", taskId);
  if (deleteError) throw deleteError;

  if (checklistItems.length === 0) return;

  const rows = checklistItems
    .map((item, index) => ({
      task_id: taskId,
      user_id: userId,
      title: item.displayName || "Untitled",
      completed: item.isChecked,
      sort_order: index,
    }))
    .filter((row) => row.title.trim().length > 0);

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("subtasks")
    .insert(rows);
  if (insertError) throw insertError;
}

async function getOutlookConnection(
  supabase: any,
  userId: string,
): Promise<CalendarConnection> {
  const { data, error } = await supabase
    .from("user_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "outlook")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No Outlook connection found");
  }

  return data as CalendarConnection;
}

async function getDefaultTaskListId(accessToken: string): Promise<string | null> {
  const payload = await outlookApi(accessToken, "/me/todo/lists", "GET");
  const lists = Array.isArray(payload?.value) ? payload.value : [];
  const defaultList = lists.find((item: Record<string, unknown>) =>
    String(item.wellknownListName || "").toLowerCase() === "defaultlist"
  ) ?? lists[0];

  return defaultList?.id ? String(defaultList.id) : null;
}

async function listChecklistItems(
  accessToken: string,
  taskListId: string,
  externalTaskId: string,
): Promise<Array<{ id: string; displayName: string; isChecked: boolean }>> {
  const payload = await outlookApi(
    accessToken,
    `/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}/checklistItems?$select=id,displayName,isChecked`,
    "GET",
  );
  const items = Array.isArray(payload?.value) ? payload.value : [];
  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id || ""),
    displayName: String(item.displayName || "Untitled"),
    isChecked: Boolean(item.isChecked),
  }));
}

async function syncChecklistItemsFromSubtasks(
  supabase: any,
  accessToken: string,
  userId: string,
  taskId: string,
  taskListId: string,
  externalTaskId: string,
) {
  const subtasks = await getTaskSubtasks(supabase, userId, taskId);
  const existing = await listChecklistItems(accessToken, taskListId, externalTaskId).catch(() => []);

  for (const item of existing) {
    try {
      await outlookApi(
        accessToken,
        `/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}/checklistItems/${encodeURIComponent(item.id)}`,
        "DELETE",
      );
    } catch {
      // Best-effort cleanup.
    }
  }

  for (const subtask of subtasks) {
    const created = await outlookApi(
      accessToken,
      `/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}/checklistItems`,
      "POST",
      { displayName: subtask.title },
    );

    if (subtask.completed) {
      try {
        await outlookApi(
          accessToken,
          `/me/todo/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(externalTaskId)}/checklistItems/${encodeURIComponent(String(created.id))}`,
          "PATCH",
          { isChecked: true },
        );
      } catch {
        // Best-effort completion state mirror.
      }
    }
  }
}

async function handleOutlookTodoTasks(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Outlook To Do integration not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);

    if (!action) {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = await getAuthedUserId(supabase, req);

    const connection = await getOutlookConnection(supabase, userId);
    const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, clientId, clientSecret);

    if (action === "createLinkedTask") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) return jsonResponse({ error: "taskId is required" }, 400);

      const task = await getTaskById(supabase, userId, taskId);
      const syncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode ?? connection.sync_mode);
      const externalTaskListId =
        (body?.taskListId || body?.task_list_id) as string | undefined ||
        connection.primary_task_list_id ||
        await getDefaultTaskListId(accessToken);

      if (!externalTaskListId) {
        return jsonResponse({ error: "No Outlook task list selected" }, 400);
      }

      const payload = toOutlookTodoPayload(task, {
        title: body?.title,
        description: body?.description,
      });

      const remoteTask = await outlookApi(
        accessToken,
        `/me/todo/lists/${encodeURIComponent(externalTaskListId)}/tasks`,
        "POST",
        payload,
      );

      const nowIso = new Date().toISOString();
      const { error: linkError } = await supabase
        .from("quest_outlook_task_links")
        .upsert(
          {
            user_id: userId,
            task_id: task.id,
            connection_id: connection.id,
            provider: "outlook",
            external_task_list_id: externalTaskListId,
            external_task_id: remoteTask.id,
            sync_mode: syncMode,
            last_app_sync_at: nowIso,
            last_provider_sync_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "task_id,connection_id" },
        );

      if (linkError) {
        return jsonResponse({ error: "Failed to persist Outlook To Do link", details: linkError.message }, 500);
      }

      await syncChecklistItemsFromSubtasks(
        supabase,
        accessToken,
        userId,
        task.id,
        externalTaskListId,
        String(remoteTask.id),
      );

      return jsonResponse({
        success: true,
        task: remoteTask,
        link: {
          taskId: task.id,
          connectionId: connection.id,
          externalTaskListId,
          externalTaskId: remoteTask.id,
          syncMode,
        },
      });
    }

    if (action === "updateLinkedTask") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) return jsonResponse({ error: "taskId is required" }, 400);

      const task = await getTaskById(supabase, userId, taskId);

      const { data: link, error: linkError } = await supabase
        .from("quest_outlook_task_links")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .eq("provider", "outlook")
        .maybeSingle();

      if (linkError || !link) {
        return jsonResponse({ error: "No linked Outlook To Do task found for quest" }, 404);
      }

      const externalTaskListId = link.external_task_list_id || connection.primary_task_list_id;
      if (!externalTaskListId) {
        return jsonResponse({ error: "No Outlook task list selected" }, 400);
      }

      const payload = toOutlookTodoPayload(task, {
        title: body?.title,
        description: body?.description,
      });

      const remoteTask = await outlookApi(
        accessToken,
        `/me/todo/lists/${encodeURIComponent(externalTaskListId)}/tasks/${encodeURIComponent(link.external_task_id)}`,
        "PATCH",
        payload,
      );

      const nowIso = new Date().toISOString();
      await supabase
        .from("quest_outlook_task_links")
        .update({
          last_app_sync_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", link.id);

      await syncChecklistItemsFromSubtasks(
        supabase,
        accessToken,
        userId,
        taskId,
        externalTaskListId,
        link.external_task_id,
      );

      return jsonResponse({ success: true, task: remoteTask });
    }

    if (action === "deleteLinkedTask") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) return jsonResponse({ error: "taskId is required" }, 400);

      const { data: links, error: linksError } = await supabase
        .from("quest_outlook_task_links")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .eq("provider", "outlook");

      if (linksError) {
        return jsonResponse({ error: "Failed to fetch linked Outlook tasks", details: linksError.message }, 500);
      }

      for (const rawLink of links ?? []) {
        const link = rawLink as OutlookTaskLink;
        try {
          await outlookApi(
            accessToken,
            `/me/todo/lists/${encodeURIComponent(link.external_task_list_id)}/tasks/${encodeURIComponent(link.external_task_id)}`,
            "DELETE",
          );
        } catch {
          // Best-effort delete.
        }

        await supabase.from("quest_outlook_task_links").delete().eq("id", link.id);
      }

      return jsonResponse({ success: true, deletedLinks: (links ?? []).length });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.includes("MULTI_DAY_MONTHLY_UNSUPPORTED")
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }
}

if (import.meta.main) {
  Deno.serve(handleOutlookTodoTasks);
}

export { handleOutlookTodoTasks };
