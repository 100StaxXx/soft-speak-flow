import { describe, expect, it } from "vitest";
import { ELEMENT_THEMES, getEvolutionTheme } from "./evolutionThemes";

describe("getEvolutionTheme", () => {
  it("maps current Storm and Void element ids to their authored themes", () => {
    expect(getEvolutionTheme("storm")).toBe(ELEMENT_THEMES.lightning);
    expect(getEvolutionTheme("void")).toBe(ELEMENT_THEMES.shadow);
  });
});
