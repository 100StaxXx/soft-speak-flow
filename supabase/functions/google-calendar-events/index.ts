import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getLocalDateTimeParts, toScheduledDateTime } from "../_shared/notificationsV2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type SyncMode = "send_only";

type Action =
  | "listEvents"
  | "listRangeEvents"
  | "createLinkedEvent"
  | "updateLinkedEvent"
  | "deleteLinkedEvent";

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  primary_calendar_id: string | null;
  primary_calendar_name: string | null;
  sync_mode: SyncMode;
  last_synced_at?: string | null;
}

interface DailyTask {
  id: string;
  user_id: string;
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  location: string | null;
  notes: string | null;
}

interface ProfileRow {
  timezone: string | null;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeAction(raw: string | undefined): Action | null {
  if (!raw) return null;

  const map: Record<string, Action> = {
    listEvents: "listEvents",
    list_events: "listEvents",
    listRangeEvents: "listRangeEvents",
    list_range_events: "listRangeEvents",
    createLinkedEvent: "createLinkedEvent",
    create_linked_event: "createLinkedEvent",
    updateLinkedEvent: "updateLinkedEvent",
    update_linked_event: "updateLinkedEvent",
    deleteLinkedEvent: "deleteLinkedEvent",
    delete_linked_event: "deleteLinkedEvent",
  };

  return map[raw] ?? null;
}

function parseEventRange(body: Record<string, unknown>): { startDate: string; endDate: string } {
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (
    !startDate
    || !endDate
    || Number.isNaN(start.getTime())
    || Number.isNaN(end.getTime())
    || end <= start
  ) {
    throw new Error("A valid startDate and endDate range is required");
  }

  if (end.getTime() - start.getTime() > 62 * 24 * 60 * 60 * 1000) {
    throw new Error("Calendar event range cannot exceed 62 days");
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

const readRangeDateTime = (value: unknown): string | null => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export function mapGoogleRangeEvent(
  event: Record<string, any>,
  connectionId: string,
) {
  const allDayStart = typeof event.start?.date === "string"
    ? `${event.start.date}T00:00:00.000Z`
    : null;
  const allDayEnd = typeof event.end?.date === "string"
    ? `${event.end.date}T00:00:00.000Z`
    : null;
  const startTime = typeof event.start?.dateTime === "string"
    ? event.start.dateTime
    : allDayStart;
  const endTime = typeof event.end?.dateTime === "string"
    ? event.end.dateTime
    : allDayEnd;

  if (!event.id || !startTime || !endTime) return null;

  return {
    id: `google:${connectionId}:${event.id}`,
    external_event_id: String(event.id),
    title: typeof event.summary === "string" && event.summary.trim()
      ? event.summary.trim().slice(0, 200)
      : "Busy",
    description: typeof event.description === "string"
      ? event.description.slice(0, 1000)
      : null,
    start_time: startTime,
    end_time: endTime,
    is_all_day: Boolean(event.start?.date && !event.start?.dateTime),
    location: typeof event.location === "string"
      ? event.location.slice(0, 300)
      : null,
    source: "google",
    read_only: true,
  };
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
  if (!token) {
    throw new Error("Missing Authorization bearer token");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user?.id) {
    throw new Error("Unauthorized");
  }

  return user.id;
}

async function refreshAccessTokenIfNeeded(
  supabase: any,
  connection: CalendarConnection,
  googleClientId: string,
  googleClientSecret: string,
): Promise<string> {
  const existingAccessToken = connection.access_token;
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;

  const shouldRefresh =
    !existingAccessToken ||
    !expiresAt ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

  if (!shouldRefresh && existingAccessToken) {
    return existingAccessToken;
  }

  if (!connection.refresh_token) {
    throw new Error("No refresh token available. Please reconnect your Google account.");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`Failed to refresh Google token: ${details}`);
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

function buildTimedDate(taskDate: string, hhmm: string, timezone: string | null | undefined): Date {
  const scheduledAt = toScheduledDateTime(taskDate, hhmm, timezone);
  if (!scheduledAt) {
    throw new Error("Task has an invalid scheduled time for the selected timezone");
  }

  return scheduledAt;
}

function getTaskEventWindow(task: DailyTask, timezone: string | null | undefined, fallbackDurationMinutes = 30): {
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

  const start = buildTimedDate(task.task_date, task.scheduled_time, timezone);
  const minutes = task.estimated_duration && task.estimated_duration > 0
    ? task.estimated_duration
    : fallbackDurationMinutes;

  const end = new Date(start.getTime() + minutes * 60_000);
  return { isAllDay: false, start, end };
}

export function toGoogleEventPayload(
  task: DailyTask,
  timezone: string | null | undefined,
  override: Record<string, unknown> = {},
) {
  const window = getTaskEventWindow(task, timezone);

  const title = (override.title as string | undefined) ?? task.task_text;
  const location = (override.location as string | undefined) ?? task.location ?? undefined;
  const description = (override.description as string | undefined) ?? task.notes ?? undefined;

  if (window.isAllDay) {
    return {
      summary: title,
      location,
      description,
      start: { date: task.task_date || undefined },
      end: { date: new Date(window.end).toISOString().slice(0, 10) },
    };
  }

  return {
    summary: title,
    location,
    description,
    start: { dateTime: window.start.toISOString() },
    end: { dateTime: window.end.toISOString() },
  };
}

function toLocalTaskDateTime(date: Date, timezone: string | null | undefined): {
  taskDate: string;
  scheduledTime: string;
} {
  const parts = getLocalDateTimeParts(date, timezone || "UTC");
  return {
    taskDate: parts.localDate,
    scheduledTime: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

export function mapGoogleEventToTaskUpdate(
  event: Record<string, any>,
  timezone: string | null | undefined,
): Partial<DailyTask> {
  const title = (event.summary as string | undefined) ?? "(No title)";
  const location = (event.location as string | undefined) ?? null;
  const notes = (event.description as string | undefined) ?? null;

  const start = event.start || {};
  const end = event.end || {};

  if (start.date && end.date) {
    return {
      task_text: title,
      task_date: String(start.date),
      scheduled_time: null,
      estimated_duration: 1440,
      location,
      notes,
    };
  }

  const startIso = String(start.dateTime || "");
  const endIso = String(end.dateTime || "");

  if (!startIso) {
    return {
      task_text: title,
      location,
      notes,
    };
  }

  const startDateObj = new Date(startIso);
  if (Number.isNaN(startDateObj.getTime())) {
    return {
      task_text: title,
      location,
      notes,
    };
  }

  const parsedEndDateObj = endIso ? new Date(endIso) : null;
  const endDateObj = parsedEndDateObj && !Number.isNaN(parsedEndDateObj.getTime())
    ? parsedEndDateObj
    : new Date(startDateObj.getTime() + 30 * 60_000);

  const localStart = toLocalTaskDateTime(startDateObj, timezone);
  const estimatedDuration = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / 60_000));

  return {
    task_text: title,
    task_date: localStart.taskDate,
    scheduled_time: localStart.scheduledTime,
    estimated_duration: estimatedDuration,
    location,
    notes,
  };
}

export function toGoogleExternalCalendarEvent(
  event: Record<string, any>,
  calendarId: string,
  calendarName: string,
) {
  const id = typeof event.id === "string" ? event.id : "";
  const startDate = typeof event.start?.date === "string"
    ? event.start.date
    : typeof event.start?.dateTime === "string"
      ? event.start.dateTime
      : "";
  const endDate = typeof event.end?.date === "string"
    ? event.end.date
    : typeof event.end?.dateTime === "string"
      ? event.end.dateTime
      : "";

  if (!id || !startDate || !endDate || event.status === "cancelled") return null;

  return {
    id,
    title: typeof event.summary === "string" && event.summary.trim() ? event.summary : "Busy",
    startDate,
    endDate,
    isAllDay: Boolean(event.start?.date),
    location: typeof event.location === "string" ? event.location : null,
    calendarId,
    calendarName,
    htmlLink: typeof event.htmlLink === "string" ? event.htmlLink : null,
  };
}

async function googleApi(
  accessToken: string,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const resp = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const details = await resp.text();
    throw new Error(`Google Calendar API ${method} ${path} failed: ${details}`);
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
    .select("id, user_id, task_text, task_date, scheduled_time, estimated_duration, location, notes")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Task not found");
  }

  return data as DailyTask;
}

async function getUserTimezone(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  return (data as ProfileRow | null)?.timezone || "UTC";
}

async function getGoogleConnection(
  supabase: any,
  userId: string,
): Promise<CalendarConnection> {
  const { data, error } = await supabase
    .from("user_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No Google Calendar connection found");
  }

  return data as CalendarConnection;
}

async function handleGoogleCalendarEvents(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

    if (!googleClientId || !googleClientSecret) {
      return jsonResponse({ error: "Google Calendar integration not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const action = normalizeAction(body?.action);

    if (!action) {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userId = await getAuthedUserId(supabase, req);

    const connection = await getGoogleConnection(supabase, userId);
    const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, googleClientId, googleClientSecret);

    if (action === "listEvents") {
      const range = parseEventRange(body as Record<string, unknown>);
      const externalCalendarId =
        (body?.calendarId || body?.calendar_id) as string | undefined
        || connection.primary_calendar_id
        || connection.calendar_id
        || "primary";
      const calendarName = connection.primary_calendar_name || "Google Calendar";
      const query = new URLSearchParams({
        timeMin: range.startDate,
        timeMax: range.endDate,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
      });
      const events = [];
      let nextPageToken: string | null = null;
      let pageCount = 0;

      do {
        if (nextPageToken) query.set("pageToken", nextPageToken);
        const response = await googleApi(
          accessToken,
          `/calendars/${encodeURIComponent(externalCalendarId)}/events?${query.toString()}`,
        );
        events.push(
          ...(Array.isArray(response?.items) ? response.items : [])
            .map((event: Record<string, unknown>) =>
              toGoogleExternalCalendarEvent(event, externalCalendarId, calendarName))
            .filter(Boolean),
        );
        nextPageToken = typeof response?.nextPageToken === "string" ? response.nextPageToken : null;
        pageCount += 1;
      } while (nextPageToken && pageCount < 10);
      const syncedAt = new Date().toISOString();

      await supabase
        .from("user_calendar_connections")
        .update({ last_synced_at: syncedAt, updated_at: syncedAt })
        .eq("id", connection.id);

      return jsonResponse({ events, syncedAt });
    }

    if (action === "listRangeEvents") {
      const startDateTime = readRangeDateTime(
        body?.startDateTime ?? body?.start_date_time,
      );
      const endDateTime = readRangeDateTime(
        body?.endDateTime ?? body?.end_date_time,
      );
      if (!startDateTime || !endDateTime) {
        return jsonResponse(
          { error: "startDateTime and endDateTime are required" },
          400,
        );
      }
      const rangeMs = new Date(endDateTime).getTime() -
        new Date(startDateTime).getTime();
      if (rangeMs <= 0 || rangeMs > 32 * 24 * 60 * 60 * 1000) {
        return jsonResponse({ error: "Calendar range must be 1 to 32 days" }, 400);
      }

      const externalCalendarId =
        (body?.calendarId || body?.calendar_id) as string | undefined ||
        connection.primary_calendar_id ||
        connection.calendar_id ||
        "primary";
      const query = new URLSearchParams({
        timeMin: startDateTime,
        timeMax: endDateTime,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });
      const response = await googleApi(
        accessToken,
        `/calendars/${encodeURIComponent(externalCalendarId)}/events?${query.toString()}`,
      );
      const events = (Array.isArray(response?.items) ? response.items : [])
        .filter((event: Record<string, unknown>) => event.status !== "cancelled")
        .map((event: Record<string, any>) =>
          mapGoogleRangeEvent(event, connection.id)
        )
        .filter(Boolean);

      return jsonResponse({
        success: true,
        provider: "google",
        calendarId: externalCalendarId,
        events,
      });
    }

    if (action === "createLinkedEvent") {
      const taskId = (body?.taskId || body?.task_id) as string | undefined;
      if (!taskId) {
        return jsonResponse({ error: "taskId is required" }, 400);
      }

      const task = await getTaskById(supabase, userId, taskId);
      const timezone = await getUserTimezone(supabase, userId);
      const syncMode = normalizeSyncMode(body?.syncMode ?? body?.sync_mode ?? connection.sync_mode);
      const externalCalendarId =
        (body?.calendarId || body?.calendar_id) as string | undefined ||
        connection.primary_calendar_id ||
        connection.calendar_id ||
        "primary";

      const eventPayload = toGoogleEventPayload(task, timezone, {
        title: body?.title,
        description: body?.description,
        location: body?.location,
      });

      const event = await googleApi(
        accessToken,
        `/calendars/${encodeURIComponent(externalCalendarId)}/events`,
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
            provider: "google",
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
      const timezone = await getUserTimezone(supabase, userId);

      const { data: link, error: linkError } = await supabase
        .from("quest_calendar_links")
        .select("*")
        .eq("user_id", userId)
        .eq("task_id", taskId)
        .eq("provider", "google")
        .maybeSingle();

      if (linkError || !link) {
        return jsonResponse({ error: "No linked Google calendar event found for task" }, 404);
      }

      const externalCalendarId =
        ((body?.calendarId || body?.calendar_id) as string | undefined) ||
        link.external_calendar_id ||
        connection.primary_calendar_id ||
        connection.calendar_id ||
        "primary";

      const eventPayload = toGoogleEventPayload(task, timezone, {
        title: body?.title,
        description: body?.description,
        location: body?.location,
      });

      const event = await googleApi(
        accessToken,
        `/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
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
        .eq("provider", "google");

      if (linksError) {
        return jsonResponse({ error: "Failed to fetch linked event", details: linksError.message }, 500);
      }

      for (const link of links ?? []) {
        const externalCalendarId =
          link.external_calendar_id || connection.primary_calendar_id || connection.calendar_id || "primary";

        try {
          await googleApi(
            accessToken,
            `/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
            "DELETE",
          );
        } catch {
          // Best-effort delete; continue cleanup.
        }

        await supabase.from("quest_calendar_links").delete().eq("id", link.id);
      }

      return jsonResponse({ success: true, deletedLinks: (links ?? []).length });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.toLowerCase().includes("unauthorized")
      ? 401
      : message.toLowerCase().includes("range")
        ? 400
        : 500;
    return jsonResponse({ error: message }, status);
  }
}

if (import.meta.main) {
  Deno.serve(handleGoogleCalendarEvents);
}

export { handleGoogleCalendarEvents };
