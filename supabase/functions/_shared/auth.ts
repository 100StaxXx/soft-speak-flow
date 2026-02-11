import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export interface RequestAuth {
  userId: string;
  isServiceRole: boolean;
}

function jsonResponse(
  status: number,
  error: string,
  corsHeaders: HeadersInit,
): Response {
  return new Response(
    JSON.stringify({ error }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export async function requireRequestAuth(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<RequestAuth | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, "Missing or invalid Authorization header", corsHeaders);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse(401, "Missing bearer token", corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, "Auth configuration missing", corsHeaders);
  }

  // Allow trusted server-to-server calls authenticated with the service key.
  if (supabaseServiceRoleKey && token === supabaseServiceRoleKey) {
    return { userId: "service_role", isServiceRole: true };
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: { headers: { Authorization: authHeader } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return jsonResponse(401, "Unauthorized", corsHeaders);
  }

  return { userId: user.id, isServiceRole: false };
}
