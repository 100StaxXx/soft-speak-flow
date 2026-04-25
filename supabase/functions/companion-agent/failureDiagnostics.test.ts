import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildErrorLog,
  getCompanionAgentFailureReason,
  isCompanionAgentSetupFailure,
} from "./failureDiagnostics.ts";

const postgrestError = (overrides: Record<string, unknown>) => ({
  name: "PostgrestError",
  message: "",
  code: "",
  details: "",
  hint: "",
  ...overrides,
});

const subStageError = (
  subStage: "context_load" | "openai" | "persistence",
  originalError: unknown,
) => ({
  name: "AgentRunSubStageError",
  message: `companion agent sub-stage ${subStage} failed`,
  subStage,
  originalError,
  cause: originalError,
});

Deno.test("getCompanionAgentFailureReason returns schema_mismatch for missing column on context table", () => {
  const error = postgrestError({
    code: "42703",
    message:
      'column "preferred_time" of relation "habits" does not exist',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "schema_mismatch",
  );
});

Deno.test("getCompanionAgentFailureReason returns schema_mismatch for focus_sessions undefined column", () => {
  const error = postgrestError({
    code: "42703",
    message: 'column "actual_time_spent" does not exist',
    details: 'on table "focus_sessions"',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "schema_mismatch",
  );
});

Deno.test("getCompanionAgentFailureReason returns db_permission_error for RLS denial", () => {
  const error = postgrestError({
    code: "42501",
    message: 'permission denied for table daily_tasks',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "db_permission_error",
  );
});

Deno.test("getCompanionAgentFailureReason prefers db_permission_error over schema_mismatch when both signals present", () => {
  const error = postgrestError({
    code: "42501",
    message: 'permission denied for relation companion_chats',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "db_permission_error",
  );
});

Deno.test("getCompanionAgentFailureReason returns db_constraint_error for FK violation", () => {
  const error = postgrestError({
    code: "23503",
    message: 'insert or update on table "companion_pending_actions" violates foreign key constraint "companion_pending_actions_user_id_fkey"',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "db_constraint_error",
  );
});

Deno.test("getCompanionAgentFailureReason returns db_constraint_error for RLS row violation", () => {
  const error = postgrestError({
    code: "42501",
    message:
      'new row violates row-level security policy for table "companion_chats"',
  });
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "db_constraint_error",
  );
});

Deno.test("getCompanionAgentFailureReason returns json_parse_error for unexpected token", () => {
  const error = new SyntaxError("Unexpected token < in JSON at position 0");
  assertEquals(
    getCompanionAgentFailureReason(error, "request_parse"),
    "json_parse_error",
  );
});

Deno.test("getCompanionAgentFailureReason returns deno_capability_error for NotCapable", () => {
  const error = new Error("Requires env access to API_KEY, run again with the --allow-env flag");
  error.name = "NotCapable";
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "deno_capability_error",
  );
});

Deno.test("getCompanionAgentFailureReason returns timeout for TimeoutError", () => {
  const error = new Error("companion agent response loop timed out after 5000ms");
  error.name = "TimeoutError";
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "timeout",
  );
});

Deno.test("getCompanionAgentFailureReason returns openai_provider_error for OpenAI failures", () => {
  const error = new Error("OpenAI request failed: invalid_request_error");
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "openai_provider_error",
  );
});

Deno.test("getCompanionAgentFailureReason falls back to ${stage}_failed when nothing matches", () => {
  const error = new Error("Some unrelated runtime issue");
  assertEquals(
    getCompanionAgentFailureReason(error, "agent_run"),
    "agent_run_failed",
  );
});

Deno.test("getCompanionAgentFailureReason prefixes sub-stage when AgentRunSubStageError is wrapping", () => {
  const inner = postgrestError({
    code: "42703",
    message: 'column "actual_time_spent" of relation "focus_sessions" does not exist',
  });
  const wrapped = subStageError("context_load", inner);
  assertEquals(
    getCompanionAgentFailureReason(wrapped, "agent_run"),
    "context_load.schema_mismatch",
  );
});

Deno.test("getCompanionAgentFailureReason prefixes openai sub-stage", () => {
  const inner = new Error("OpenAI returned 502 Bad Gateway");
  const wrapped = subStageError("openai", inner);
  assertEquals(
    getCompanionAgentFailureReason(wrapped, "agent_run"),
    "openai.openai_provider_error",
  );
});

Deno.test("getCompanionAgentFailureReason prefixes persistence sub-stage on FK violation", () => {
  const inner = postgrestError({
    code: "23503",
    message: 'violates foreign key constraint',
  });
  const wrapped = subStageError("persistence", inner);
  assertEquals(
    getCompanionAgentFailureReason(wrapped, "agent_run"),
    "persistence.db_constraint_error",
  );
});

Deno.test("isCompanionAgentSetupFailure detects newly added context tables", () => {
  for (
    const token of [
      "focus_sessions",
      "habits",
      "epics",
      "user_ai_learning",
      "daily_planning_preferences",
      "user_companion",
    ]
  ) {
    const source =
      `column "x" of relation "${token}" does not exist`.toLowerCase();
    assert(
      isCompanionAgentSetupFailure(source),
      `expected schema setup failure to be detected for ${token}`,
    );
  }
});

Deno.test("buildErrorLog captures stack and PostgrestError fields", () => {
  const err = postgrestError({
    message: "fail",
    code: "42P01",
    details: "table missing",
    hint: "did you run migrations?",
  });
  (err as { stack?: string }).stack = "at fn (file.ts:1)";
  const log = buildErrorLog(err);
  assertEquals(log.message, "fail");
  assertEquals(log.code, "42P01");
  assertEquals(log.details, "table missing");
  assertEquals(log.hint, "did you run migrations?");
  assertEquals(log.stack, "at fn (file.ts:1)");
});

Deno.test("buildErrorLog recurses into Error.cause", () => {
  const cause = new Error("inner reason");
  const wrapped = new Error("outer wrap", { cause });
  const log = buildErrorLog(wrapped);
  assertEquals(typeof log.cause, "object");
  assertEquals(log.cause?.name, "Error");
  assertEquals(log.cause?.message, "inner reason");
});

Deno.test("buildErrorLog extracts PostgrestError fields from plain object cause", () => {
  const cause = postgrestError({
    message: 'column "scheduled_time" of relation "daily_tasks" does not exist',
    code: "42703",
    details: "schema cache lookup failed",
    hint: "reload PostgREST schema",
  });
  const wrapped = new Error("context load failed", { cause });
  const log = buildErrorLog(wrapped);
  assertEquals(log.message, "context load failed");
  assertEquals(log.cause?.name, "PostgrestError");
  assertEquals(
    log.cause?.message,
    'column "scheduled_time" of relation "daily_tasks" does not exist',
  );
  assertEquals(log.cause?.code, "42703");
  assertEquals(log.cause?.details, "schema cache lookup failed");
  assertEquals(log.cause?.hint, "reload PostgREST schema");
});

Deno.test("buildErrorLog exposes PostgrestError cause on AgentRunSubStageError wrappers", () => {
  const cause = postgrestError({
    message:
      'Could not find the "actual_time_spent" column of "focus_sessions" in the schema cache',
    code: "PGRST204",
    details: "Searched for the column in public.focus_sessions",
    hint: "Perhaps you meant focus_duration_minutes",
  });
  const wrapped = subStageError("context_load", cause);
  const log = buildErrorLog(wrapped);
  assertEquals(log.name, "AgentRunSubStageError");
  assertEquals(log.message, "companion agent sub-stage context_load failed");
  assertEquals(log.cause?.name, "PostgrestError");
  assertEquals(log.cause?.code, "PGRST204");
  assertEquals(
    log.cause?.details,
    "Searched for the column in public.focus_sessions",
  );
  assertEquals(log.cause?.hint, "Perhaps you meant focus_duration_minutes");
});

Deno.test("buildErrorLog guards self-referential cause cycles", () => {
  const err: { name: string; message: string; cause?: unknown } = {
    name: "LoopError",
    message: "outer",
  };
  err.cause = err;
  const log = buildErrorLog(err);
  assertEquals(log.name, "LoopError");
  assertEquals(log.cause?.message, "(cause chain cycle)");
});

Deno.test("buildErrorLog handles null and primitive errors gracefully", () => {
  assertEquals(buildErrorLog(null).message, "(no error)");
  assertEquals(buildErrorLog("just a string").message, "just a string");
  assertEquals(buildErrorLog(42).message, "42");
});
