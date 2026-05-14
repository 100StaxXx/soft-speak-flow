import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_COLORS,
  QUEST_FORM_STYLES,
  QUEST_TEMPLATE_BROWSER_STYLES,
  TIME_SLOTS,
  generateTimeSlots,
  getNextHalfHourTime,
  getQuestDifficultyIconClasses,
  getQuestOptionPillClasses,
} from "./quest-shared";
import { COMPANION_FROSTED_QUEST_LIGHT_CLASS } from "@/lib/companionFrostedTheme";

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

describe("quest-shared time slots", () => {
  it("generates 30-minute slots from 00:00 through 23:30", () => {
    const slots = generateTimeSlots();
    expect(slots[0]).toBe("00:00");
    expect(slots[slots.length - 1]).toBe("23:30");
    expect(slots.length).toBe(48);
  });

  it("keeps a consistent 30-minute interval between adjacent slots", () => {
    for (let i = 1; i < TIME_SLOTS.length; i += 1) {
      expect(toMinutes(TIME_SLOTS[i]) - toMinutes(TIME_SLOTS[i - 1])).toBe(30);
    }
  });

  it("rounds to the next half-hour boundary", () => {
    expect(getNextHalfHourTime(new Date("2026-02-16T11:17:00"))).toBe("11:30");
    expect(getNextHalfHourTime(new Date("2026-02-16T11:30:00"))).toBe("11:30");
  });

  it("rolls over to 00:00 when rounding late-night times", () => {
    expect(getNextHalfHourTime(new Date("2026-02-16T23:46:00"))).toBe("00:00");
  });
});

describe("quest-shared tokenized editor classes", () => {
  it("lets active option pill tones own their text color", () => {
    const classes = getQuestOptionPillClasses(true, DIFFICULTY_COLORS.medium.pill);

    expect(classes).toContain("text-foreground");
    expect(classes).not.toContain("text-white");
  });

  it("uses tokenized inactive icon contrast for difficulty bubbles", () => {
    const classes = getQuestDifficultyIconClasses("medium", false);

    expect(classes).toContain("border-[hsl(var(--border)_/_0.72)]");
    expect(classes).toContain("bg-card/[0.72]");
    expect(classes).toContain("text-muted-foreground");
    expect(classes).not.toContain("text-white");
  });

  it("resolves the frosted quest variables from the companion theme alias", () => {
    expect(QUEST_FORM_STYLES.sheet).toContain(COMPANION_FROSTED_QUEST_LIGHT_CLASS);
    expect(QUEST_FORM_STYLES.popover).toContain(COMPANION_FROSTED_QUEST_LIGHT_CLASS);
    expect(QUEST_FORM_STYLES.sheet).not.toContain("[--primary:202_68%_68%]");
    expect(QUEST_FORM_STYLES.sheet).not.toContain("[--celestial-blue:202_92%_76%]");
  });

  it("uses companion primary rgb for frosted quest shadows", () => {
    const frostedChrome = [
      QUEST_FORM_STYLES.sheet,
      QUEST_FORM_STYLES.sectionCard,
      QUEST_FORM_STYLES.popover,
      QUEST_FORM_STYLES.desktopPanelShell,
      QUEST_TEMPLATE_BROWSER_STYLES.header,
      QUEST_TEMPLATE_BROWSER_STYLES.rowDefault,
      getQuestOptionPillClasses(true, DIFFICULTY_COLORS.medium.pill),
    ].join(" ");

    expect(frostedChrome).toContain("rgba(var(--primary-rgb),0.58)");
    expect(frostedChrome).toContain("rgba(var(--primary-rgb),0.34)");
    expect(frostedChrome).not.toMatch(/rgba\((?:92,157,198|58,121,158),/);
  });

  it("uses companion-token color mixes instead of fixed blue CTA gradient stops", () => {
    const primaryButton = DIFFICULTY_COLORS.medium.primaryButton;

    expect(primaryButton).toContain("color-mix(in_srgb,hsl(var(--celestial-blue))");
    expect(primaryButton).not.toContain("#f3fbff");
    expect(primaryButton).not.toContain("#eaf8ff");
    expect(primaryButton).not.toContain("#f4fbff");
  });
});
