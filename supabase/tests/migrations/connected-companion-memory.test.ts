import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const migration = await Deno.readTextFile(
  new URL("../../migrations/20260810133000_connected_companion_memory_and_product_events.sql", import.meta.url),
);

Deno.test("Companion personal memory is explicit, clearable, and user controlled", () => {
  assertStringIncludes(migration, "companion_memory_enabled boolean NOT NULL DEFAULT true");
  assertStringIncludes(migration, "clear_personal_companion_memory");
  assertStringIncludes(migration, "memory.memory_context #>> '{details,source}' = 'companion_chat'");
  assertStringIncludes(migration, "conversation_profile = '{}'::jsonb");
  assertStringIncludes(migration, "Users can delete own companion memories");
});

Deno.test("product journey events are private, bounded, and content free by schema", () => {
  assertStringIncludes(migration, "CREATE TABLE public.product_experience_events");
  assertStringIncludes(migration, "octet_length(properties::text) <= 2048");
  assertStringIncludes(migration, "ENABLE ROW LEVEL SECURITY");
  assertStringIncludes(migration, "Users can record their own product experience events");
  assert(!migration.includes("GRANT UPDATE ON public.product_experience_events"));
});

Deno.test("Companion check-ins become part of the shared daily thread", () => {
  assertStringIncludes(migration, "companion_question_id text");
  assertStringIncludes(migration, "companion_answer_label text");
  assertStringIncludes(migration, "daily_guide_threads_companion_answer_check");
});
