import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternalRequest } from "../_shared/auth.ts";
import { runCalendarSyncWorker } from "./worker.ts";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

export function createCalendarSyncWorkerHandler(deps: {
  authorize: (req: Request) => Promise<unknown | Response>;
  run: () => Promise<unknown>; waitUntil: (promise: Promise<unknown>) => void;
}) {
  return async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const auth = await deps.authorize(req);
    if (auth instanceof Response) return auth;
    // No client-supplied IDs, user identity or provider URLs are accepted.
    deps.waitUntil(deps.run().catch(() => { console.error("Calendar background sync failed; leases will recover."); }));
    return Response.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  };
}
if (import.meta.main) {
  const env = (key: string) => Deno.env.get(key);
  Deno.serve(createCalendarSyncWorkerHandler({
    authorize: (req) => requireInternalRequest(req, { "Cache-Control": "no-store" }),
    run: () => runCalendarSyncWorker({
      db: createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } }),
      fetch, env,
    }),
    waitUntil: (promise) => EdgeRuntime.waitUntil(promise),
  }));
}
