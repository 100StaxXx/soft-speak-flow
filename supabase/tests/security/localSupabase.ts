export interface SecurityTestConfig {
  apiUrl: string;
  functionsUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  internalFunctionSecret: string;
}

export interface TestUserSession {
  accessToken: string;
  email: string;
  id: string;
  password: string;
}

export interface FunctionInvocationResult {
  status: number;
  text: string;
  json: Record<string, unknown> | null;
}

const TEXT_DECODER = new TextDecoder();
const DEFAULT_INTERNAL_FUNCTION_SECRET = "security-test-internal-secret";
const DEFAULT_PASSWORD = "SecuritySuite123!";

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

async function readSupabaseStatusEnv(): Promise<Record<string, string>> {
  const command = new Deno.Command("supabase", {
    args: ["status", "-o", "env"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    throw new Error(
      `Unable to resolve local Supabase credentials. Start the local stack first. ${TEXT_DECODER.decode(stderr).trim()}`,
    );
  }

  const parsed: Record<string, string> = {};
  for (const rawLine of TEXT_DECODER.decode(stdout).split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(normalized.slice(separatorIndex + 1));
    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readStringProperty(
  value: unknown,
  key: string,
): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : null;
}

function toHeadersRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

export async function resolveSecurityTestConfig(): Promise<SecurityTestConfig> {
  const env = { ...Deno.env.toObject() };
  let resolved = env;

  if (!(resolved.SUPABASE_ANON_KEY || resolved.ANON_KEY) || !(resolved.SUPABASE_SERVICE_ROLE_KEY || resolved.SERVICE_ROLE_KEY)) {
    resolved = {
      ...resolved,
      ...(await readSupabaseStatusEnv()),
    };
  }

  const apiUrl = resolved.SUPABASE_URL || resolved.API_URL || "http://127.0.0.1:54321";
  const anonKey = resolved.SUPABASE_ANON_KEY || resolved.ANON_KEY || "";
  const serviceRoleKey = resolved.SUPABASE_SERVICE_ROLE_KEY || resolved.SERVICE_ROLE_KEY || "";
  const functionsUrl = resolved.SUPABASE_FUNCTIONS_URL || resolved.FUNCTIONS_URL || `${apiUrl.replace(/\/$/, "")}/functions/v1`;
  const internalFunctionSecret = resolved.INTERNAL_FUNCTION_SECRET || DEFAULT_INTERNAL_FUNCTION_SECRET;

  if (!anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase anon or service-role key for security regression tests.");
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    functionsUrl: functionsUrl.replace(/\/$/, ""),
    anonKey,
    serviceRoleKey,
    internalFunctionSecret,
  };
}

export class LocalSupabaseHarness {
  static async create(): Promise<LocalSupabaseHarness> {
    const config = await resolveSecurityTestConfig();
    return new LocalSupabaseHarness(config);
  }

  readonly config: SecurityTestConfig;

  constructor(config: SecurityTestConfig) {
    this.config = config;
  }

  get anonHeaders(): Record<string, string> {
    return {
      apikey: this.config.anonKey,
    };
  }

  get serviceHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
      apikey: this.config.serviceRoleKey,
    };
  }

  async createUser(label: string, options: { admin?: boolean } = {}): Promise<TestUserSession> {
    const email = `security-${label}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const createResponse = await fetch(`${this.config.apiUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        ...this.serviceHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        email_confirm: true,
        password: DEFAULT_PASSWORD,
        user_metadata: { security_suite_label: label },
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create test user ${label}: ${await createResponse.text()}`);
    }

    const signInResponse = await fetch(`${this.config.apiUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.config.anonKey,
      },
      body: JSON.stringify({
        email,
        password: DEFAULT_PASSWORD,
      }),
    });

    if (!signInResponse.ok) {
      throw new Error(`Failed to sign in test user ${label}: ${await signInResponse.text()}`);
    }

    const signInPayload = parseJson(await signInResponse.text());
    const accessToken = typeof signInPayload?.access_token === "string" ? signInPayload.access_token : null;
    const userId = readStringProperty(signInPayload?.user, "id");

    if (!accessToken || !userId) {
      throw new Error(`Sign-in response for ${label} did not include a user token.`);
    }

    if (options.admin) {
      await this.upsertRows("user_roles", [{ user_id: userId, role: "admin" }], "user_id,role");
    }

    return {
      accessToken,
      email,
      id: userId,
      password: DEFAULT_PASSWORD,
    };
  }

  async insertRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;
    await this.restWrite(table, rows, {});
  }

  async upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
    if (rows.length === 0) return;
    await this.restWrite(table, rows, { onConflict, upsert: true });
  }

  async seedAiRateLimit(userId: string, functionKey: string, count: number): Promise<void> {
    const rows = Array.from({ length: count }, () => ({
      function_key: functionKey,
      user_id: userId,
    }));
    await this.insertRows("ai_rate_limit_log", rows);
  }

  async seedMentorDailyLimit(userId: string, count: number): Promise<void> {
    const now = new Date().toISOString();
    const rows = Array.from({ length: count }, (_, index) => ({
      content: `security-suite-daily-cap-${index + 1}`,
      created_at: now,
      role: "user",
      user_id: userId,
    }));
    await this.insertRows("mentor_chats", rows);
  }

  async seedInfluencerRateLimit(ipAddress: string, count: number): Promise<void> {
    const now = new Date().toISOString();
    const rows = Array.from({ length: count }, (_, index) => ({
      created_at: now,
      email: `stats-lookup-${index + 1}@security-suite.local`,
      ip_address: ipAddress,
      request_type: "stats_lookup",
    }));
    await this.insertRows("influencer_creation_log", rows);
  }

  async invokeFunction(
    functionName: string,
    options: {
      body?: Record<string, unknown>;
      rawBody?: string;
      headers?: HeadersInit;
      method?: string;
    } = {},
  ): Promise<FunctionInvocationResult> {
    const headers = new Headers(toHeadersRecord(options.headers));
    const method = options.method ?? "POST";

    let body: string | undefined;
    if (typeof options.rawBody === "string") {
      body = options.rawBody;
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    } else if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    const response = await fetch(`${this.config.functionsUrl}/${functionName}`, {
      method,
      headers,
      body,
    });
    const text = await response.text();

    return {
      status: response.status,
      text,
      json: parseJson(text),
    };
  }

  async signHmacHex(message: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(this.config.internalFunctionSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(message),
    );

    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private async restWrite(
    table: string,
    rows: Record<string, unknown>[],
    options: { onConflict?: string; upsert?: boolean },
  ): Promise<void> {
    const url = new URL(`${this.config.apiUrl}/rest/v1/${table}`);
    if (options.onConflict) {
      url.searchParams.set("on_conflict", options.onConflict);
    }

    const prefer = options.upsert
      ? "resolution=merge-duplicates,return=minimal"
      : "return=minimal";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.serviceHeaders,
        "Content-Type": "application/json",
        Prefer: prefer,
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      throw new Error(`Failed to seed ${table}: ${await response.text()}`);
    }
  }
}
