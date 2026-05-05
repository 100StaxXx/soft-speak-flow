import { describe, expect, it } from "vitest";

import { isSupabaseMissingRelationError } from "./supabaseSchemaErrors";

describe("isSupabaseMissingRelationError", () => {
  it("detects PostgREST schema-cache table misses", () => {
    expect(
      isSupabaseMissingRelationError(
        {
          code: "PGRST205",
          message: "Could not find the table 'public.achievements' in the schema cache",
          details: null,
          hint: "Perhaps you meant the table 'public.abuse_events'",
        },
        "achievements",
      ),
    ).toBe(true);
  });

  it("does not match unrelated relations", () => {
    expect(
      isSupabaseMissingRelationError(
        {
          code: "PGRST205",
          message: "Could not find the table 'public.task_attachments' in the schema cache",
        },
        "achievements",
      ),
    ).toBe(false);
  });
});
