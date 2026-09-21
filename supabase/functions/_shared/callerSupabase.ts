import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.81.1";

/**
 * Build a non-persistent Supabase client that keeps the end user's bearer
 * token. Companion agent endpoints use an admin client for trusted storage,
 * but calendar functions and user-scoped RPCs must still run as the caller.
 */
export function createCallerSupabaseClient(req: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization")?.trim();

  if (!supabaseUrl || !supabaseAnonKey || !authorization) {
    throw new Error("Caller Supabase client is not configured");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
