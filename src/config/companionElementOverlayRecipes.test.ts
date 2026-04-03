import { describe, expect, it } from "vitest";
import { resolveCompanionElementOverlayRecipe } from "./companionElementOverlayRecipes";

describe("companion element overlay recipes", () => {
  it("applies stage-gated visuals to the resolved plane recipe", () => {
    const preGuardian = resolveCompanionElementOverlayRecipe({
      elementId: "fire",
      plane: "backdrop",
      variant: "companion",
      stage: 20,
    });
    const guardian = resolveCompanionElementOverlayRecipe({
      elementId: "fire",
      plane: "backdrop",
      variant: "companion",
      stage: 21,
    });
    const mythic = resolveCompanionElementOverlayRecipe({
      elementId: "fire",
      plane: "backdrop",
      variant: "companion",
      stage: 56,
    });
    const ascendedForeground = resolveCompanionElementOverlayRecipe({
      elementId: "fire",
      plane: "foreground",
      variant: "companion",
      stage: 81,
    });

    expect(preGuardian.visuals.crown).toBe(false);
    expect(guardian.visuals.crown).toBe(true);
    expect(mythic.visuals.geometry).toBe(true);
    expect(ascendedForeground.visuals.constellation).toBe(true);
  });

  it("keeps softer nature particles behind the art while fire uses foreground accents", () => {
    const natureBackdrop = resolveCompanionElementOverlayRecipe({
      elementId: "nature",
      plane: "backdrop",
      variant: "companion",
      stage: 12,
    });
    const natureForeground = resolveCompanionElementOverlayRecipe({
      elementId: "nature",
      plane: "foreground",
      variant: "companion",
      stage: 12,
    });
    const fireForeground = resolveCompanionElementOverlayRecipe({
      elementId: "fire",
      plane: "foreground",
      variant: "companion",
      stage: 12,
    });

    expect(natureBackdrop.visuals.particles).toBe(true);
    expect(natureForeground.visuals.particles).toBe(false);
    expect(fireForeground.visuals.particles).toBe(true);
    expect(fireForeground.visuals.edgeGlow).toBe(true);
  });

  it("resolves event burst visuals per plane without changing the element recipe", () => {
    const wakeEvent = {
      id: "wake-1",
      type: "wake" as const,
      intensity: "heroic" as const,
      durationMs: 2200,
      createdAt: Date.now(),
      element: "light",
      stage: 8,
      reason: "Wake up",
    };

    const backdrop = resolveCompanionElementOverlayRecipe({
      elementId: "light",
      plane: "backdrop",
      variant: "companion",
      stage: 8,
      event: wakeEvent,
    });
    const foreground = resolveCompanionElementOverlayRecipe({
      elementId: "light",
      plane: "foreground",
      variant: "companion",
      stage: 8,
      event: wakeEvent,
    });

    expect(backdrop.id).toBe("light");
    expect(foreground.id).toBe("light");
    expect(backdrop.eventBurst.visuals.ring).toBe(true);
    expect(backdrop.eventBurst.visuals.beam).toBe(false);
    expect(foreground.eventBurst.visuals.beam).toBe(true);
    expect(foreground.eventBurst.visuals.rays).toBe(true);
  });
});
