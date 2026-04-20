from __future__ import annotations

from typing import Literal


PlannerDraftStatus = Literal["scheduled_draft", "needs_scheduling", "tentative_time"]

PRIMARY_REASON_TEMPLATES: list[tuple[str, str]] = [
    ("respects_user_requested_time", "Scheduled at the time you asked for."),
    ("after_work_window", "Scheduled after work to match your availability."),
    ("tonight_window", "Scheduled tonight to fit the time you named."),
    ("later_window", "Scheduled later in the day to match your timing."),
    ("morning_window", "Scheduled in the morning to fit your timing."),
    ("afternoon_window", "Scheduled in the afternoon to fit your timing."),
    ("evening_window", "Scheduled in the evening to fit your timing."),
    ("matches_energy_window", "Placed where it best matches your energy rhythm."),
    ("matches_physical_energy", "Placed in a window that suits a physical task."),
    ("matches_deep_work_energy", "Placed in a window that suits focused work."),
    ("high_priority_fit", "Placed earlier to keep a high-priority task moving."),
    ("avoids_calendar_conflict", "Fits around your calendar without conflicts."),
    ("respects_daily_load_cap", "Fits without overloading the day."),
    ("minimizes_fragmentation", "Uses a cleaner block instead of a fragmented gap."),
    ("suggested_slot_bias", "Uses one of your strongest open windows."),
    ("sufficient_duration", "Keeps enough uninterrupted time for the task."),
    ("needs_manual_scheduling", "I kept this as a draft because I couldn't find a clean slot yet."),
]

SECONDARY_REASON_TEMPLATES: list[tuple[str, str]] = [
    ("daily_load_cap_pressure", "The day is already carrying a lot."),
    ("outside_preferred_window", "It sits outside the ideal timing window."),
    ("misses_energy_window", "It misses your best energy window."),
    ("fragmented_slot", "It uses a tighter gap than ideal."),
    ("late_day_pressure", "It lands later than I would normally prefer."),
    ("deep_work_block_limit", "It pushes against your focus-block limit."),
    ("calendar_conflict", "It may still conflict with your calendar."),
    ("no_safe_slot_found", "There was no safe slot to place it cleanly."),
]

STATUS_SUFFIX = {
    "scheduled_draft": "and keeps this moving today.",
    "tentative_time": "consider moving it earlier if the day tightens.",
    "needs_scheduling": "approve it later or place it manually.",
}


def _pick_summary(
    candidates: list[str],
    templates: list[tuple[str, str]],
    excluded: set[str] | None = None,
) -> tuple[str | None, str | None]:
    excluded = excluded or set()
    for key, summary in templates:
        if key in excluded:
            continue
        if key in candidates:
            return key, summary
    return None, None


def build_reason_summary(
    status: PlannerDraftStatus,
    reason_codes: list[str],
    soft_conflicts: list[str],
) -> str:
    primary_key, primary_summary = _pick_summary(reason_codes, PRIMARY_REASON_TEMPLATES)
    _, secondary_summary = _pick_summary(reason_codes, PRIMARY_REASON_TEMPLATES, {primary_key} if primary_key else set())
    if not secondary_summary:
        _, secondary_summary = _pick_summary(soft_conflicts, SECONDARY_REASON_TEMPLATES)

    segments = [
        segment
        for segment in (primary_summary, secondary_summary)
        if segment
    ]
    deduped_segments: list[str] = []
    for segment in segments:
        if segment not in deduped_segments:
            deduped_segments.append(segment)

    if not deduped_segments:
        deduped_segments.append(
            "I kept this as a draft because I couldn't find a clean slot yet."
            if status == "needs_scheduling"
            else "This is the cleanest scheduling fit I found."
        )

    return f"{' '.join(deduped_segments[:2])} {STATUS_SUFFIX[status]}".strip()
