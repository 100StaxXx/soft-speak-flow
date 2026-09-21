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

describe("quest editor agenda styling", () => {
  it("uses a shared dark theme for sheets, sections and portaled pickers", () => {
    for (const key of ["sheet", "sectionCard", "popover", "desktopPanelShell"] as const) {
      expect(QUEST_FORM_STYLES[key]).toContain("agenda-quest-theme");
      expect(QUEST_FORM_STYLES[key]).not.toContain("companion-frosted-quest-light");
    }
  });
  it("keeps controls restrained without gradients or raised glowing outlines", () => {
    const classes = [...Object.values(QUEST_FORM_STYLES), ...Object.values(QUEST_TEMPLATE_BROWSER_STYLES),
      ...Object.values(DIFFICULTY_COLORS.medium)].join(" ");
    expect(classes).not.toContain("border-[2px]");
    expect(classes).not.toContain("radial-gradient");
    expect(DIFFICULTY_COLORS.medium.primaryButton).toContain("bg-primary");
    expect(getQuestOptionPillClasses(true, DIFFICULTY_COLORS.medium.pill)).toContain("bg-primary/15");
    expect(getQuestDifficultyIconClasses("medium", false)).toContain("text-muted-foreground");
  });
});
