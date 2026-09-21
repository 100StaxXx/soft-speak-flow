import { describe, expect, it } from "vitest";

import { getDefaultProductTheme } from "./ThemeContext";

describe("default product themes", () => {
  it("uses the original deep-space Cosmiq semantics", () => {
    const theme = getDefaultProductTheme("cosmiq");

    expect(theme["--background"]).toBe("0 0% 5%");
    expect(theme["--primary"]).toBe("270 70% 55%");
    expect(theme["--foreground"]).toBe("0 0% 98%");
    expect(theme["--shadow-glow"]).toContain("270 70% 55%");
  });

  it("keeps Graceward warm, evergreen, and readable", () => {
    const theme = getDefaultProductTheme("christian");

    expect(theme["--background"]).toBe("43 30% 96%");
    expect(theme["--primary"]).toBe("132 31% 34%");
    expect(theme["--foreground"]).toBe("132 21% 16%");
  });

  it("does not reuse Graceward identity colors in Cosmiq", () => {
    const cosmiq = getDefaultProductTheme("cosmiq");
    const graceward = getDefaultProductTheme("christian");

    expect(cosmiq["--background"]).not.toBe(graceward["--background"]);
    expect(cosmiq["--primary"]).not.toBe(graceward["--primary"]);
    expect(cosmiq["--card"]).not.toBe(graceward["--card"]);
  });
});
