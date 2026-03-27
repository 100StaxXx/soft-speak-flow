import { describe, expect, it } from "vitest";
import { hasQuestTemplateCustomization } from "./templateDraftDiff";
import type { QuestTemplatePrefill } from "@/features/quests/types";

const buildTemplate = (overrides: Partial<QuestTemplatePrefill> = {}): QuestTemplatePrefill => ({
  id: "work-deep-work-block",
  title: "Deep work block",
  difficulty: "medium",
  estimatedDuration: 90,
  notes: "Protect focus and silence notifications.",
  subtasks: ["Choose one priority", "Silence notifications"],
  templateOrigin: "common",
  sourceCommonTemplateId: "work-deep-work-block",
  ...overrides,
});

describe("hasQuestTemplateCustomization", () => {
  it("ignores whitespace-only changes in template-backed fields", () => {
    const template = buildTemplate();

    expect(hasQuestTemplateCustomization(template, {
      title: "  Deep   work block ",
      difficulty: "medium",
      estimatedDuration: 90,
      notes: "  Protect focus and silence notifications.  ",
      subtasks: ["Choose one priority", "  Silence   notifications  "],
    })).toBe(false);
  });

  it("treats reordered subtasks as a customization", () => {
    const template = buildTemplate();

    expect(hasQuestTemplateCustomization(template, {
      title: template.title,
      difficulty: template.difficulty,
      estimatedDuration: template.estimatedDuration,
      notes: template.notes,
      subtasks: ["Silence notifications", "Choose one priority"],
    })).toBe(true);
  });

  it("ignores blank subtasks when comparing drafts", () => {
    const template = buildTemplate();

    expect(hasQuestTemplateCustomization(template, {
      title: template.title,
      difficulty: template.difficulty,
      estimatedDuration: template.estimatedDuration,
      notes: template.notes,
      subtasks: ["Choose one priority", "", "Silence notifications", "   "],
    })).toBe(false);
  });

  it("does not flag schedule-only changes because schedule fields are excluded from the template diff", () => {
    const template = buildTemplate();

    expect(hasQuestTemplateCustomization(template, {
      title: template.title,
      difficulty: template.difficulty,
      estimatedDuration: template.estimatedDuration,
      notes: template.notes,
      subtasks: template.subtasks,
    })).toBe(false);
  });
});
