import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export interface RequestAuth {
  userId: string;
  isServiceRole: boolean;
}

function extractProjectRef(supabaseUrl: string): string | null {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const [projectRef] = hostname.split(".");
    return projectRef || null;
  } catch (_error) {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const payload = JSON.parse(atob(base64));
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  } catch (_error) {
    return null;
  }
}

function isServiceRoleCandidateToken(token: string, projectRef: string | null): boolean {
  if (token.startsWith("sb_secret_")) {
    return true;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const role = typeof payload.role === "string" ? payload.role : null;
  if (role !== "service_role") {
    return false;
  }

  if (!projectRef) {
    return true;
  }

  const ref = typeof payload.ref === "string" ? payload.ref : null;
  return !ref || ref === projectRef;
}

async function isValidSupabaseApiKey(supabaseUrl: string, token: string): Promise<boolean> {
  try {
    const baseUrl = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
    const response = await fetch(`${baseUrl}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: token,
      },
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
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
  if (!authHeader) {
    return jsonResponse(401, "Missing Authorization header", corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, "Auth configuration missing", corsHeaders);
  }

  const projectRef = extractProjectRef(supabaseUrl);
  const trimmedAuthHeader = authHeader.trim();
  const hasBearerPrefix = trimmedAuthHeader.toLowerCase().startsWith("bearer ");
  const token = hasBearerPrefix
    ? trimmedAuthHeader.slice(7).trim()
    : trimmedAuthHeader;
  const bearerAuthHeader = `Bearer ${token}`;

  // Allow trusted server-to-server calls authenticated with the service key
  // even if they do not include a Bearer prefix.
  if (supabaseServiceRoleKey && token === supabaseServiceRoleKey) {
    return { userId: "service_role", isServiceRole: true };
  }

  if (!token) {
    return jsonResponse(401, "Missing bearer token", corsHeaders);
  }

  // Allow other valid service-level API keys (legacy JWT service_role or sb_secret_*).
  if (
    isServiceRoleCandidateToken(token, projectRef) &&
    await isValidSupabaseApiKey(supabaseUrl, token)
  ) {
    return { userId: "service_role", isServiceRole: true };
  }

  if (!hasBearerPrefix) {
    return jsonResponse(401, "Missing or invalid Authorization header", corsHeaders);
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: { headers: { Authorization: bearerAuthHeader } },
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
