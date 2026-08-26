import { describe, expect, it } from "vitest";
import {
  COMPANION_FROSTED_PLANNER_DARK_CLASS,
  COMPANION_FROSTED_PLANNER_LIGHT_CLASS,
} from "@/lib/companionFrostedTheme";
import { plannerPathfinderTheme } from "./plannerPathfinderTheme";

describe("plannerPathfinderTheme", () => {
  it("resolves light and dark frosted variables from companion theme aliases", () => {
    expect(plannerPathfinderTheme.modeVars.light).toBe(COMPANION_FROSTED_PLANNER_LIGHT_CLASS);
    expect(plannerPathfinderTheme.modeVars.dark).toBe(COMPANION_FROSTED_PLANNER_DARK_CLASS);
    expect(plannerPathfinderTheme.modeVars.light).not.toContain("[--primary:202_68%_68%]");
    expect(plannerPathfinderTheme.modeVars.dark).not.toContain("[--primary:201_92%_58%]");
  });

  it("uses companion primary rgb for frosted planner shadows while keeping semantic success color", () => {
    const themeClasses = JSON.stringify(plannerPathfinderTheme);

    expect(themeClasses).toContain("rgba(var(--primary-rgb),0.54)");
    expect(themeClasses).not.toMatch(/rgba\((?:92,157,198|73,155,205|58,121,158|28,117,177),/);
    expect(themeClasses).toContain("rgba(48,130,112,0.34)");
  });

  it("uses companion-token color mixes instead of fixed blue CTA gradient stops", () => {
    expect(plannerPathfinderTheme.primaryButton).toContain("border-primary bg-primary");
    expect(plannerPathfinderTheme.primaryButton).not.toContain("#eaf8ff");
    expect(plannerPathfinderTheme.primaryButton).not.toContain("#f4fbff");
  });
});
