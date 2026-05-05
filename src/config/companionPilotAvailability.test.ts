import { describe, expect, it } from "vitest";

import { COMPANION_ELEMENTS, COMPANION_PRESETS } from "./companionCatalog";
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
  it("supports all active companion presets and elements", () => {
    expect(PILOT_COMPANION_PRESET_IDS).toEqual(COMPANION_PRESETS.map((preset) => preset.id));
    expect(PILOT_COMPANION_ELEMENT_IDS).toEqual(COMPANION_ELEMENTS.map((element) => element.id));
    expect(COMPANION_FUTURE_STATE_LABEL).toBe("Coming Soon");
  });

  it("recognizes supported presets and elements", () => {
    expect(isPilotCompanionPreset("fox")).toBe(true);
    expect(isPilotCompanionPreset("dragon")).toBe(true);
    expect(isPilotCompanionElement("nature")).toBe(true);
    expect(isPilotCompanionElement("storm")).toBe(true);
  });

  it("returns stable supported defaults", () => {
    expect(getDefaultPilotCompanionPresetId()).toBe("fox");
    expect(getDefaultPilotCompanionElementId()).toBe("fire");
  });
});
