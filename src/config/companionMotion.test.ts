import { describe, expect, it } from "vitest";
import {
  getCompanionMotionEventCode,
  getCompanionMotionEventTypeFromReason,
  getCompanionMotionIntensityFromXp,
  getCompanionMotionSceneConfig,
  getCompanionMotionSceneForStage,
  getCompanionMotionStagePower,
  shouldAttemptRiveScene,
} from "./companionMotion";

describe("companionMotion config", () => {
  it("maps egg stage to the egg idle scene", () => {
    expect(getCompanionMotionSceneForStage(0)).toBe("egg_idle");
    expect(getCompanionMotionSceneForStage(1)).toBe("companion_aura");
  });

  it("keeps Rive disabled until an authored asset is configured", () => {
    expect(shouldAttemptRiveScene("egg_idle")).toBe(false);
    expect(shouldAttemptRiveScene("companion_aura")).toBe(false);
    expect(shouldAttemptRiveScene("evolution_hero")).toBe(false);
  });

  it("documents the expected authored Rive asset contract", () => {
    expect(getCompanionMotionSceneConfig("egg_idle")).toMatchObject({
      expectedSrc: "/rive/companion/egg_idle_v1.riv",
      artboard: "EggIdle",
      stateMachines: ["EggIdleMachine"],
    });
    expect(getCompanionMotionSceneConfig("companion_aura")).toMatchObject({
      expectedSrc: "/rive/companion/companion_aura_v1.riv",
      artboard: "CompanionAura",
      stateMachines: ["CompanionAuraMachine"],
    });
    expect(getCompanionMotionSceneConfig("evolution_hero")).toMatchObject({
      expectedSrc: "/rive/companion/evolution_hero_v1.riv",
      artboard: "EvolutionHero",
      stateMachines: ["EvolutionHeroMachine"],
    });
  });

  it("derives streak-style events from milestone reasons", () => {
    expect(getCompanionMotionEventTypeFromReason("7 Day Streak!")).toBe("streak");
    expect(getCompanionMotionEventTypeFromReason("Quest Complete!")).toBe("quest_complete");
    expect(getCompanionMotionEventTypeFromReason("Subtask Done!")).toBe("xp_gain");
  });

  it("scales motion intensity from the XP amount", () => {
    expect(getCompanionMotionIntensityFromXp(8)).toBe("subtle");
    expect(getCompanionMotionIntensityFromXp(24)).toBe("medium");
    expect(getCompanionMotionIntensityFromXp(48)).toBe("heroic");
  });

  it("exposes stable event codes and stage power for runtime bindings", () => {
    expect(getCompanionMotionEventCode("idle")).toBe(0);
    expect(getCompanionMotionEventCode("evolution_reveal")).toBe(6);
    expect(getCompanionMotionStagePower(0)).toBe(0.22);
    expect(getCompanionMotionStagePower(21)).toBe(0.7);
    expect(getCompanionMotionStagePower(81)).toBe(1);
  });
});
