import { describe, expect, it } from "vitest";

import { sanitizeProductEventProperties } from "@/lib/productAnalytics";

describe("sanitizeProductEventProperties", () => {
  it("keeps bounded journey metadata while dropping user-authored content", () => {
    expect(sanitizeProductEventProperties({
      category: "Rest",
      option_id: "gentle",
      completed: true,
      duration_ms: 1200,
      message: "private words",
      focus_label: "A private answer",
      invalidKey: "ignored",
    })).toEqual({
      category: "Rest",
      option_id: "gentle",
      completed: true,
      duration_ms: 1200,
    });
  });
});
