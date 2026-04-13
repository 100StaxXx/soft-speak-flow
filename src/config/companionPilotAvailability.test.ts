import { describe, expect, it } from "vitest";

import {
  COMPANION_FUTURE_STATE_LABEL,
  PILOT_COMPANION_ELEMENT_IDS,
  PILOT_COMPANION_PRESET_IDS,
  getDefaultPilotCompanionElementId,
  getDefaultPilotCompanionPresetId,
  isPilotCompanionElement,
  isPilotCompanionPreset,
} from "./companionPilotAvailability";

describe("companionPilotAvailability", () => {
  it("locks the launch pilot matrix", () => {
    expect(PILOT_COMPANION_PRESET_IDS).toEqual(["fox", "phoenix", "leviathan"]);
    expect(PILOT_COMPANION_ELEMENT_IDS).toEqual(["fire", "ice", "nature"]);
    expect(COMPANION_FUTURE_STATE_LABEL).toBe("Coming Soon");
  });

  it("recognizes supported presets and elements", () => {
    expect(isPilotCompanionPreset("fox")).toBe(true);
    expect(isPilotCompanionPreset("dragon")).toBe(false);
    expect(isPilotCompanionElement("nature")).toBe(true);
    expect(isPilotCompanionElement("storm")).toBe(false);
  });

  it("returns stable supported defaults", () => {
    expect(getDefaultPilotCompanionPresetId()).toBe("fox");
    expect(getDefaultPilotCompanionElementId()).toBe("fire");
  });
});
