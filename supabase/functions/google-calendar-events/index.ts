import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type SyncMode = "send_only" | "full_sync";

type Action =
  | "createLinkedEvent"
  | "updateLinkedEvent"
  | "deleteLinkedEvent"
  | "syncLinkedChanges"
  | "legacySync"
  | "legacyGetEvents"
  | "legacyClearCache";

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

    // Backward-compatible aliases
    sync: "legacySync",
    get_events: "legacyGetEvents",
    clear_cache: "legacyClearCache",
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

async function getAuthedUserId(supabaseAdmin: ReturnType<typeof createClient>, req: Request): Promise<string> {
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
  supabase: ReturnType<typeof createClient>,
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

function toGoogleEventPayload(task: DailyTask, override: Record<string, unknown> = {}) {
  const window = getTaskEventWindow(task);

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

function mapGoogleEventToTaskUpdate(event: Record<string, any>): Partial<DailyTask> {
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
  const endDateObj = endIso ? new Date(endIso) : new Date(startDateObj.getTime() + 30 * 60_000);

  const taskDate = startIso.slice(0, 10);
  const scheduledTime = startIso.slice(11, 16);
  const estimatedDuration = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / 60_000));

  return {
    task_text: title,
    task_date: taskDate,
    scheduled_time: scheduledTime,
    estimated_duration: estimatedDuration,
    location,
    notes,
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
  supabase: ReturnType<typeof createClient>,
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

async function getGoogleConnection(
  supabase: ReturnType<typeof createClient>,
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

Deno.serve(async (req) => {
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

    // Backward-compatible legacy endpoints still used by older clients.
    if (action === "legacyGetEvents") {
      const startDate = (body?.startDate || body?.start_date) as string | undefined;
      const endDate = (body?.endDate || body?.end_date) as string | undefined;

      if (!startDate || !endDate) {
        return jsonResponse({ error: "startDate and endDate are required" }, 400);
      }

      const { data: events, error } = await supabase
        .from("external_calendar_events")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "google")
        .gte("start_time", new Date(startDate).toISOString())
        .lte("start_time", new Date(endDate).toISOString())
        .order("start_time", { ascending: true });

      if (error) {
        return jsonResponse({ error: "Failed to fetch events", details: error.message }, 500);
      }

      return jsonResponse({ events: events ?? [] });
    }

    if (action === "legacyClearCache") {
      const { error } = await supabase
        .from("external_calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("source", "google");

      if (error) {
        return jsonResponse({ error: "Failed to clear event cache", details: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    const connection = await getGoogleConnection(supabase, userId);
    const accessToken = await refreshAccessTokenIfNeeded(supabase, connection, googleClientId, googleClientSecret);

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
        connection.calendar_id ||
        "primary";

      const eventPayload = toGoogleEventPayload(task, {
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

      const eventPayload = toGoogleEventPayload(task, {
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

    if (action === "legacySync" || action === "syncLinkedChanges") {
      const { data: links, error: linksError } = await supabase
        .from("quest_calendar_links")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", "google");

      if (linksError) {
        return jsonResponse({ error: "Failed to fetch links", details: linksError.message }, 500);
      }

      let synced = 0;
      let pulledProviderChanges = 0;
      let removedCancelled = 0;

      for (const link of links ?? []) {
        const externalCalendarId =
          link.external_calendar_id || connection.primary_calendar_id || connection.calendar_id || "primary";

        try {
          const event = await googleApi(
            accessToken,
            `/calendars/${encodeURIComponent(externalCalendarId)}/events/${encodeURIComponent(link.external_event_id)}`,
            "GET",
          );

          const providerUpdatedAt = event?.updated ? new Date(event.updated) : null;
          const appSyncedAt = link.last_app_sync_at ? new Date(link.last_app_sync_at) : null;

          const providerWins =
            !appSyncedAt ||
            !providerUpdatedAt ||
            Number.isNaN(providerUpdatedAt.getTime())
              ? true
              : providerUpdatedAt.getTime() >= appSyncedAt.getTime();

          if (event?.status === "cancelled") {
            await supabase.from("daily_tasks").delete().eq("id", link.task_id).eq("user_id", userId);
            await supabase.from("quest_calendar_links").delete().eq("id", link.id);
            removedCancelled += 1;
            continue;
          }

          if (normalizeSyncMode(link.sync_mode) === "full_sync" && providerWins) {
            const taskPatch = mapGoogleEventToTaskUpdate(event);
            await supabase
              .from("daily_tasks")
              .update({
                task_text: taskPatch.task_text,
                task_date: taskPatch.task_date,
                scheduled_time: taskPatch.scheduled_time,
                estimated_duration: taskPatch.estimated_duration,
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
          // If event no longer exists remotely, drop local link. Keep quest.
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
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
