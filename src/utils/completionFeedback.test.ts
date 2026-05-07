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

    expect(feedback.companion.tone).toBe("hype");
    expect(feedback.companion.message).toContain("Launch Week");
    expect(feedback.generationSource).toBe("fallback");
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
    expect(feedback.generationSource).toBe("fallback");
  });

  it("keeps fallback copy deterministic while varying across completion seeds", () => {
    const event = {
      taskId: "task-1",
      taskTitle: "Portfolio session",
      completionSource: "quest" as const,
      completedAt: "2026-04-29T16:00:00.000Z",
    };
    const first = buildCompletionFeedbackFallback(event, new Date("2026-04-29T16:00:00.000Z"));
    const second = buildCompletionFeedbackFallback(event, new Date("2026-04-29T16:00:00.000Z"));
    const messages = new Set(
      Array.from({ length: 16 }, (_, index) =>
        buildCompletionFeedbackFallback({
          ...event,
          taskId: `task-${index}`,
          completedAt: `2026-04-29T16:${String(index).padStart(2, "0")}:00.000Z`,
        }, new Date("2026-04-29T16:00:00.000Z")).companion.message),
    );

    expect(first).toEqual(second);
    expect(messages.size).toBeGreaterThan(1);
  });

  it("uses client-provided day progress signals for instant fallback buckets", () => {
    const firstWin = buildCompletionFeedbackFallback({
      taskId: "task-1",
      taskTitle: "Portfolio session",
      completionSource: "quest",
      completedAt: "2026-04-29T16:00:00.000Z",
      firstCompletionToday: true,
    }, new Date("2026-04-29T16:00:00.000Z"));
    const momentum = buildCompletionFeedbackFallback({
      taskId: "task-2",
      taskTitle: "Investor email",
      completionSource: "quest",
      completedAt: "2026-04-29T17:00:00.000Z",
      isBuildingMomentum: true,
    }, new Date("2026-04-29T17:00:00.000Z"));
    const overloaded = buildCompletionFeedbackFallback({
      taskId: "task-3",
      taskTitle: "Clean inbox",
      completionSource: "quest",
      completedAt: "2026-04-29T18:00:00.000Z",
      isOverloaded: true,
    }, new Date("2026-04-29T18:00:00.000Z"));

    expect(firstWin.companion.message).not.toBe("Portfolio session is done. That is real progress.");
    expect(firstWin.companion.tone).toBe("proud");
    expect(momentum.companion.tone).toBe("locked_in");
    expect(overloaded.companion.tone).toBe("calm");
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
      generationSource: "ai",
    });

    expect(feedback?.companion).toEqual({
      message: "You got the portfolio session done after a packed day.",
      tone: "locked_in",
    });
    expect(feedback?.mentor?.show).toBe(true);
    expect(feedback?.mentor?.message.length).toBeLessThanOrEqual(150);
    expect(feedback?.generationSource).toBe("ai");
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
