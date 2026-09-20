import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { normalizeEvent } from "../calendar-read-events/index.ts";
import { calendarAccessToken } from "../_shared/calendarConnectionAccess.ts";
import { calendarSyncWriteAllowed, validCalendarEtag, validCalendarDate } from "../_shared/calendarSyncLease.ts";

export function eventPatch(provider: string, input: any) {
  if (!input || typeof input.title !== "string" || !input.title.trim() || input.title.length > 1024
      || typeof input.startDate !== "string" || typeof input.endDate !== "string"
      || !validCalendarDate(input.startDate.slice(0,10)) || !validCalendarDate(input.endDate.slice(0,10))
      || !Number.isFinite(Date.parse(input.startDate)) || !Number.isFinite(Date.parse(input.endDate))
      || Date.parse(input.endDate) <= Date.parse(input.startDate)
      || Date.parse(input.endDate) - Date.parse(input.startDate) > 31 * 86400000
      || (input.notes != null && (typeof input.notes !== "string" || input.notes.length > 10000))
      || (input.location != null && (typeof input.location !== "string" || input.location.length > 2048))) {
    throw new Error("Invalid event details");
  }
  const allDay = input.isAllDay === true;
  const start = allDay ? input.startDate.slice(0,10) : new Date(input.startDate).toISOString();
  const end = allDay ? input.endDate.slice(0,10) : new Date(input.endDate).toISOString();
  // Only the selected occurrence is patched. Never overwrite recurrence, attendees,
  // invitations, conferencing, provider alarms or unrelated event metadata.
  return provider === "google" ? {
    summary: input.title, location: input.location ?? "",
    start: allDay ? { date: start } : { dateTime: start },
    end: allDay ? { date: end } : { dateTime: end },
  } : {
    subject: input.title, location: { displayName: input.location ?? "" },
    isAllDay: allDay,
    start: { dateTime: allDay ? `${start}T00:00:00` : start.replace(/Z$/, ""), timeZone: "UTC" },
    end: { dateTime: allDay ? `${end}T00:00:00` : end.replace(/Z$/, ""), timeZone: "UTC" },
    // Outlook bodies may contain meeting metadata. Do not replace them through task notes.
  };
}

export function createLinkedEventHandler(deps: { createClient: typeof createClient; fetch: typeof fetch; env: (key: string) => string | undefined }) {
  return async (req: Request) => {
    const reply = (body: unknown, status = 200) => Response.json(body, { status,
      headers: { ...getCorsHeaders(req), "Cache-Control": "no-store" } });
    if (req.method === "OPTIONS") return reply({});
    if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
    try {
      const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply({ error: "Sign in first." }, 401);
      const db = deps.createClient(deps.env("SUPABASE_URL")!, deps.env("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: auth, error: authError } = await db.auth.getUser(token);
      if (authError || !auth.user) return reply({ error: "Sign in first." }, 401);
      const body = await req.json();
      if (!["read", "update"].includes(body.action) || typeof body.linkId !== "string") return reply({ error: "Invalid request." }, 400);
      const { data: link, error: linkError } = await db.from("calendar_quest_imports").select("*")
        .eq("id", body.linkId).eq("user_id", auth.user.id).eq("resource_kind", "event").maybeSingle();
      if (linkError) return reply({ error: "Calendar links are temporarily unavailable." }, 503);
      if (!link || !["google", "outlook"].includes(link.provider)) return reply({ error: "Calendar link not found." }, 404);
      if (body.action === "update" && !link.sync_enabled) return reply({ error: "Two-way sync is disabled for this item." }, 409);
      const { data: conn, error } = await db.from("user_calendar_connections").select("*")
        .eq("id", link.connection_id).eq("user_id", auth.user.id).eq("provider", link.provider).eq("sync_enabled", true).maybeSingle();
      if (error || !conn) return reply({ error: "Reconnect your calendar in Preferences." }, 409);
      const request = (url: string, init?: RequestInit) => deps.fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
      const accessToken = await calendarAccessToken(db, conn, deps.env, deps.fetch);
      const calendar = encodeURIComponent(link.calendar_id); const event = encodeURIComponent(link.external_id);
      const url = link.provider === "google" ? `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events/${event}`
        : `https://graph.microsoft.com/v1.0/me/calendars/${calendar}/events/${event}`;
      const headers: Record<string,string> = { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' };
      let init: RequestInit = { headers };
      if (body.action === "update") {
        if (!validCalendarEtag(body.etag)) return reply({ error: "Refresh this event before editing." }, 409);
        let patch: unknown;
        try { patch = eventPatch(link.provider, body.event); } catch { return reply({ error: "Invalid event details." }, 400); }
        if (!await calendarSyncWriteAllowed(db, auth.user.id, link.id, body.revision, body.syncToken)) {
          return reply({ error: "This link changed, was paused or is syncing on another device. Refresh before retrying." }, 409);
        }
        init = { method: "PATCH", headers: { ...headers, "Content-Type": "application/json", "If-Match": body.etag }, body: JSON.stringify(patch) };
      }
      const response = await request(url, init);
      if (response.status === 404 || response.status === 410) return reply({ missing: true });
      if (response.status === 412) return reply({ error: "This event changed elsewhere. Refresh before choosing which version to keep." }, 409);
      if (!response.ok) return reply({ error: response.status === 403 ? "This calendar is read-only or needs renewed permission." : "Calendar update could not finish. Please retry." }, response.status === 403 ? 403 : 503);
      const item = await response.json();
      if (item.status === "cancelled" || item.isCancelled) return reply({ missing: true });
      return reply({ event: normalizeEvent(link.provider, item, link.calendar_id, conn.primary_calendar_name || "Calendar"),
        etag: item.etag || item["@odata.etag"] || null });
    } catch { return reply({ error: "Calendar service is temporarily unavailable." }, 503); }
  };
}
if (import.meta.main) Deno.serve(createLinkedEventHandler({ createClient, fetch, env: (name) => Deno.env.get(name) }));
