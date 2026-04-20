from __future__ import annotations

import unittest


try:
    from services.planner_optimizer_service.app import (
        CalendarEvent,
        Constraints,
        OptimizerRequest,
        PlannerMemory,
        PlanningWindow,
        TaskToSchedule,
        TimingPreference,
        WorkHours,
        optimize_schedule,
    )
    IMPORT_ERROR: Exception | None = None
except Exception as exc:  # pragma: no cover - dependency-gated
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"planner optimizer dependencies unavailable: {IMPORT_ERROR}")
class PlannerOptimizerServiceTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
