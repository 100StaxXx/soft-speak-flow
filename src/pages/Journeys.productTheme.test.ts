import { describe, expect, it } from "vitest";

import { resolveJourneysThemeColor } from "./Journeys";

describe("Journeys product theme", () => {
  it("uses the companion identity in Cosmiq", () => {
    expect(resolveJourneysThemeColor("cosmiq")).toBe("#9b6bff");
  });

  it("keeps Graceward on its evergreen planner identity", () => {
    expect(resolveJourneysThemeColor("christian")).toBe("#2f5938");
  });
});
