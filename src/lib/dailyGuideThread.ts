import type { DailyFormationCategory } from "@/data/dailyFormationPractices";

export const DAILY_GUIDE_FOCUS_SELECTED_EVENT = "daily-guide-focus-selected";
export const DAILY_ENCOURAGEMENT_COMPLETED_EVENT = "daily-encouragement-completed";
export const DAILY_PRACTICE_COMPLETED_EVENT = "daily-practice-completed";

export interface DailyGuideFocusSelectedDetail {
  category: DailyFormationCategory;
  focusLabel: string;
  guideName: string;
  source?: "guide" | "companion";
}

export interface DailyGuideQuestionOption {
  id: string;
  label: string;
  category: DailyFormationCategory;
  companionResponse: string;
}

export interface DailyGuideQuestion {
  id: string;
  prompt: string;
  options: readonly DailyGuideQuestionOption[];
}

const DIRECTION_OPTIONS = [
  {
    id: "clarity",
    label: "Clarity",
    category: "Mind",
    companionResponse: "Clarity, then. I’ll help you keep the next step simple today.",
  },
  {
    id: "responsibility",
    label: "One responsibility",
    category: "Mind",
    companionResponse: "One responsibility is enough to begin. I’ll notice the follow-through with you.",
  },
  {
    id: "pace",
    label: "A gentler pace",
    category: "Body",
    companionResponse: "A gentler pace belongs in the plan. I’ll help you leave room for it.",
  },
] as const satisfies readonly DailyGuideQuestionOption[];

const COURAGE_OPTIONS = [
  {
    id: "courage",
    label: "Courage",
    category: "Soul",
    companionResponse: "Courage can be quiet. I’ll stay close while you practice it today.",
  },
  {
    id: "self-respect",
    label: "Self-respect",
    category: "Soul",
    companionResponse: "We’ll protect what is honest and dignified today, without hardening.",
  },
  {
    id: "gentleness",
    label: "Gentleness",
    category: "Body",
    companionResponse: "Gentleness it is. Nothing meaningful has to be powered by shame.",
  },
] as const satisfies readonly DailyGuideQuestionOption[];

const CARE_OPTIONS = [
  {
    id: "energy",
    label: "Care for my energy",
    category: "Body",
    companionResponse: "I’ll help you notice your limits before the day gets too loud.",
  },
  {
    id: "quiet",
    label: "More quiet",
    category: "Body",
    companionResponse: "We’ll leave some quiet in the day. You do not have to fill every space.",
  },
  {
    id: "support",
    label: "Connection",
    category: "Soul",
    companionResponse: "Connection matters today. I’ll remind you that asking for support can be a faithful step.",
  },
] as const satisfies readonly DailyGuideQuestionOption[];

const REFLECTION_OPTIONS = [
  {
    id: "prayer",
    label: "Prayer",
    category: "Soul",
    companionResponse: "We’ll make room to return to prayer without turning it into pressure.",
  },
  {
    id: "perspective",
    label: "Perspective",
    category: "Mind",
    companionResponse: "Let’s keep enough distance to see the day truthfully and kindly.",
  },
  {
    id: "repair",
    label: "Repair",
    category: "Soul",
    companionResponse: "Repair can begin small. I’ll remember that this matters to you today.",
  },
] as const satisfies readonly DailyGuideQuestionOption[];

export function getDailyGuideQuestion(topicCategory?: string | null): DailyGuideQuestion {
  const category = topicCategory?.trim().toLowerCase() ?? "";

  if (["confidence", "identity", "boundaries"].includes(category)) {
    return {
      id: "carry-today",
      prompt: "What do you most want to carry with you today?",
      options: COURAGE_OPTIONS,
    };
  }

  if (category === "wellbeing") {
    return {
      id: "care-today",
      prompt: "What kind of care would serve you today?",
      options: CARE_OPTIONS,
    };
  }

  if (["reflection", "mindset"].includes(category)) {
    return {
      id: "notice-today",
      prompt: "What deserves your attention before the day moves on?",
      options: REFLECTION_OPTIONS,
    };
  }

  return {
    id: "direction-today",
    prompt: "Where would a little more direction help today?",
    options: DIRECTION_OPTIONS,
  };
}

export interface DailyGuideThreadContextShape {
  threadDate: string;
  focusLabel: string | null;
  focusCategory: string | null;
  companionAnswerLabel?: string | null;
  practiceKey: string | null;
  practiceCompletedAt: string | null;
  eveningReflectedAt: string | null;
}

export function buildDailyGuideContinuityContext({
  current,
  previous,
}: {
  current?: DailyGuideThreadContextShape | null;
  previous?: DailyGuideThreadContextShape | null;
}): string | null {
  const lines: string[] = [];

  if (current?.focusLabel) {
    lines.push(current.companionAnswerLabel
      ? `Today the user chose “${current.focusLabel}” as their Daily Adventure path with their Companion.`
      : `Today the user chose “${current.focusLabel}” as the focus of the Guide's daily question.`);
    if (current.practiceKey) {
      lines.push(current.practiceCompletedAt
        ? "They completed the quest connected to that path."
        : "Their connected quest is still open; do not shame or pressure them about it.");
    }
  }

  if (current?.companionAnswerLabel) {
    lines.push(`In the companion check-in today, the user chose “${current.companionAnswerLabel}.”`);
  }

  if (previous?.focusLabel) {
    const result = previous.practiceCompletedAt
      ? "and completed the connected Faithful Step"
      : "and did not record the connected Faithful Step as complete";
    lines.push(`On the previous daily thread they chose “${previous.focusLabel}” ${result}.`);
    if (previous.eveningReflectedAt) {
      lines.push("They also completed the evening reflection for that thread.");
    }
  }

  if (previous?.companionAnswerLabel) {
    lines.push(`In that previous thread, their companion check-in answer was “${previous.companionAnswerLabel}.”`);
  }

  return lines.length > 0 ? lines.join(" ") : null;
}
