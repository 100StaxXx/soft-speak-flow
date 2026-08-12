import { describe, expect, it } from "vitest";

import {
  COMPANION_FUTURE_STATE_LABEL,
  PILOT_CHRISTIAN_COMPANION_ELEMENT_IDS,
  PILOT_CHRISTIAN_COMPANION_FORM_IDS,
  PILOT_COMPANION_ELEMENT_IDS,
  PILOT_COMPANION_PRESET_IDS,
  getDefaultGracewardCompanionElementId,
  getDefaultPilotCompanionElementId,
  getDefaultPilotCompanionPresetId,
  isPilotChristianCompanionElement,
  isPilotChristianCompanionForm,
  isPilotCompanionElement,
  isPilotCompanionPreset,
} from "./companionPilotAvailability";

describe("companionPilotAvailability", () => {
  it("keeps the Graceward and Cosmiq launch matrices separate", () => {
    expect(PILOT_CHRISTIAN_COMPANION_FORM_IDS).toEqual(["lion", "dove"]);
    expect(PILOT_CHRISTIAN_COMPANION_ELEMENT_IDS).toEqual(["light", "nature"]);
    expect(PILOT_COMPANION_PRESET_IDS).toEqual(["fox", "phoenix", "leviathan"]);
    expect(PILOT_COMPANION_ELEMENT_IDS).toEqual(["fire", "ice", "nature"]);
    expect(COMPANION_FUTURE_STATE_LABEL).toBe("Coming Soon");
  });

  it("recognizes only the fully built Cosmiq selection matrix", () => {
    expect(isPilotCompanionPreset("fox")).toBe(true);
    expect(isPilotCompanionPreset("phoenix")).toBe(true);
    expect(isPilotCompanionPreset("leviathan")).toBe(true);
    expect(isPilotCompanionPreset("dragon")).toBe(false);
    expect(isPilotCompanionElement("nature")).toBe(true);
    expect(isPilotCompanionElement("ice")).toBe(true);
    expect(isPilotCompanionElement("storm")).toBe(false);
    expect(isPilotChristianCompanionForm("lion")).toBe(true);
    expect(isPilotChristianCompanionForm("fox")).toBe(false);
    expect(isPilotChristianCompanionElement("light")).toBe(true);
    expect(isPilotChristianCompanionElement("fire")).toBe(false);
  });

  it("returns stable supported defaults", () => {
    expect(getDefaultPilotCompanionPresetId()).toBe("fox");
    expect(getDefaultPilotCompanionElementId()).toBe("fire");
    expect(getDefaultGracewardCompanionElementId()).toBe("light");
  });
});
