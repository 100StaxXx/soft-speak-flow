from __future__ import annotations

import atexit
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Literal, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from posthog import Posthog
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

posthog_client = Posthog(
    api_key=os.environ.get("POSTHOG_API_KEY", ""),
    host=os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com"),
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)

try:
    from .policy import (
        clamp_priority,
        get_draft_status,
        get_effective_confidence,
        get_unscheduled_penalty,
        load_policy,
    )
    from .reason_summary import build_reason_summary
except ImportError:  # pragma: no cover - local service entrypoint fallback
    from policy import (
        clamp_priority,
        get_draft_status,
        get_effective_confidence,
        get_unscheduled_penalty,
        load_policy,
    )
    from reason_summary import build_reason_summary

try:
    from ortools.sat.python import cp_model
except ImportError as exc:  # pragma: no cover - deployment dependency
    raise RuntimeError(
        "ortools is required for the planner optimizer service"
    ) from exc


class TimingPreference(BaseModel):
    label: Optional[Literal["morning", "afternoon", "evening", "later", "tonight", "after_work"]] = None
    earliest_start: Optional[str] = None
    latest_end: Optional[str] = None


class TaskToSchedule(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    duration_min: int = Field(gt=0)
    timing_preference: Optional[TimingPreference] = None
    energy_type: Optional[Literal["deep", "admin", "physical", "errand", "social"]] = None
    priority: int = Field(default=1, ge=1, le=5)
    confidence: float = Field(ge=0.0, le=1.0)
    derived_from_message: Optional[str] = None
    notes: Optional[str] = None


class ExistingTask(BaseModel):
    id: str
    start: str
    end: str
    energy_type: Optional[Literal["deep", "admin", "physical", "errand", "social"]] = None
    status: Optional[str] = None


class CalendarEvent(BaseModel):
    id: str
    title: Optional[str] = None
    start: str
    end: str
    source: Optional[Literal["google", "outlook", "internal"]] = None
    hard_block: bool = True


class Habit(BaseModel):
    id: str
    title: str
    preferred_windows: list[str] = Field(default_factory=list)
    duration_min: Optional[int] = None


class WorkHours(BaseModel):
    start: str
    end: str


class PlannerMemory(BaseModel):
    wake_time: Optional[str] = None
    wind_down_time: Optional[str] = None
    work_hours: Optional[WorkHours] = None
    preferred_workout_windows: list[str] = Field(default_factory=list)
    preferred_deep_work_windows: list[str] = Field(default_factory=list)


class SuggestedSlot(BaseModel):
    date: str
    time: str
    end_time: str
    score: int
    reason: str


class PlanningWindow(BaseModel):
    start_date: str
    end_date: str


class Constraints(BaseModel):
    slot_granularity_min: int = Field(gt=0)
    min_buffer_min: int = Field(ge=0)
    max_scheduled_minutes_per_day: Optional[int] = None
    max_deep_work_blocks_per_day: Optional[int] = None
    suggested_slots: list[SuggestedSlot] = Field(default_factory=list)


class OptimizerRequest(BaseModel):
    current_datetime: str
    timezone: str
    scheduling_mode: Literal["aggressive", "balanced", "light"]
    planning_window: PlanningWindow
    tasks_to_schedule: list[TaskToSchedule]
    existing_tasks: list[ExistingTask] = Field(default_factory=list)
    calendar_events: list[CalendarEvent] = Field(default_factory=list)
    habits: list[Habit] = Field(default_factory=list)
    planner_memory: PlannerMemory
    constraints: Constraints


class DraftResponse(BaseModel):
    task_id: str
    title: str
    start: Optional[str] = None
    end: Optional[str] = None
    status: Literal["scheduled_draft", "needs_scheduling", "tentative_time"]
    slot_score: Optional[int] = None
    hard_conflict: bool
    soft_conflicts: list[str]
    reason_codes: list[str]
    reason_summary: str
    fallback_to_inbox: Optional[bool] = None


class UnscheduledResponse(BaseModel):
    task_id: str
    title: str
    reason_codes: list[str]


class OptimizerResponse(BaseModel):
    drafts: list[DraftResponse]
    unscheduled: list[UnscheduledResponse]


@dataclass
class SlotCandidate:
    task_id: str
    title: str
    date_key: str
    day_index: int
    start_bucket: int
    end_bucket: int
    absolute_start_bucket: int
    absolute_end_bucket: int
    score: int
    reason_codes: list[str]
    soft_conflicts: list[str]
    hard_conflict: bool
    reason_summary: str


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: F811
    yield
    posthog_client.flush()


app = FastAPI(title="Planner Optimizer Service", lifespan=lifespan)


def parse_clock(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


def format_clock(value: int) -> str:
    normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60)
    hours = normalized // 60
    minutes = normalized % 60
    return f"{hours:02d}:{minutes:02d}"


def extract_date(value: str) -> str:
    return value[:10]


def extract_minutes(value: str) -> int:
    return parse_clock(value[11:16])


def extract_offset(value: str) -> str:
    if value.endswith("Z"):
        return "Z"
    return value[-6:]


def build_iso(date_key: str, minutes: int, offset: str) -> str:
    return f"{date_key}T{format_clock(minutes)}:00{offset}"


def parse_date_key(date_key: str) -> Tuple[int, int, int]:
    year, month, day = date_key.split("-")
    return int(year), int(month), int(day)


def add_days(date_key: str, day_count: int) -> str:
    year, month, day = parse_date_key(date_key)
    from datetime import date, timedelta

    return (date(year, month, day) + timedelta(days=day_count)).isoformat()


def date_diff(start_date_key: str, end_date_key: str) -> int:
    year_a, month_a, day_a = parse_date_key(start_date_key)
    year_b, month_b, day_b = parse_date_key(end_date_key)
    from datetime import date

    return max(0, (date(year_b, month_b, day_b) - date(year_a, month_a, day_a)).days)


def list_date_keys(start_date_key: str, end_date_key: str) -> list[str]:
    return [add_days(start_date_key, index) for index in range(date_diff(start_date_key, end_date_key) + 1)]


def get_daily_window(start_value: str, end_value: str, target_date: str) -> Optional[Tuple[int, int]]:
    start_date = extract_date(start_value)
    end_date = extract_date(end_value)
    if target_date < start_date or target_date > end_date:
        return None

    start_minutes = extract_minutes(start_value)
    end_minutes = extract_minutes(end_value)

    if start_date == end_date:
        if end_minutes <= start_minutes:
            return None
        return start_minutes, end_minutes

    if target_date == start_date:
        return start_minutes, 24 * 60
    if target_date == end_date:
        return 0, end_minutes
    return 0, 24 * 60


def blocked_intervals(request: OptimizerRequest, target_date: str) -> list[Tuple[int, int]]:
    blocked: list[Tuple[int, int]] = []
    for task in request.existing_tasks:
        window = get_daily_window(task.start, task.end, target_date)
        if window:
            blocked.append(window)
    for event in request.calendar_events:
        if not event.hard_block:
            continue
        window = get_daily_window(event.start, event.end, target_date)
        if window:
            blocked.append(window)

    blocked.sort(key=lambda interval: interval[0])
    merged: list[Tuple[int, int]] = []
    for start, end in blocked:
        if not merged or start > merged[-1][1]:
            merged.append((start, end))
            continue
        merged[-1] = (merged[-1][0], max(merged[-1][1], end))
    return merged


def build_free_windows(request: OptimizerRequest, target_date: str) -> list[Tuple[int, int]]:
    wake = parse_clock(request.planner_memory.wake_time or "08:00")
    wind_down = parse_clock(request.planner_memory.wind_down_time or "21:00")
    step = request.constraints.slot_granularity_min
    blocked = blocked_intervals(request, target_date)
    free: list[Tuple[int, int]] = []
    cursor = wake

    for block_start, block_end in blocked:
        start = max(wake, block_start - request.constraints.min_buffer_min)
        end = min(wind_down, block_end + request.constraints.min_buffer_min)
        if start > cursor:
            free.append((cursor, start))
        cursor = max(cursor, end)

    if cursor < wind_down:
        free.append((cursor, wind_down))

    return [
        window
        for window in free
        if window[1] - window[0] >= request.constraints.slot_granularity_min
    ]


def preferred_range(request: OptimizerRequest, task: TaskToSchedule) -> Optional[Tuple[int, int]]:
    label = task.timing_preference.label if task.timing_preference else None
    work_end = parse_clock(request.planner_memory.work_hours.end) if request.planner_memory.work_hours else 17 * 60
    if label == "morning":
        return 8 * 60, 12 * 60
    if label == "afternoon":
        return 12 * 60, 17 * 60
    if label == "evening":
        return 17 * 60, 21 * 60
    if label == "tonight":
        return 18 * 60, 22 * 60
    if label == "later":
        return max(extract_minutes(request.current_datetime), work_end), 22 * 60
    if label == "after_work":
        return work_end, 22 * 60
    return None


def energy_window(request: OptimizerRequest, task: TaskToSchedule) -> Optional[Tuple[int, int]]:
    windows: list[str] = []
    if task.energy_type == "physical":
        windows = request.planner_memory.preferred_workout_windows
    elif task.energy_type == "deep":
        windows = request.planner_memory.preferred_deep_work_windows
    if not windows:
        return None
    start, end = windows[0].split("-")
    return parse_clock(start), parse_clock(end)


def suggested_windows(request: OptimizerRequest, target_date: str) -> list[Tuple[int, int]]:
    windows: list[Tuple[int, int]] = []
    for slot in request.constraints.suggested_slots:
        if slot.date != target_date:
            continue
        start = parse_clock(slot.time)
        end = parse_clock(slot.end_time)
        if end > start:
            windows.append((start, end))
    return windows


def adjusted_duration(request: OptimizerRequest, task: TaskToSchedule) -> int:
    if task.confidence >= 0.6:
        return task.duration_min
    return max(request.constraints.slot_granularity_min, round(task.duration_min * 0.75))


def build_candidate_starts(
    request: OptimizerRequest,
    target_date: str,
    free_windows: list[Tuple[int, int]],
    task: TaskToSchedule,
    duration: int,
) -> list[int]:
    step = request.constraints.slot_granularity_min
    preferred = preferred_range(request, task)
    aligned = energy_window(request, task)
    starts: set[int] = set()

    explicit_start = (
        extract_minutes(task.timing_preference.earliest_start)
        if task.timing_preference and task.timing_preference.earliest_start
        else None
    )
    explicit_date = (
        extract_date(task.timing_preference.earliest_start)
        if task.timing_preference and task.timing_preference.earliest_start
        else None
    )

    for window_start, window_end in free_windows:
        aligned_window_start = ((window_start + step - 1) // step) * step
        minute = aligned_window_start
        while minute + duration <= window_end:
            starts.add(minute)
            minute += step

        starts.add(window_start)
        starts.add(aligned_window_start)

        if preferred:
            preferred_start, preferred_end = preferred
            if preferred_start >= window_start and preferred_start + duration <= window_end:
                starts.add(preferred_start)
            preferred_end_aligned = preferred_end - duration
            if preferred_end_aligned >= window_start and preferred_end_aligned + duration <= window_end:
                starts.add(preferred_end_aligned)

        if aligned:
            aligned_start, aligned_end = aligned
            if aligned_start >= window_start and aligned_start + duration <= window_end:
                starts.add(aligned_start)
            aligned_end_aligned = aligned_end - duration
            if aligned_end_aligned >= window_start and aligned_end_aligned + duration <= window_end:
                starts.add(aligned_end_aligned)

    for slot_start, slot_end in suggested_windows(request, target_date):
        if slot_start + duration <= slot_end:
            starts.add(slot_start)

    if explicit_start is not None and explicit_date == target_date:
        starts.add(explicit_start)

    return sorted(
        minute
        for minute in starts
        if 0 <= minute and minute + duration <= 24 * 60
    )


def get_existing_scheduled_minutes(request: OptimizerRequest, target_date: str) -> int:
    total = 0
    for task in request.existing_tasks:
        window = get_daily_window(task.start, task.end, target_date)
        if not window:
            continue
        total += window[1] - window[0]
    return total


def get_existing_deep_blocks(request: OptimizerRequest, target_date: str) -> int:
    count = 0
    for task in request.existing_tasks:
        if task.energy_type != "deep":
            continue
        window = get_daily_window(task.start, task.end, target_date)
        if not window:
            continue
        count += 1
    return count


def overlaps_window(start: int, end: int, window: Optional[Tuple[int, int]]) -> bool:
    return bool(window) and start >= window[0] and end <= window[1]


def conflicting_titles(request: OptimizerRequest, target_date: str, start: int, end: int) -> list[str]:
    conflicts: list[str] = []
    for event in request.calendar_events:
        if not event.hard_block:
            continue
        window = get_daily_window(event.start, event.end, target_date)
        if not window:
            continue
        if start < window[1] and end > window[0]:
            conflicts.append(event.title or "calendar event")
    return conflicts


def score_candidate(
    request: OptimizerRequest,
    task: TaskToSchedule,
    target_date: str,
    day_index: int,
    start: int,
    duration: int,
    free_windows: list[Tuple[int, int]],
) -> SlotCandidate:
    policy = load_policy()
    end = start + duration
    score = policy["base_score"]
    reason_codes = ["avoids_calendar_conflict", "sufficient_duration"]
    soft_conflicts: list[str] = []
    preferred = preferred_range(request, task)
    aligned = energy_window(request, task)
    daily_limit = request.constraints.max_scheduled_minutes_per_day
    deep_limit = request.constraints.max_deep_work_blocks_per_day
    existing_minutes = get_existing_scheduled_minutes(request, target_date)
    existing_deep_blocks = get_existing_deep_blocks(request, target_date)
    wind_down = parse_clock(request.planner_memory.wind_down_time or "21:00")
    step = request.constraints.slot_granularity_min

    if overlaps_window(start, end, preferred):
        score += policy["preferred_window_bonus"]
        if task.timing_preference and task.timing_preference.label:
            reason_codes.append(f"{task.timing_preference.label}_window")
    elif preferred:
        score += policy["outside_window_penalty"]
        soft_conflicts.append("outside_preferred_window")

    if task.energy_type == "physical":
        score += policy["physical_bonus"]
        reason_codes.append("matches_physical_energy")
    elif task.energy_type == "deep":
        score += policy["deep_work_bonus"]
        reason_codes.append("matches_deep_work_energy")

    if daily_limit is not None:
        if existing_minutes + duration <= daily_limit:
            score += policy["daily_load_bonus"]
            reason_codes.append("respects_daily_load_cap")
        else:
            score += policy["daily_load_penalty"]
            soft_conflicts.append("daily_load_cap_pressure")

    if deep_limit is not None and task.energy_type == "deep":
        if existing_deep_blocks >= deep_limit:
            score += policy["deep_block_penalty"]
            soft_conflicts.append("deep_work_block_limit")
        else:
            reason_codes.append("deep_work_block_available")

    if overlaps_window(start, end, aligned):
        score += policy["energy_match_bonus"]
        reason_codes.append("matches_energy_window")
    elif aligned:
        score += policy["missed_energy_penalty"]
        soft_conflicts.append("misses_energy_window")

    containing_window = next(
        (window for window in free_windows if start >= window[0] and end <= window[1]),
        None,
    )
    if containing_window:
        gap_before = start - containing_window[0]
        gap_after = containing_window[1] - end
        if (0 < gap_before < 20) or (0 < gap_after < 20):
            score += policy["fragmentation_penalty"]
            soft_conflicts.append("fragmented_slot")
        else:
            reason_codes.append("minimizes_fragmentation")

    if start >= 19 * 60:
        score += policy["late_day_penalty"]
        soft_conflicts.append("late_day_pressure")
    else:
        reason_codes.append("minimizes_late_day_overload")

    if any(overlaps_window(start, end, slot) for slot in suggested_windows(request, target_date)):
        score += policy["suggested_slot_bonus"]
        reason_codes.append("suggested_slot_bias")

    if clamp_priority(task.priority) >= 4 and day_index == 0:
        reason_codes.append("high_priority_fit")

    score -= day_index * policy["day_index_penalty"]
    score -= round((task.confidence - get_effective_confidence(task.confidence, day_index)) * 20)
    score += round(((wind_down - start) / step) * policy["early_bias_multiplier"])

    status = get_draft_status(score, request.scheduling_mode)
    reason_summary = build_reason_summary(status, reason_codes, soft_conflicts)

    return SlotCandidate(
        task_id=task.id,
        title=task.title,
        date_key=target_date,
        day_index=day_index,
        start_bucket=start // step,
        end_bucket=end // step,
        absolute_start_bucket=((day_index * 24 * 60) + start) // step,
        absolute_end_bucket=((day_index * 24 * 60) + end) // step,
        score=score,
        reason_codes=reason_codes,
        soft_conflicts=soft_conflicts,
        hard_conflict=False,
        reason_summary=reason_summary,
    )


def explicit_candidate(
    request: OptimizerRequest,
    task: TaskToSchedule,
    target_date: str,
    day_index: int,
) -> Optional[SlotCandidate]:
    if not task.timing_preference or not task.timing_preference.earliest_start or not task.timing_preference.latest_end:
        return None
    if extract_date(task.timing_preference.earliest_start) != target_date:
        return None

    start = extract_minutes(task.timing_preference.earliest_start)
    end = extract_minutes(task.timing_preference.latest_end)
    if end <= start:
        return None

    policy = load_policy()
    conflicts = conflicting_titles(request, target_date, start, end)
    score = (
        policy["scheduled_threshold"] + 14
        if not conflicts
        else policy["tentative_threshold_aggressive"] - 2
    ) - (day_index * policy["day_index_penalty"])
    status: Literal["scheduled_draft", "tentative_time"] = (
        "scheduled_draft" if not conflicts else "tentative_time"
    )
    reason_codes = [
        "respects_user_requested_time",
        "explicit_time_request",
        *([] if conflicts else ["avoids_calendar_conflict"]),
    ]
    soft_conflicts = ["calendar_conflict"] if conflicts else []
    step = request.constraints.slot_granularity_min

    return SlotCandidate(
        task_id=task.id,
        title=task.title,
        date_key=target_date,
        day_index=day_index,
        start_bucket=start // step,
        end_bucket=end // step,
        absolute_start_bucket=((day_index * 24 * 60) + start) // step,
        absolute_end_bucket=((day_index * 24 * 60) + end) // step,
        score=score,
        reason_codes=reason_codes,
        soft_conflicts=soft_conflicts,
        hard_conflict=bool(conflicts),
        reason_summary=build_reason_summary(status, reason_codes, soft_conflicts),
    )


@app.post("/optimize", response_model=OptimizerResponse)
def optimize_schedule(request: OptimizerRequest) -> OptimizerResponse:
    posthog_client.capture(
        distinct_id="planner_optimizer_service",
        event="schedule_optimization_requested",
        properties={
            "scheduling_mode": request.scheduling_mode,
            "tasks_to_schedule_count": len(request.tasks_to_schedule),
            "existing_tasks_count": len(request.existing_tasks),
            "calendar_events_count": len(request.calendar_events),
            "planning_window_days": date_diff(
                request.planning_window.start_date, request.planning_window.end_date
            ) + 1,
        },
    )

    if not request.tasks_to_schedule:
        return OptimizerResponse(drafts=[], unscheduled=[])

    date_keys = list_date_keys(
        request.planning_window.start_date,
        request.planning_window.end_date,
    )
    step = request.constraints.slot_granularity_min
    offset = extract_offset(request.current_datetime)
    model = cp_model.CpModel()
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 2.0

    assignment_vars: dict[str, list[tuple[cp_model.IntVar, SlotCandidate]]] = {}
    unscheduled_vars: dict[str, cp_model.IntVar] = {}
    interval_vars: list[cp_model.IntervalVar] = []
    daily_minutes_terms: dict[str, list[tuple[cp_model.IntVar, int]]] = {date_key: [] for date_key in date_keys}
    daily_deep_terms: dict[str, list[cp_model.IntVar]] = {date_key: [] for date_key in date_keys}

    for task in request.tasks_to_schedule:
        duration = adjusted_duration(request, task)
        has_explicit_time_pin = bool(
            task.timing_preference
            and task.timing_preference.earliest_start
            and task.timing_preference.latest_end
        )
        task_candidates: list[SlotCandidate] = []

        for day_index, date_key in enumerate(date_keys):
            explicit = explicit_candidate(request, task, date_key, day_index)
            if explicit:
                task_candidates.append(explicit)
                continue
            if has_explicit_time_pin:
                continue

            free = build_free_windows(request, date_key)
            if not free:
                continue

            for start in build_candidate_starts(request, date_key, free, task, duration):
                end = start + duration
                if not any(start >= window[0] and end <= window[1] for window in free):
                    continue
                task_candidates.append(
                    score_candidate(request, task, date_key, day_index, start, duration, free)
                )

        task_assignments: list[tuple[cp_model.IntVar, SlotCandidate]] = []
        for index, candidate in enumerate(task_candidates):
            is_selected = model.NewBoolVar(f"{task.id}_candidate_{index}")
            interval = model.NewOptionalIntervalVar(
                candidate.absolute_start_bucket,
                candidate.absolute_end_bucket - candidate.absolute_start_bucket,
                candidate.absolute_end_bucket,
                is_selected,
                f"{task.id}_interval_{index}",
            )
            interval_vars.append(interval)
            task_assignments.append((is_selected, candidate))
            daily_minutes_terms[candidate.date_key].append(
                (is_selected, candidate.absolute_end_bucket - candidate.absolute_start_bucket)
            )
            if task.energy_type == "deep":
                daily_deep_terms[candidate.date_key].append(is_selected)

        unscheduled = model.NewBoolVar(f"{task.id}_unscheduled")
        unscheduled_vars[task.id] = unscheduled
        model.AddExactlyOne([var for var, _ in task_assignments] + [unscheduled])
        assignment_vars[task.id] = task_assignments

    if interval_vars:
        model.AddNoOverlap(interval_vars)

    if request.constraints.max_scheduled_minutes_per_day is not None:
        limit_buckets = request.constraints.max_scheduled_minutes_per_day // step
        for date_key, terms in daily_minutes_terms.items():
            if not terms:
                continue
            model.Add(sum(var * duration for var, duration in terms) <= limit_buckets)

    if request.constraints.max_deep_work_blocks_per_day is not None:
        for date_key, terms in daily_deep_terms.items():
            if not terms:
                continue
            model.Add(sum(terms) <= request.constraints.max_deep_work_blocks_per_day)

    objective_terms: list[cp_model.LinearExpr] = []
    for task in request.tasks_to_schedule:
        for var, candidate in assignment_vars[task.id]:
            objective_terms.append(var * candidate.score)
        objective_terms.append(
            unscheduled_vars[task.id]
            * get_unscheduled_penalty(clamp_priority(task.priority), task.confidence)
        )

    if objective_terms:
        model.Maximize(sum(objective_terms))

    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        posthog_client.capture(
            distinct_id="planner_optimizer_service",
            event="schedule_optimization_failed",
            properties={
                "scheduling_mode": request.scheduling_mode,
                "tasks_to_schedule_count": len(request.tasks_to_schedule),
                "solver_status": status,
            },
        )
        raise HTTPException(status_code=503, detail="optimizer did not find a feasible solution")

    drafts: list[DraftResponse] = []
    unscheduled_tasks: list[UnscheduledResponse] = []

    for task in request.tasks_to_schedule:
        selected_candidate: Optional[SlotCandidate] = None
        for var, candidate in assignment_vars[task.id]:
            if solver.Value(var):
                selected_candidate = candidate
                break

        if selected_candidate is None:
            posthog_client.capture(
                distinct_id="planner_optimizer_service",
                event="task_fallback_to_inbox",
                properties={
                    "scheduling_mode": request.scheduling_mode,
                    "reason_codes": ["needs_manual_scheduling"],
                    "cause": "no_safe_slot_found",
                },
            )
            draft = DraftResponse(
                task_id=task.id,
                title=task.title,
                status="needs_scheduling",
                slot_score=0,
                hard_conflict=False,
                soft_conflicts=["no_safe_slot_found"],
                reason_codes=["needs_manual_scheduling"],
                reason_summary=build_reason_summary(
                    "needs_scheduling",
                    ["needs_manual_scheduling"],
                    ["no_safe_slot_found"],
                ),
                fallback_to_inbox=True,
            )
            drafts.append(draft)
            unscheduled_tasks.append(
                UnscheduledResponse(
                    task_id=task.id,
                    title=task.title,
                    reason_codes=draft.reason_codes,
                )
            )
            continue

        draft_status = get_draft_status(selected_candidate.score, request.scheduling_mode)
        fallback_to_inbox = draft_status == "needs_scheduling"
        start_min = selected_candidate.start_bucket * step
        end_min = selected_candidate.end_bucket * step
        drafts.append(
            DraftResponse(
                task_id=task.id,
                title=task.title,
                start=build_iso(selected_candidate.date_key, start_min, offset) if not fallback_to_inbox else None,
                end=build_iso(selected_candidate.date_key, end_min, offset) if not fallback_to_inbox else None,
                status=draft_status,
                slot_score=selected_candidate.score,
                hard_conflict=selected_candidate.hard_conflict,
                soft_conflicts=selected_candidate.soft_conflicts,
                reason_codes=selected_candidate.reason_codes,
                reason_summary=selected_candidate.reason_summary,
                fallback_to_inbox=fallback_to_inbox,
            )
        )
        if fallback_to_inbox:
            posthog_client.capture(
                distinct_id="planner_optimizer_service",
                event="task_fallback_to_inbox",
                properties={
                    "scheduling_mode": request.scheduling_mode,
                    "reason_codes": selected_candidate.reason_codes,
                    "cause": "low_slot_score",
                },
            )
            unscheduled_tasks.append(
                UnscheduledResponse(
                    task_id=task.id,
                    title=task.title,
                    reason_codes=selected_candidate.reason_codes,
                )
            )

    scheduled_count = sum(1 for d in drafts if not d.fallback_to_inbox)
    posthog_client.capture(
        distinct_id="planner_optimizer_service",
        event="schedule_optimization_succeeded",
        properties={
            "scheduling_mode": request.scheduling_mode,
            "tasks_requested_count": len(request.tasks_to_schedule),
            "scheduled_count": scheduled_count,
            "unscheduled_count": len(unscheduled_tasks),
            "fallback_to_inbox_count": sum(1 for d in drafts if d.fallback_to_inbox),
        },
    )

    return OptimizerResponse(
        drafts=drafts,
        unscheduled=unscheduled_tasks,
    )
