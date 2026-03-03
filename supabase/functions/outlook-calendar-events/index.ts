import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite", "Tasks.ReadWrite"].join(" ");

type SyncMode = "send_only" | "full_sync";

type Action =
  | "createLinkedEvent"
  | "updateLinkedEvent"
  | "deleteLinkedEvent"
  | "syncLinkedChanges";

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  primary_calendar_id: string | null;
  sync_mode: SyncMode;
}

interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeAction(raw: string | undefined): Action | null {
  if (!raw) return null;
  const map: Record<string, Action> = {
    createLinkedEvent: "createLinkedEvent",
    create_linked_event: "createLinkedEvent",
    updateLinkedEvent: "updateLinkedEvent",
    update_linked_event: "updateLinkedEvent",
    deleteLinkedEvent: "deleteLinkedEvent",
    delete_linked_event: "deleteLinkedEvent",
    syncLinkedChanges: "syncLinkedChanges",
    sync_linked_changes: "syncLinkedChanges",
  };
  return map[raw] ?? null;
}

function normalizeSyncMode(mode: unknown): SyncMode {
  return mode === "full_sync" ? "full_sync" : "send_only";
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

function buildTimedDate(taskDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const base = new Date(`${taskDate}T00:00:00`);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

function getTaskEventWindow(task: DailyTask, fallbackDurationMinutes = 30): {
  isAllDay: boolean;
  start: Date;
  end: Date;
} {
  if (!task.task_date) {
    throw new Error("Task must have a date before sending to calendar");
  }

  if (!task.scheduled_time) {
    const start = new Date(`${task.task_date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { isAllDay: true, start, end };
  }

  const start = buildTimedDate(task.task_date, task.scheduled_time);
  const minutes = task.estimated_duration && task.estimated_duration > 0
    ? task.estimated_duration
    : fallbackDurationMinutes;

  const end = new Date(start.getTime() + minutes * 60_000);
  return { isAllDay: false, start, end };
}

const APP_DAY_TO_GRAPH_DAY = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const GRAPH_DAY_TO_APP_DAY: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};
const WEEKDAY_APP_DAYS = [0, 1, 2, 3, 4];

function toAppDayIndex(date: Date): number {
  const jsDay = date.getDay(); // 0=Sunday, 1=Monday, ...
  return jsDay === 0 ? 6 : jsDay - 1;
}

function toGraphDaysFromAppDays(days: number[]): string[] {
  const mapped = days
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .map((day) => APP_DAY_TO_GRAPH_DAY[day] as string);
  return Array.from(new Set(mapped));
}

function toAppDaysFromGraphDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  const mapped = days
    .map((day) => GRAPH_DAY_TO_APP_DAY[String(day).toLowerCase()])
    .filter((day) => Number.isInteger(day));
  return Array.from(new Set(mapped)).sort((a, b) => a - b) as number[];
}

function sameDaySet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((day, index) => day === b[index]);
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

function toTaskRecurrenceFields(event: Record<string, any>) {
  const recurrence = event.recurrence as Record<string, any> | undefined;
  const empty = {
    recurrence_pattern: null,
    recurrence_days: null,
    recurrence_month_days: null,
    recurrence_custom_period: null,
    recurrence_end_date: null,
    is_recurring: false,
  };

  if (!recurrence?.pattern) return empty;

  const pattern = recurrence.pattern as Record<string, any>;
  const range = (recurrence.range as Record<string, any> | undefined) ?? {};
  const patternType = String(pattern.type || "").toLowerCase();
  const interval = Number(pattern.interval || 1);
  const appDays = toAppDaysFromGraphDays(pattern.daysOfWeek);

  if (patternType === "daily") {
    return {
      recurrence_pattern: "daily",
      recurrence_days: [],
      recurrence_month_days: [],
      recurrence_custom_period: null,
      recurrence_end_date: range.type === "endDate" ? String(range.endDate || "").slice(0, 10) || null : null,
      is_recurring: true,
    };
  }

  if (patternType === "weekly") {
    const sortedDays = appDays.slice().sort((a, b) => a - b);
    const mappedPattern =
      interval === 2
        ? "biweekly"
        : interval === 1 && sameDaySet(sortedDays, WEEKDAY_APP_DAYS)
          ? "weekdays"
          : interval === 1 && sortedDays.length === 1
            ? "weekly"
            : "custom";

    return {
      recurrence_pattern: mappedPattern,
      recurrence_days: sortedDays,
      recurrence_month_days: [],
      recurrence_custom_period: mappedPattern === "custom" ? "week" : null,
      recurrence_end_date: range.type === "endDate" ? String(range.endDate || "").slice(0, 10) || null : null,
      is_recurring: true,
    };
  }

  if (patternType === "absolutemonthly" || patternType === "relativemonthly") {
    const dayOfMonth = Number(pattern.dayOfMonth);
    const normalizedDay = Number.isFinite(dayOfMonth) ? Math.min(31, Math.max(1, dayOfMonth)) : null;
    return {
      recurrence_pattern: "monthly",
      recurrence_days: [],
      recurrence_month_days: normalizedDay ? [normalizedDay] : [],
      recurrence_custom_period: null,
      recurrence_end_date: range.type === "endDate" ? String(range.endDate || "").slice(0, 10) || null : null,
      is_recurring: true,
    };
  }

  return empty;
}

function toOutlookEventPayload(task: DailyTask, override: Record<string, unknown> = {}) {
  const window = getTaskEventWindow(task);

  const subject = (override.title as string | undefined) ?? task.task_text;
  const bodyText = (override.description as string | undefined) ?? task.notes ?? "";
  const location = (override.location as string | undefined) ?? task.location ?? "";
  const recurrence = toOutlookRecurrence(task);
  const reminderEnabled = Boolean(task.reminder_enabled);
  const reminderMinutesBefore =
    task.reminder_minutes_before && task.reminder_minutes_before > 0 ? task.reminder_minutes_before : 15;

  return {
    subject,
    body: {
      contentType: "text",
      content: bodyText,
    },
    start: {
      dateTime: window.start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: window.end.toISOString(),
      timeZone: "UTC",
    },
    isAllDay: window.isAllDay,
    isReminderOn: reminderEnabled,
    reminderMinutesBeforeStart: reminderEnabled ? reminderMinutesBefore : undefined,
    recurrence,
    location: location ? { displayName: location } : undefined,
  };
}

function mapOutlookEventToTaskUpdate(event: Record<string, any>): Partial<DailyTask> {
  const title = (event.subject as string | undefined) ?? "(No title)";
  const location = (event.location?.displayName as string | undefined) ?? null;
  const notes = (event.body?.content as string | undefined) ?? null;

  const startIso = String(event.start?.dateTime || "");
  const endIso = String(event.end?.dateTime || "");
  const isAllDay = Boolean(event.isAllDay);

  if (!startIso) {
    return { task_text: title, location, notes };
  }

  const taskDate = startIso.slice(0, 10);
  const scheduledTime = isAllDay ? null : startIso.slice(11, 16);

  let estimatedDuration = 1440;
  if (!isAllDay && endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    estimatedDuration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  }
  const reminderEnabled = Boolean(event.isReminderOn);
  const reminderMinutesRaw = Number(event.reminderMinutesBeforeStart);
  const reminderMinutesBefore = reminderEnabled
    ? (Number.isFinite(reminderMinutesRaw) && reminderMinutesRaw > 0 ? reminderMinutesRaw : 15)
    : null;
  const recurrenceFields = toTaskRecurrenceFields(event);

  return {
    task_text: title,
    task_date: taskDate,
    scheduled_time: scheduledTime,
    estimated_duration: estimatedDuration,
    reminder_enabled: reminderEnabled,
    reminder_minutes_before: reminderMinutesBefore,
    recurrence_pattern: recurrenceFields.recurrence_pattern,
    recurrence_days: recurrenceFields.recurrence_days,
    recurrence_month_days: recurrenceFields.recurrence_month_days,
    recurrence_custom_period: recurrenceFields.recurrence_custom_period,
    recurrence_end_date: recurrenceFields.recurrence_end_date,
    location,
    notes,
  };
}

async function outlookApi(
  accessToken: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Outlook Calendar API ${method} ${path} failed: ${details}`);
  }

  if (resp.status === 204) return null;
  return await resp.json();
}

async function getTaskById(
  supabase: any,
  userId: string,
  taskId: string,
): Promise<DailyTask> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select(
      "id, user_id, task_text, task_date, scheduled_time, estimated_duration, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_days, recurrence_month_days, recurrence_custom_period, recurrence_end_date, location, notes",
    )
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Task not found");
  }

  return data as DailyTask;
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
    throw new Error("No Outlook Calendar connection found");
  }

  return data as CalendarConnection;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("OUTLOOK_CLIENT_ID");
    const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Outlook Calendar integration not configured" }, 500);
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

    if (action === "createLinkedEvent") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) {
        return jsonResponse({ error: "taskId is required" }, 400);
      }

      const task = await getTaskById(supabase, userId, taskId);
      const syncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode ?? connection.sync_mode);
      const externalCalendarId =
        (body?.calendarId || body?.calendar_id) as string | undefined ||
        connection.primary_calendar_id ||
        connection.calendar_id;

      if (!externalCalendarId) {
        return jsonResponse({ error: "No primary Outlook calendar selected" }, 400);
      }

      const eventPayload = toOutlookEventPayload(task, {
        title: body?.title,
        description: body?.description,
        location: body?.location,
      });

      const event = await outlookApi(
        accessToken,
        `/me/calendars/${encodeURIComponent(externalCalendarId)}/events`,
        "POST",
        eventPayload,
      );

      const nowIso = new Date().toISOString();
      const { error: linkError } = await supabase
        .from("quest_calendar_links")
        .upsert(
          {
            user_id: userId,
            task_id: task.id,
            connection_id: connection.id,
            provider: "outlook",
            external_calendar_id: externalCalendarId,
            external_event_id: event.id,
            sync_mode: syncMode,
            last_app_sync_at: nowIso,
            last_provider_sync_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "task_id,connection_id" },
        );

      if (linkError) {
        return jsonResponse({ error: "Failed to persist task link", details: linkError.message }, 500);
      }

      return jsonResponse({
        success: true,
        event,
        link: {
          taskId: task.id,
          connectionId: connection.id,
          externalEventId: event.id,
          externalCalendarId,
          syncMode,
        },
      });
    }

    if (action === "updateLinkedEvent") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) {
        return jsonResponse({ error: "taskId is required" }, 400);
      }

      const task = await getTaskById(supabase, userId, taskId);

      const { data: link, error: linkError } = await supabase
        .from("quest_calendar_links")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .eq("provider", "outlook")
        .maybeSingle();

      if (linkError || !link) {
        return jsonResponse({ error: "No linked Outlook calendar event found for task" }, 404);
      }

      const externalCalendarId =
        ((body?.calendarId || body?.calendar_id) as string | undefined) ||
        link.external_calendar_id ||
        connection.primary_calendar_id ||
        connection.calendar_id;

      if (!externalCalendarId) {
        return jsonResponse({ error: "No primary Outlook calendar selected" }, 400);
      }

      const eventPayload = toOutlookEventPayload(task, {
        title: body?.title,
        description: body?.description,
        location: body?.location,
      });

      const event = await outlookApi(
        accessToken,
        `/me/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
        "PATCH",
        eventPayload,
      );

      const nowIso = new Date().toISOString();
      await supabase
        .from("quest_calendar_links")
        .update({
          external_calendar_id: externalCalendarId,
          last_app_sync_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", link.id);

      return jsonResponse({ success: true, event });
    }

    if (action === "deleteLinkedEvent") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) {
        return jsonResponse({ error: "taskId is required" }, 400);
      }

      const { data: links, error: linksError } = await supabase
        .from("quest_calendar_links")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .eq("provider", "outlook");

      if (linksError) {
        return jsonResponse({ error: "Failed to fetch linked event", details: linksError.message }, 500);
      }

      for (const link of links ?? []) {
        const externalCalendarId = link.external_calendar_id || connection.primary_calendar_id || connection.calendar_id;
        if (!externalCalendarId) continue;

        try {
          await outlookApi(
            accessToken,
            `/me/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
            "DELETE",
          );
        } catch {
          // Best-effort delete.
        }

        await supabase.from("quest_calendar_links").delete().eq("id", link.id);
      }

      return jsonResponse({ success: true, deletedLinks: (links ?? []).length });
    }

    if (action === "syncLinkedChanges") {
      const { data: links, error: linksError } = await supabase
        .from("quest_calendar_links")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "outlook");

      if (linksError) {
        return jsonResponse({ error: "Failed to fetch links", details: linksError.message }, 500);
      }

      let synced = 0;
      let pulledProviderChanges = 0;
      let removedCancelled = 0;

      for (const link of links ?? []) {
        const externalCalendarId = link.external_calendar_id || connection.primary_calendar_id || connection.calendar_id;
        if (!externalCalendarId) continue;

        try {
          const event = await outlookApi(
            accessToken,
            `/me/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
            "GET",
          );

          const providerUpdatedAt = event?.lastModifiedDateTime ? new Date(event.lastModifiedDateTime) : null;
          const appSyncedAt = link.last_app_sync_at ? new Date(link.last_app_sync_at) : null;

          const providerWins =
            !appSyncedAt ||
            !providerUpdatedAt ||
            Number.isNaN(providerUpdatedAt.getTime())
              ? true
              : providerUpdatedAt.getTime() >= appSyncedAt.getTime();

          if (event?.isCancelled === true) {
            await supabase.from("daily_tasks").delete().eq("id", link.task_id).eq("user_id", userId);
            await supabase.from("quest_calendar_links").delete().eq("id", link.id);
            removedCancelled += 1;
            continue;
          }

          if (normalizeSyncMode(link.sync_mode) === "full_sync" && providerWins) {
            const taskPatch = mapOutlookEventToTaskUpdate(event);
            await supabase
              .from("daily_tasks")
              .update({
                task_text: taskPatch.task_text,
                task_date: taskPatch.task_date,
                scheduled_time: taskPatch.scheduled_time,
                estimated_duration: taskPatch.estimated_duration,
                reminder_enabled: taskPatch.reminder_enabled,
                reminder_minutes_before: taskPatch.reminder_minutes_before,
                recurrence_pattern: taskPatch.recurrence_pattern,
                recurrence_days: taskPatch.recurrence_days,
                recurrence_month_days: taskPatch.recurrence_month_days,
                recurrence_custom_period: taskPatch.recurrence_custom_period,
                recurrence_end_date: taskPatch.recurrence_end_date,
                is_recurring: Boolean(taskPatch.recurrence_pattern),
                location: taskPatch.location,
                notes: taskPatch.notes,
              })
              .eq("id", link.task_id)
              .eq("user_id", userId);

            pulledProviderChanges += 1;
          }

          await supabase
            .from("quest_calendar_links")
            .update({
              last_provider_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", link.id);

          synced += 1;
        } catch {
          await supabase.from("quest_calendar_links").delete().eq("id", link.id);
        }
      }

      return jsonResponse({
        success: true,
        linksChecked: synced,
        pulledProviderChanges,
        removedCancelled,
      });
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
});
