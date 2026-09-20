import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { calendarAccessToken } from "../_shared/calendarConnectionAccess.ts";
import { calendarSyncWriteAllowed, validCalendarEtag, validCalendarDate } from "../_shared/calendarSyncLease.ts";
import { exportGoogleTask } from './export.ts';

export function normalizeProviderTask(provider: string, item: any, listId: string) {
  if (!item.id || item.deleted) return null;
  return { id: item.id, listId, title: item.title || "Untitled", notes: provider === "google" ? item.notes || null : item.body?.contentType === "text" ? item.body.content : null,
    dueDate: (provider === "google" ? item.due : item.dueDateTime?.dateTime)?.slice(0,10) || null,
    completed: item.status === "completed", etag: item.etag || item["@odata.etag"] || null };
}
export function createCalendarTaskHandler(deps: { createClient: typeof createClient; fetch: typeof fetch; env: (key: string) => string | undefined }) {
  return async (req: Request) => {
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { ...getCorsHeaders(req), "Cache-Control": "no-store" } });
    if (req.method === "OPTIONS") return reply({});
    if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
    try {
      const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return reply({ error: "Sign in first." }, 401);
      const db = deps.createClient(deps.env("SUPABASE_URL")!, deps.env("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: auth, error: authError } = await db.auth.getUser(token);
      if (authError || !auth.user) return reply({ error: "Sign in first." }, 401);
      const body = await req.json();
      if (body.action === 'export') {
        const exported = await exportGoogleTask(db, auth.user.id, body.intentId, deps);
        return reply(exported.body, exported.status);
      }
      if (!["lists", "tasks", "read", "update"].includes(body.action)) return reply({ error: "Unsupported action." }, 400);
      let link: any = null;
      if (["read", "update"].includes(body.action)) {
        const { data, error } = await db.from("calendar_quest_imports").select("*").eq("id", body.linkId).eq("user_id", auth.user.id).eq("resource_kind", "task").maybeSingle();
        if (error || !data) return reply({ error: "Task link not found." }, 404);
        link = data;
        if (body.action === "update" && !link.sync_enabled) return reply({ error: "Two-way sync is disabled." }, 409);
      }
      const provider = link?.provider ?? body.provider;
      if (!["google", "outlook"].includes(provider)) return reply({ error: "Invalid provider." }, 400);
      let query = db.from("user_calendar_connections").select("*").eq("user_id", auth.user.id).eq("provider", provider).eq("sync_enabled", true);
      if (link?.connection_id || body.connectionId) query = query.eq("id", link?.connection_id ?? body.connectionId);
      const { data: conn, error } = await query.maybeSingle();
      if (error || !conn) return reply({ error: "Reconnect this account in Preferences." }, 409);
      const accessToken = await calendarAccessToken(db, conn, deps.env, deps.fetch);
      const listId = link?.calendar_id ?? body.listId;
      if (body.action !== "lists" && (typeof listId !== "string" || !listId || listId.length > 2048)) return reply({ error: "Choose a task list." }, 400);
      const google = provider === "google";
      const base = google ? "https://tasks.googleapis.com/tasks/v1" : "https://graph.microsoft.com/v1.0/me/todo";
      const listsUrl = google ? `${base}/users/@me/lists?maxResults=100` : `${base}/lists?$top=100`;
      const tasksUrl = google ? `${base}/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true&maxResults=100`
        : `${base}/lists/${encodeURIComponent(listId)}/tasks?$top=100`;
      let next: string | null = body.action === "lists" ? listsUrl : link ? `${base}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(link.external_id)}` : tasksUrl;
      const firstUrl = next;
      const items: any[] = [];
      for (let page=0; next && page<20; page++) {
        if (new URL(next).origin !== new URL(base).origin) return reply({ error: "Invalid provider pagination." }, 502);
        const headers: Record<string,string> = { Authorization: `Bearer ${accessToken}` };
        let init: RequestInit = { headers, signal: AbortSignal.timeout(20000) };
        if (body.action === "update") {
          const task = body.task;
          if (!task || typeof task.title !== "string" || !task.title.trim() || task.title.length > 1024 || typeof task.completed !== "boolean"
            || (task.dueDate !== null && !validCalendarDate(task.dueDate))
            || !validCalendarEtag(body.etag)) return reply({ error: "Refresh task before editing." }, 400);
          if (!await calendarSyncWriteAllowed(db, auth.user.id, link.id, body.revision, body.syncToken)) {
            return reply({ error: "This link changed, was paused or is syncing on another device. Refresh before retrying." }, 409);
          }
          const patch = { title: task.title, status: task.completed ? "completed" : google ? "needsAction" : "notStarted",
            ...(google ? { due: task.dueDate ? `${task.dueDate}T00:00:00Z` : null } : { dueDateTime: task.dueDate ? { dateTime: `${task.dueDate}T00:00:00`, timeZone: "UTC" } : null }) };
          init = { ...init, method: "PATCH", headers: { ...headers, "Content-Type": "application/json", "If-Match": body.etag }, body: JSON.stringify(patch) };
        }
        const response: Response = await deps.fetch(next, init);
        if (link && response.status === 404) return reply({ missing: true });
        if (response.status === 412) return reply({ error: "Task changed elsewhere. Refresh and retry." }, 409);
        if (!response.ok) return reply({ error: response.status === 403 ? "Reconnect this account and approve task access." : "Task provider is unavailable. Retry shortly." }, response.status === 403 ? 403 : 503);
        const payload: any = await response.json();
        if (link) return reply({ task: normalizeProviderTask(provider, payload, listId) });
        for (const item of (google ? payload.items : payload.value) ?? []) {
          const normalized = body.action === "lists" ? { id: item.id, title: item.title || item.displayName } : normalizeProviderTask(provider, item, listId);
          if (normalized) items.push({ ...normalized, connectionId: conn.id, provider });
        }
        if (google && payload.nextPageToken) { const url = new URL(firstUrl); url.searchParams.set("pageToken", payload.nextPageToken); next = url.toString(); }
        else next = google ? null : payload["@odata.nextLink"] || null;
      }
      if (next) return reply({ error: "This list is too large to load safely." }, 422);
      return reply({ items });
    } catch { return reply({ error: "Tasks could not be loaded. Reconnect the account if this continues." }, 503); }
  };
}
if (import.meta.main) Deno.serve(createCalendarTaskHandler({ createClient, fetch, env: (name) => Deno.env.get(name) }));
