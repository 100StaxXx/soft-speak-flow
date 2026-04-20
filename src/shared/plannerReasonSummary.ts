import type { PlannerDraftStatus } from "./plannerOptimizer.ts";

const PRIMARY_REASON_TEMPLATES: Array<{
  key: string;
  summary: string;
}> = [
  {
    key: "respects_user_requested_time",
    summary: "Scheduled at the time you asked for.",
  },
  {
    key: "after_work_window",
    summary: "Scheduled after work to match your availability.",
  },
  {
    key: "tonight_window",
    summary: "Scheduled tonight to fit the time you named.",
  },
  {
    key: "later_window",
    summary: "Scheduled later in the day to match your timing.",
  },
  {
    key: "morning_window",
    summary: "Scheduled in the morning to fit your timing.",
  },
  {
    key: "afternoon_window",
    summary: "Scheduled in the afternoon to fit your timing.",
  },
  {
    key: "evening_window",
    summary: "Scheduled in the evening to fit your timing.",
  },
  {
    key: "matches_energy_window",
    summary: "Placed where it best matches your energy rhythm.",
  },
  {
    key: "matches_physical_energy",
    summary: "Placed in a window that suits a physical task.",
  },
  {
    key: "matches_deep_work_energy",
    summary: "Placed in a window that suits focused work.",
  },
  {
    key: "high_priority_fit",
    summary: "Placed earlier to keep a high-priority task moving.",
  },
  {
    key: "avoids_calendar_conflict",
    summary: "Fits around your calendar without conflicts.",
  },
  {
    key: "respects_daily_load_cap",
    summary: "Fits without overloading the day.",
  },
  {
    key: "minimizes_fragmentation",
    summary: "Uses a cleaner block instead of a fragmented gap.",
  },
  {
    key: "suggested_slot_bias",
    summary: "Uses one of your strongest open windows.",
  },
  {
    key: "sufficient_duration",
    summary: "Keeps enough uninterrupted time for the task.",
  },
  {
    key: "needs_manual_scheduling",
    summary: "I kept this as a draft because I couldn't find a clean slot yet.",
  },
];

const SECONDARY_REASON_TEMPLATES: Array<{
  key: string;
  summary: string;
}> = [
  {
    key: "daily_load_cap_pressure",
    summary: "The day is already carrying a lot.",
  },
  {
    key: "outside_preferred_window",
    summary: "It sits outside the ideal timing window.",
  },
  {
    key: "misses_energy_window",
    summary: "It misses your best energy window.",
  },
  { key: "fragmented_slot", summary: "It uses a tighter gap than ideal." },
  {
    key: "late_day_pressure",
    summary: "It lands later than I would normally prefer.",
  },
  {
    key: "deep_work_block_limit",
    summary: "It pushes against your focus-block limit.",
  },
  {
    key: "calendar_conflict",
    summary: "It may still conflict with your calendar.",
  },
  {
    key: "no_safe_slot_found",
    summary: "There was no safe slot to place it cleanly.",
  },
];

const STATUS_SUFFIX: Record<PlannerDraftStatus, string> = {
  scheduled_draft: "and keeps this moving today.",
  tentative_time: "consider moving it earlier if the day tightens.",
  needs_scheduling: "approve it later or place it manually.",
};

const pickSummary = (
  candidates: string[],
  templates: Array<{ key: string; summary: string }>,
  excluded = new Set<string>(),
): string | null => {
  for (const template of templates) {
    if (excluded.has(template.key)) continue;
    if (candidates.includes(template.key)) return template.summary;
  }

  return null;
};

export const buildPlannerReasonSummary = (params: {
  status: PlannerDraftStatus;
  reasonCodes: string[];
  softConflicts: string[];
}): string => {
  const { status, reasonCodes, softConflicts } = params;
  const primaryTemplate = pickSummary(reasonCodes, PRIMARY_REASON_TEMPLATES);
  const primaryKey = PRIMARY_REASON_TEMPLATES.find((template) =>
    reasonCodes.includes(template.key)
  )?.key;
  const secondaryTemplate = pickSummary(
    reasonCodes,
    PRIMARY_REASON_TEMPLATES,
    new Set(primaryKey ? [primaryKey] : []),
  ) ??
    pickSummary(softConflicts, SECONDARY_REASON_TEMPLATES);

  const segments = [
    primaryTemplate,
    secondaryTemplate,
  ].filter((segment, index, array): segment is string =>
    Boolean(segment) && array.indexOf(segment) === index
  )
    .slice(0, 2);

  if (segments.length === 0) {
    segments.push(
      status === "needs_scheduling"
        ? "I kept this as a draft because I couldn't find a clean slot yet."
        : "This is the cleanest scheduling fit I found.",
    );
  }

  return `${segments.join(" ")} ${STATUS_SUFFIX[status]}`.trim();
};
