import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_CATEGORIES = new Set(["bug", "billing", "sync", "performance", "other"]);
const MAX_SUMMARY_LENGTH = 500;
const MAX_TEXT_LENGTH = 8000;
const MAX_CORRELATION_ID_LENGTH = 128;
const MAX_SCREENSHOT_DATA_URL_LENGTH = 2_000_000;

type NormalizedPayload = {
  correlationId: string;
  category: string;
  summary: string;
  reproductionSteps: string;
  expectedBehavior: string;
  actualBehavior: string;
  screenshotDataUrl: string | null;
  consentDiagnostics: boolean;
  diagnostics: unknown;
};

const normalizeText = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const parsePayload = (raw: unknown): { payload: NormalizedPayload | null; error: string | null } => {
  if (!raw || typeof raw !== "object") {
    return { payload: null, error: "Invalid payload" };
  }

  const source = raw as Record<string, unknown>;

  const correlationId = normalizeText(source.correlationId, MAX_CORRELATION_ID_LENGTH);
  if (!correlationId) {
    return { payload: null, error: "correlationId is required" };
  }

  const category = normalizeText(source.category, 32);
  if (!ALLOWED_CATEGORIES.has(category)) {
    return { payload: null, error: "Invalid category" };
  }

  const summary = normalizeText(source.summary, MAX_SUMMARY_LENGTH);
  if (!summary) {
    return { payload: null, error: "summary is required" };
  }

  const reproductionSteps = normalizeText(source.reproductionSteps, MAX_TEXT_LENGTH);
  const expectedBehavior = normalizeText(source.expectedBehavior, MAX_TEXT_LENGTH);
  const actualBehavior = normalizeText(source.actualBehavior, MAX_TEXT_LENGTH);

  let screenshotDataUrl: string | null = null;
  if (typeof source.screenshotDataUrl === "string") {
    const candidate = source.screenshotDataUrl.trim();
    if (candidate.length > MAX_SCREENSHOT_DATA_URL_LENGTH) {
      return { payload: null, error: "screenshotDataUrl exceeds limit" };
    }
    if (!candidate.startsWith("data:image/")) {
      return { payload: null, error: "screenshotDataUrl must be an image data URL" };
    }
    screenshotDataUrl = candidate;
  }

  const consentDiagnostics = source.consentDiagnostics === true;
  const diagnostics = consentDiagnostics ? source.diagnostics ?? null : null;

  return {
    payload: {
      correlationId,
      category,
      summary,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
      screenshotDataUrl,
      consentDiagnostics,
      diagnostics,
    },
    error: null,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[submit-support-report] Missing Supabase environment variables");
    return errorResponse(req, "Server misconfigured", 500);
  }

  if (!authHeader) {
    return errorResponse(req, "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn("[submit-support-report] Failed auth check", userError);
    return errorResponse(req, "Unauthorized", 401);
  }

  let rawPayload: unknown;
  try {
    rawPayload = await req.json();
  } catch (_error) {
    return errorResponse(req, "Invalid JSON payload", 400);
  }

  const { payload, error } = parsePayload(rawPayload);
  if (error || !payload) {
    return errorResponse(req, error ?? "Invalid payload", 400);
  }

  const { error: insertError } = await supabase.from("support_reports").insert({
    user_id: user.id,
    correlation_id: payload.correlationId,
    category: payload.category,
    summary: payload.summary,
    reproduction_steps: payload.reproductionSteps,
    expected_behavior: payload.expectedBehavior,
    actual_behavior: payload.actualBehavior,
    screenshot_data_url: payload.screenshotDataUrl,
    consent_diagnostics: payload.consentDiagnostics,
    diagnostics: payload.diagnostics,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonResponse(req, { success: true, duplicate: true });
    }

    console.error("[submit-support-report] Insert failed", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
    });
    return errorResponse(req, "Unable to submit support report", 500);
  }

  return jsonResponse(req, { success: true });
});
