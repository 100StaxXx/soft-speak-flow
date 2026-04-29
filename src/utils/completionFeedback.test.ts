import { describe, expect, it } from "vitest";

import {
  buildCompletionFeedbackFallback,
  normalizeCompletionFeedbackResponse,
  trimCompletionFeedbackLine,
} from "@/utils/completionFeedback";

describe("completionFeedback utilities", () => {
  it("builds contextual ritual fallback copy with campaign progress", () => {
    const feedback = buildCompletionFeedbackFallback({
      taskId: "task-1",
      taskTitle: "Portfolio Sprint",
      completionSource: "ritual",
      completedAt: "2026-04-29T16:00:00.000Z",
      habitSourceId: "habit-1",
      epicId: "epic-1",
      epicTitle: "Launch Week",
      completedAllRituals: true,
    }, new Date("2026-04-29T16:00:00.000Z"));

    expect(feedback).toEqual({
      companion: {
        message: "All rituals for Launch Week are handled. That is momentum you can feel.",
        tone: "hype",
      },
    });
  });

  it("uses recovery tone for overdue fallback copy", () => {
    const feedback = buildCompletionFeedbackFallback({
      taskId: "task-1",
      taskTitle: "Investor email",
      completionSource: "quest",
      taskDate: "2026-04-28",
      epicTitle: "Launch Week",
    }, new Date("2026-04-29T16:00:00.000Z"));

    expect(feedback.companion.tone).toBe("recovery");
    expect(feedback.companion.message).toContain("Investor email");
    expect(feedback.companion.message).toContain("Launch Week");
  });

  it("normalizes valid AI output and trims long mentor text", () => {
    const feedback = normalizeCompletionFeedbackResponse({
      companion: {
        message: "  You got the portfolio session done after a packed day.  ",
        tone: "locked_in",
      },
      mentor: {
        show: true,
        personality: "Disciplined / Elite",
        message: "Keep the standard visible. ".repeat(12),
      },
    });

    expect(feedback?.companion).toEqual({
      message: "You got the portfolio session done after a packed day.",
      tone: "locked_in",
    });
    expect(feedback?.mentor?.show).toBe(true);
    expect(feedback?.mentor?.message.length).toBeLessThanOrEqual(150);
  });

  it("rejects invalid AI output so callers can fall back", () => {
    expect(normalizeCompletionFeedbackResponse({
      companion: {
        message: "Done.",
        tone: "corny",
      },
    })).toBeNull();

    expect(normalizeCompletionFeedbackResponse({
      companion: {
        message: "",
        tone: "proud",
      },
    })).toBeNull();
  });

  it("keeps generated lines within popup limits", () => {
    const trimmed = trimCompletionFeedbackLine("Launch ".repeat(40), 72);
    expect(trimmed.length).toBeLessThanOrEqual(72);
    expect(trimmed.endsWith(".")).toBe(true);
  });
});
