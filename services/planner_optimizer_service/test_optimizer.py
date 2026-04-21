from __future__ import annotations

import json
import unittest
from pathlib import Path
from typing import Optional

from fastapi.testclient import TestClient


try:
    from services.planner_optimizer_service.app import (
        CalendarEvent,
        Constraints,
        ExistingTask,
        OptimizerRequest,
        PlannerMemory,
        PlanningWindow,
        TaskToSchedule,
        TimingPreference,
        WorkHours,
        app,
        get_existing_deep_blocks,
        optimize_schedule,
    )
    IMPORT_ERROR: Optional[Exception] = None
except Exception as exc:  # pragma: no cover - dependency-gated
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"planner optimizer dependencies unavailable: {IMPORT_ERROR}")
class PlannerOptimizerServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def base_request(self) -> OptimizerRequest:
        return OptimizerRequest(
            current_datetime="2026-04-20T15:50:00-07:00",
            timezone="America/Los_Angeles",
            planning_window=PlanningWindow(
                start_date="2026-04-20",
                end_date="2026-04-20",
            ),
            scheduling_mode="aggressive",
            tasks_to_schedule=[
                TaskToSchedule(
                    id="task-1",
                    title="Workout",
                    duration_min=45,
                    timing_preference=TimingPreference(label="after_work"),
                    energy_type="physical",
                    priority=5,
                    confidence=0.9,
                    derived_from_message="workout later",
                )
            ],
            existing_tasks=[],
            calendar_events=[],
            habits=[],
            planner_memory=PlannerMemory(
                wake_time="07:00",
                wind_down_time="22:00",
                work_hours=WorkHours(start="09:00", end="17:00"),
                preferred_workout_windows=["17:30-19:00"],
                preferred_deep_work_windows=["09:00-11:00"],
            ),
            constraints=Constraints(
                slot_granularity_min=15,
                min_buffer_min=15,
                max_scheduled_minutes_per_day=180,
                max_deep_work_blocks_per_day=2,
                suggested_slots=[],
            ),
        )

    def test_every_task_resolves_to_one_outcome(self) -> None:
        response = optimize_schedule(self.base_request())
        self.assertEqual(len(response.drafts), 1)
        self.assertEqual(response.drafts[0].status, "scheduled_draft")
        self.assertEqual(len(response.unscheduled), 0)

    def test_crowded_day_degrades_to_needs_scheduling(self) -> None:
        request = self.base_request()
        request.tasks_to_schedule = [
            TaskToSchedule(
                id="task-1",
                title="Deep Work",
                duration_min=120,
                timing_preference=TimingPreference(label="after_work"),
                energy_type="deep",
                priority=5,
                confidence=0.88,
                derived_from_message="work on the app later",
            )
        ]
        request.constraints.max_scheduled_minutes_per_day = 60
        request.constraints.max_deep_work_blocks_per_day = 1
        request.calendar_events = [
            CalendarEvent(
                id="event-1",
                title="Dinner",
                start="2026-04-20T17:30:00-07:00",
                end="2026-04-20T19:30:00-07:00",
                source="google",
                hard_block=True,
            )
        ]

        response = optimize_schedule(request)
        self.assertEqual(len(response.drafts), 1)
        self.assertEqual(response.drafts[0].status, "needs_scheduling")
        self.assertTrue(response.drafts[0].fallback_to_inbox)
        self.assertEqual(len(response.unscheduled), 1)

    def test_get_existing_deep_blocks_counts_overlapping_deep_work(self) -> None:
        request = self.base_request()
        request.existing_tasks = [
            ExistingTask(
                id="deep-1",
                start="2026-04-20T09:00:00-07:00",
                end="2026-04-20T10:00:00-07:00",
                energy_type="deep",
                status="active",
            ),
            ExistingTask(
                id="admin-1",
                start="2026-04-20T11:00:00-07:00",
                end="2026-04-20T11:30:00-07:00",
                energy_type="admin",
                status="active",
            ),
        ]

        self.assertEqual(get_existing_deep_blocks(request, "2026-04-20"), 1)
        self.assertEqual(get_existing_deep_blocks(request, "2026-04-21"), 0)

    def test_existing_deep_work_adds_deep_block_pressure_to_new_deep_task(self) -> None:
        request = self.base_request()
        request.tasks_to_schedule = [
            TaskToSchedule(
                id="task-1",
                title="Work On The App",
                duration_min=45,
                timing_preference=TimingPreference(label="after_work"),
                energy_type="deep",
                priority=5,
                confidence=0.88,
                derived_from_message="work on the app later",
            )
        ]
        request.existing_tasks = [
            ExistingTask(
                id="deep-1",
                start="2026-04-20T09:00:00-07:00",
                end="2026-04-20T10:00:00-07:00",
                energy_type="deep",
                status="active",
            )
        ]
        request.constraints.max_deep_work_blocks_per_day = 1

        response = optimize_schedule(request)

        self.assertEqual(len(response.drafts), 1)
        self.assertIn("deep_work_block_limit", response.drafts[0].soft_conflicts)
        self.assertNotIn("deep_work_block_available", response.drafts[0].reason_codes)

    def test_http_optimize_returns_three_drafts_with_spillover(self) -> None:
        sample_path = Path(__file__).with_name("sample_request.json")
        payload = json.loads(sample_path.read_text(encoding="utf-8"))

        response = self.client.post("/optimize", json=payload)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["drafts"]), 3)
        self.assertEqual(len(body["unscheduled"]), 0)
        self.assertEqual(
            {draft["task_id"] for draft in body["drafts"]},
            {"clean-house", "work-app", "workout"},
        )
        self.assertTrue(
            any(
                isinstance(draft.get("start"), str) and
                draft["start"].startswith("2026-04-21")
                for draft in body["drafts"]
            )
        )
        self.assertTrue(
            all(
                isinstance(draft.get("reason_summary"), str) and
                len(draft["reason_summary"].strip()) > 0
                for draft in body["drafts"]
            )
        )

    def test_http_optimize_keeps_explicit_date_pinned(self) -> None:
        payload = {
            "current_datetime": "2026-04-20T15:50:00-07:00",
            "timezone": "America/Los_Angeles",
            "scheduling_mode": "aggressive",
            "planning_window": {
                "start_date": "2026-04-20",
                "end_date": "2026-04-24",
            },
            "tasks_to_schedule": [
                {
                    "id": "task-1",
                    "title": "Workout",
                    "duration_min": 45,
                    "timing_preference": {
                        "label": "after_work",
                        "earliest_start": "2026-04-23T18:00:00-07:00",
                        "latest_end": "2026-04-23T18:45:00-07:00",
                    },
                    "energy_type": "physical",
                    "priority": 4,
                    "confidence": 0.9,
                    "derived_from_message": "workout thursday at 6",
                }
            ],
            "existing_tasks": [],
            "calendar_events": [],
            "habits": [],
            "planner_memory": {
                "wake_time": "07:00",
                "wind_down_time": "22:00",
                "work_hours": {
                    "start": "09:00",
                    "end": "17:00",
                },
                "preferred_workout_windows": ["17:30-19:00"],
                "preferred_deep_work_windows": ["09:00-11:00"],
            },
            "constraints": {
                "slot_granularity_min": 15,
                "min_buffer_min": 15,
                "max_scheduled_minutes_per_day": 180,
                "max_deep_work_blocks_per_day": 2,
                "suggested_slots": [],
            },
        }

        response = self.client.post("/optimize", json=payload)

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["drafts"]), 1)
        self.assertEqual(body["drafts"][0]["start"][:10], "2026-04-23")
        self.assertEqual(body["drafts"][0]["start"][11:16], "18:00")
        self.assertEqual(
            body["drafts"][0]["reason_summary"],
            "Scheduled at the time you asked for. Fits around your calendar without conflicts. and keeps this moving today.",
        )


if __name__ == "__main__":
    unittest.main()
