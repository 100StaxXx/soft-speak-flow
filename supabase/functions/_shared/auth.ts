import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export interface RequestAuth {
  userId: string;
  isServiceRole: boolean;
}

export interface RoleAwareClient {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export interface InternalRequestAuth {
  isInternal: true;
}

export interface UserRequestAuth {
  userId: string;
  isInternal: false;
}

export type UserOrInternalRequestAuth = InternalRequestAuth | UserRequestAuth;

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

export function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: HeadersInit,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function errorResponse(
  status: number,
  error: string,
  corsHeaders: HeadersInit,
): Response {
  return jsonResponse(status, { error }, corsHeaders);
}

function createServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function hasUserRole(
  userId: string,
  role: string,
): Promise<boolean> {
  const serviceRoleClient = createServiceRoleClient();
  if (!serviceRoleClient) {
    throw new Error("Auth configuration missing");
  }

  const { data, error } = await serviceRoleClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    console.error(`Failed to verify ${role} role for user ${userId}:`, error);
    return false;
  }

  return !!data;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export function extractBearerTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const trimmedAuthHeader = authHeader.trim();
  if (!trimmedAuthHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = trimmedAuthHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function extractBearerToken(req: Request): string | null {
  return extractBearerTokenFromHeader(req.headers.get("Authorization"));
}

async function authenticateBearerUser(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<UserRequestAuth | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(500, "Auth configuration missing", corsHeaders);
  }

  const token = extractBearerToken(req);
  if (!token) {
    return errorResponse(401, "Missing or invalid Authorization header", corsHeaders);
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return errorResponse(401, "Unauthorized", corsHeaders);
  }

  return { userId: user.id, isInternal: false };
}

export function hasInternalKey(req: Request): boolean {
  return Boolean(req.headers.get("x-internal-key"));
}

export function isValidInternalKey(providedKey: string | null): boolean {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || !providedKey) return false;
  return timingSafeEqual(providedKey, expected);
}

export async function requireInternalRequest(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<InternalRequestAuth | Response> {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) {
    return errorResponse(500, "Internal auth configuration missing", corsHeaders);
  }

  const providedKey = req.headers.get("x-internal-key");
  if (!providedKey) {
    return errorResponse(401, "Missing x-internal-key header", corsHeaders);
  }

  if (!timingSafeEqual(providedKey, expected)) {
    return errorResponse(403, "Forbidden", corsHeaders);
  }

  return { isInternal: true };
}

export async function requireAuthenticatedUser(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<UserRequestAuth | Response> {
  return authenticateBearerUser(req, corsHeaders);
}

export async function requireUserOrInternalRequest(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<UserOrInternalRequestAuth | Response> {
  const internalKey = req.headers.get("x-internal-key");
  if (internalKey) {
    return requireInternalRequest(req, corsHeaders);
  }

  return authenticateBearerUser(req, corsHeaders);
}

export async function requireRequestAuth(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<RequestAuth | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse(401, "Missing Authorization header", corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(500, "Auth configuration missing", corsHeaders);
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
    return errorResponse(401, "Missing bearer token", corsHeaders);
  }

  // Allow other valid service-level API keys (legacy JWT service_role or sb_secret_*).
  if (
    isServiceRoleCandidateToken(token, projectRef) &&
    await isValidSupabaseApiKey(supabaseUrl, token)
  ) {
    return { userId: "service_role", isServiceRole: true };
  }

  if (!hasBearerPrefix) {
    return errorResponse(401, "Missing or invalid Authorization header", corsHeaders);
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
    return errorResponse(401, "Unauthorized", corsHeaders);
  }

  return { userId: user.id, isServiceRole: false };
}

export async function requireUserAuth(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<{ userId: string } | Response> {
  const auth = await requireRequestAuth(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  if (auth.isServiceRole) {
    return errorResponse(403, "Forbidden", corsHeaders);
  }

  return { userId: auth.userId };
}

export async function requireServiceRoleAuth(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<{ userId: "service_role" } | Response> {
  const auth = await requireRequestAuth(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  if (!auth.isServiceRole) {
    return errorResponse(403, "Forbidden", corsHeaders);
  }

  return { userId: "service_role" };
}

export async function requireAdminOrServiceRoleAuth(
  req: Request,
  corsHeaders: HeadersInit,
): Promise<RequestAuth | Response> {
  const auth = await requireRequestAuth(req, corsHeaders);
  if (auth instanceof Response) {
    return auth;
  }

  if (auth.isServiceRole) {
    return auth;
  }

  const isAdmin = await hasUserRole(auth.userId, "admin");
  if (!isAdmin) {
    return errorResponse(403, "Admin access required", corsHeaders);
  }

  return auth;
}

export async function hasRole(
  supabase: RoleAwareClient,
  userId: string,
  role: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role,
  });

  if (!error) {
    return Boolean(data);
  }

  console.warn(`has_role rpc failed for ${userId}/${role}; falling back to user_roles lookup`, error);

  const { data: roleRow, error: roleLookupError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (roleLookupError) {
    console.error(`Role lookup failed for ${userId}/${role}:`, roleLookupError);
    return false;
  }

  return Boolean(roleRow);
}

export async function requireAdminOrServiceRole(
  req: Request,
  corsHeaders: HeadersInit,
  supabase: RoleAwareClient,
  authFn: typeof requireRequestAuth = requireRequestAuth,
): Promise<RequestAuth | Response> {
  const requestAuth = await authFn(req, corsHeaders);
  if (requestAuth instanceof Response) {
    return requestAuth;
  }

  if (requestAuth.isServiceRole) {
    return requestAuth;
  }

  const isAdmin = await hasRole(supabase, requestAuth.userId, "admin");
  if (!isAdmin) {
    return errorResponse(403, "Admin access required", corsHeaders);
  }

  return requestAuth;
}
