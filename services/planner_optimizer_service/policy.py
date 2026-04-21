from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional, TypedDict


class PlannerScoringPolicy(TypedDict):
    base_score: int
    preferred_window_bonus: int
    energy_match_bonus: int
    physical_bonus: int
    deep_work_bonus: int
    daily_load_bonus: int
    daily_load_penalty: int
    fragmentation_penalty: int
    late_day_penalty: int
    outside_window_penalty: int
    missed_energy_penalty: int
    deep_block_penalty: int
    suggested_slot_bonus: int
    unscheduled_penalty_base: int
    early_bias_multiplier: float
    day_index_penalty: int
    confidence_decay_per_day: float
    confidence_floor: float
    scheduled_threshold: int
    tentative_threshold_aggressive: int
    tentative_threshold_default: int


PlannerDraftStatus = Literal["scheduled_draft", "needs_scheduling", "tentative_time"]


@lru_cache(maxsize=1)
def load_policy() -> PlannerScoringPolicy:
    policy_path = Path(__file__).resolve().parents[2] / "src/shared/plannerScoringPolicy.json"
    with policy_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clamp_priority(value: Optional[int]) -> int:
    normalized = round(value or 1)
    return max(1, min(5, normalized))


def get_tentative_threshold(scheduling_mode: str) -> int:
    policy = load_policy()
    return (
        policy["tentative_threshold_aggressive"]
        if scheduling_mode == "aggressive"
        else policy["tentative_threshold_default"]
    )


def get_draft_status(score: int, scheduling_mode: str) -> PlannerDraftStatus:
    policy = load_policy()
    if score >= policy["scheduled_threshold"]:
        return "scheduled_draft"
    if score >= get_tentative_threshold(scheduling_mode):
        return "tentative_time"
    return "needs_scheduling"


def get_effective_confidence(confidence: float, day_index: int) -> float:
    policy = load_policy()
    return max(
        policy["confidence_floor"],
        confidence - (day_index * policy["confidence_decay_per_day"]),
    )


def get_unscheduled_penalty(priority: int, confidence: float, day_index: int = 0) -> int:
    policy = load_policy()
    return round(
        policy["unscheduled_penalty_base"]
        * (1 + (priority * 0.5) + get_effective_confidence(confidence, day_index))
    )
