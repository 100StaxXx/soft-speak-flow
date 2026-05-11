import { describe, expect, it } from "vitest";
import {
  resolveCompanionDisplayLabel,
  toPossessiveCompanionLabel,
} from "@/lib/companionDisplayLabel";

describe("companionDisplayLabel", () => {
  it("prefers custom and cached companion names before species labels", () => {
    expect(
      resolveCompanionDisplayLabel({
        companion_name: "Glacireon",
        cached_creature_name: "Ice Fox",
        spirit_animal: "ice_fox",
      }),
    ).toBe("Glacireon");

    expect(
      resolveCompanionDisplayLabel({
        companion_name: null,
        cached_creature_name: "Glacireon",
        spirit_animal: "ice_fox",
      }),
    ).toBe("Glacireon");

    expect(
      resolveCompanionDisplayLabel({
        companion_name: null,
        cached_creature_name: null,
        spirit_animal: "ice_fox",
      }),
    ).toBe("Ice Fox");
  });

  it("formats possessive companion labels for composer copy", () => {
    expect(toPossessiveCompanionLabel("Nova")).toBe("Nova's");
    expect(toPossessiveCompanionLabel("Cosmos")).toBe("Cosmos'");
  });
});
