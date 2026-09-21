import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type Provider = "google" | "outlook";
type Connection = {
  id: string; user_id: string; access_token: string | null; refresh_token: string | null;
  token_expires_at: string | null; primary_calendar_id: string | null;
  calendar_id: string | null; primary_calendar_name: string | null;
};
type Dependencies = {
  createClient: typeof createClient;
  fetch: typeof fetch;
  env: (name: string) => string | undefined;
};
class CalendarError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function parseRange(body: Record<string, unknown>) {
  const start = typeof body.startDate === "string" ? new Date(body.startDate) : new Date(NaN);
  const end = typeof body.endDate === "string" ? new Date(body.endDate) : new Date(NaN);
  const span = end.getTime() - start.getTime();
  if (!Number.isFinite(span) || span <= 0 || span > 62 * 86400000) {
    throw new CalendarError("Choose a valid calendar range of at most 62 days.", 400);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function normalizeEvent(provider: Provider, event: any, calendarId: string, calendarName: string) {
  if (!event?.id || event.status === "cancelled" || event.isCancelled === true) return null;
  const isAllDay = provider === "google" ? Boolean(event.start?.date) : event.isAllDay === true;
  const utc = (value: unknown) => typeof value === "string"
    ? (/(Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`) : "";
  const startDate = provider === "google" ? event.start?.date ?? event.start?.dateTime
    : isAllDay ? event.start?.dateTime?.slice(0, 10) : utc(event.start?.dateTime);
  const endDate = provider === "google" ? event.end?.date ?? event.end?.dateTime
    : isAllDay ? event.end?.dateTime?.slice(0, 10) : utc(event.end?.dateTime);
  if (typeof startDate !== "string" || typeof endDate !== "string"
      || !Number.isFinite(Date.parse(startDate)) || !(Date.parse(endDate) > Date.parse(startDate))) return null;
  return {
    id: String(event.id), title: (provider === "google" ? event.summary : event.subject) || "Busy",
    startDate, endDate, isAllDay, calendarId, calendarName,
    location: provider === "google" ? event.location ?? null : event.location?.displayName ?? null,
    htmlLink: provider === "google" ? event.htmlLink ?? null : event.webLink ?? null,
    notes: provider === "google" ? event.description ?? null : event.bodyPreview ?? null,
    meetingUrl: provider === "google" ? event.hangoutLink ?? event.conferenceData?.entryPoints?.find((item: any) => item.entryPointType === "video")?.uri ?? null : event.onlineMeeting?.joinUrl ?? null,
    isRecurring: Boolean(event.recurringEventId || event.recurrence || event.seriesMasterId),
    availability: provider === "google" ? event.transparency === "transparent" ? "free" : "busy" : event.showAs ?? "busy",
  };
}

/** This endpoint cannot write external events, quests, or completion/progress data. */
export function createCalendarReadHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
    if (req.method === "OPTIONS") return respond({});
    if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
    try {
      const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) throw new CalendarError("Sign in to connect your calendars.", 401);
      const db = deps.createClient(deps.env("SUPABASE_URL")!, deps.env("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: auth, error: authError } = await db.auth.getUser(token);
      if (authError || !auth.user?.id) throw new CalendarError("Your session needs to be refreshed. Please retry.", 401);
      const userId = auth.user.id;
      const body = await req.json().catch(() => { throw new CalendarError("Invalid calendar request.", 400); });
      const provider: Provider = body?.provider;
      if ((provider !== "google" && provider !== "outlook") || body.action !== "listEvents") {
        throw new CalendarError("Unsupported calendar request.", 400);
      }
      const range = parseRange(body);
      const { data, error } = await db.from("user_calendar_connections")
        .select("id,user_id,access_token,refresh_token,token_expires_at,primary_calendar_id,calendar_id,primary_calendar_name")
        .eq("user_id", userId).eq("provider", provider).eq("sync_enabled", true).maybeSingle();
      if (error) throw new CalendarError("Calendar connection could not be loaded. Please retry.", 503);
      if (!data) throw new CalendarError("Connect this calendar in Preferences first.", 409);
      const connection = data as Connection;
      const primaryCalendarId = connection.primary_calendar_id || connection.calendar_id || (provider === "google" ? "primary" : "");
      const calendarId = typeof body.calendarId === "string" ? body.calendarId : primaryCalendarId;
      if (calendarId !== primaryCalendarId) {
        const { data: settings, error: settingsError } = await db.from("calendar_user_settings").select("visible_calendars").eq("user_id", userId).maybeSingle();
        if (settingsError || !Array.isArray(settings?.visible_calendars?.[provider]) || !settings.visible_calendars[provider].includes(calendarId)) {
          throw new CalendarError("Select this calendar in Preferences, then retry.", 409);
        }
      }
      if (!calendarId) {
        throw new CalendarError("Select a calendar in Preferences, then retry.", 409);
      }
      const fetchWithTimeout = (url: string, init?: RequestInit) => deps.fetch(url, {
        ...init, signal: AbortSignal.timeout(20000),
      });
      const getAccessToken = async (force = false): Promise<string> => {
        if (!force && connection.access_token && Date.parse(connection.token_expires_at ?? "") > Date.now() + 60000) {
          return connection.access_token;
        }
        if (!connection.refresh_token) throw new CalendarError(`Reconnect ${provider === "google" ? "Google" : "Outlook"} in Preferences.`, 409);
        const clientId = deps.env(provider === "google" ? "GOOGLE_CALENDAR_CLIENT_ID" : "OUTLOOK_CLIENT_ID");
        const clientSecret = deps.env(provider === "google" ? "GOOGLE_CALENDAR_CLIENT_SECRET" : "OUTLOOK_CLIENT_SECRET");
        if (!clientId || !clientSecret) throw new CalendarError("Calendar integration is not configured.", 503);
        const response = await fetchWithTimeout(provider === "google" ? "https://oauth2.googleapis.com/token"
          : "https://login.microsoftonline.com/common/oauth2/v2.0/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
            grant_type: "refresh_token", refresh_token: connection.refresh_token }),
        });
        if (!response.ok) throw new CalendarError(response.status >= 500
          ? "Your calendar provider is temporarily unavailable. Please retry."
          : "Calendar authorization expired. Reconnect it in Preferences.", response.status >= 500 ? 503 : 409);
        const tokens = await response.json();
        if (typeof tokens.access_token !== "string") throw new CalendarError("Calendar token refresh failed. Please retry.", 502);
        const expiry = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
        // Microsoft may rotate refresh tokens: retain the new one, or preserve the old one if omitted.
        const refreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : connection.refresh_token;
        const { error: saveError } = await db.from("user_calendar_connections").update({
          access_token: tokens.access_token, refresh_token: refreshToken, token_expires_at: expiry,
          updated_at: new Date().toISOString(),
        }).eq("id", connection.id).eq("user_id", userId);
        if (saveError) throw new CalendarError("Calendar authorization could not be saved. Please retry.", 503);
        connection.access_token = tokens.access_token;
        connection.refresh_token = refreshToken;
        connection.token_expires_at = expiry;
        return tokens.access_token;
      };
      let accessToken = await getAccessToken();
      let calendarName = calendarId === primaryCalendarId ? connection.primary_calendar_name || `${provider} Calendar` : `${provider === 'google' ? 'Google' : 'Outlook'} Calendar`;
      if (calendarId !== primaryCalendarId) {
        const metadataUrl = provider === "google"
          ? `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`
          : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}?$select=name`;
        const metadataResponse = await fetchWithTimeout(metadataUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          calendarName = metadata.summary || metadata.name || calendarName;
        }
      }
      let refreshedAfterUnauthorized = false;
      const query = provider === "google" ? new URLSearchParams({
        timeMin: range.start, timeMax: range.end, singleEvents: "true", orderBy: "startTime", maxResults: "2500",
      }) : new URLSearchParams({ startDateTime: range.start, endDateTime: range.end,
        "$select": "id,subject,start,end,isAllDay,isCancelled,location,webLink,bodyPreview,onlineMeeting,seriesMasterId,showAs", "$top": "1000" });
      const initialUrl = provider === "google"
        ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`
        : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${query}`;
      let nextUrl: string | null = initialUrl;
      const events: NonNullable<ReturnType<typeof normalizeEvent>>[] = [];
      for (let page = 0; nextUrl && page < 10; page += 1) {
        const target = new URL(nextUrl);
        if (target.protocol !== "https:" || target.hostname !== (provider === "google" ? "www.googleapis.com" : "graph.microsoft.com")) {
          throw new CalendarError("Unexpected calendar pagination response.", 502);
        }
        const read = () => fetchWithTimeout(nextUrl!, { headers: {
          Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"',
        } });
        let response = await read();
        if (response.status === 401 && !refreshedAfterUnauthorized) {
          refreshedAfterUnauthorized = true;
          accessToken = await getAccessToken(true);
          response = await read();
        }
        if (!response.ok) throw new CalendarError(response.status === 401 || response.status === 403
          ? "Calendar access needs approval. Reconnect it in Preferences."
          : "Your calendar provider is temporarily unavailable. Please retry.", response.status === 401 || response.status === 403 ? 409 : 503);
        const payload = await response.json();
        for (const raw of (provider === "google" ? payload.items : payload.value) ?? []) {
          const event = normalizeEvent(provider, raw, calendarId, calendarName);
          if (event) events.push({ ...event, connectionId: connection.id } as typeof event);
        }
        if (provider === "google") {
          const next = new URL(initialUrl);
          if (payload.nextPageToken) next.searchParams.set("pageToken", payload.nextPageToken);
          nextUrl = payload.nextPageToken ? next.toString() : null;
        } else nextUrl = payload["@odata.nextLink"] || null;
      }
      if (nextUrl) throw new CalendarError("This calendar range is too large. Try a shorter range.", 422);
      return respond({ events, syncedAt: new Date().toISOString() });
    } catch (error) {
      return respond({ error: error instanceof CalendarError ? error.message : "Calendar is temporarily unavailable. Please retry." },
        error instanceof CalendarError ? error.status : 503);
    }
  };
}

export const handleCalendarReadEvents = createCalendarReadHandler({ createClient, fetch, env: (key) => Deno.env.get(key) });
if (import.meta.main) Deno.serve(handleCalendarReadEvents);
