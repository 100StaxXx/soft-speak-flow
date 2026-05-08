import { describe, expect, it } from "vitest";

import { buildPostgrestIlikeOr } from "@/utils/postgrestSearchFilters";

describe("postgrestSearchFilters", () => {
  it("builds a simple ilike OR filter", () => {
    expect(buildPostgrestIlikeOr(["task_text", "notes"], "quest"))
      .toBe("task_text.ilike.%quest%,notes.ilike.%quest%");
  });

  it("quotes address-style values with PostgREST reserved separators", () => {
    expect(buildPostgrestIlikeOr(["location"], "1 Ferry Building, San Francisco"))
      .toBe('location.ilike."%1 Ferry Building, San Francisco%"');
  });

  it("escapes quotes and backslashes inside quoted values", () => {
    expect(buildPostgrestIlikeOr(["location"], 'Studio "A" \\ East'))
      .toBe('location.ilike."%Studio \\"A\\" \\\\ East%"');
  });
});
