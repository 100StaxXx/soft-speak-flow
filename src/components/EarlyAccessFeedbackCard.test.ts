import { describe, expect, it } from "vitest";

import { shouldShowEarlyAccessFeedback } from "@/components/EarlyAccessFeedbackCard";
import type { DailyGuideThreadRow } from "@/services/dailyGuideThread";

const thread = (overrides: Partial<DailyGuideThreadRow>): DailyGuideThreadRow => ({
  id: "thread",
  user_id: "user",
  thread_date: "2026-08-10",
  mentor_id: null,
  mentor_name: null,
  daily_pep_talk_id: null,
  encouragement_title: null,
  encouragement_completed_at: null,
  guide_question_id: null,
  guide_question: null,
  focus_option_id: null,
  focus_label: null,
  focus_category: null,
  focus_answered_at: null,
  companion_question_id: null,
  companion_question: null,
  companion_answer_id: null,
  companion_answer_label: null,
  companion_answered_at: null,
  companion_response: null,
  companion_acknowledged_at: null,
  practice_assignment_id: null,
  practice_key: null,
  practice_completed_at: null,
  evening_reflection_id: null,
  evening_reflected_at: null,
  created_at: "2026-08-10T08:00:00.000Z",
  updated_at: "2026-08-10T08:00:00.000Z",
  ...overrides,
});

describe("shouldShowEarlyAccessFeedback", () => {
  it("waits until the user has meaningful activity on two daily threads", () => {
    const previous = thread({ thread_date: "2026-08-09", practice_completed_at: "2026-08-09T12:00:00Z" });
    expect(shouldShowEarlyAccessFeedback({ current: thread({}), previous })).toBe(false);
    expect(shouldShowEarlyAccessFeedback({
      current: thread({ focus_answered_at: "2026-08-10T09:00:00Z" }),
      previous,
    })).toBe(true);
  });

  it("respects the thirty-day feedback cooldown", () => {
    const current = thread({ focus_answered_at: "2026-08-10T09:00:00Z" });
    const previous = thread({ thread_date: "2026-08-09", practice_completed_at: "2026-08-09T12:00:00Z" });
    const now = Date.parse("2026-08-10T12:00:00Z");
    expect(shouldShowEarlyAccessFeedback({
      current,
      previous,
      state: { actedAt: "2026-08-09T12:00:00Z" },
      now,
    })).toBe(false);
  });
});
