<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of the **Planner Optimizer Service** FastAPI microservice (`services/planner_optimizer_service/`). The service already had a robust PostHog foundation (SDK initialized via `Posthog()` constructor, `atexit` shutdown hook, lifespan flush, and four event capture calls covering the full optimization lifecycle). The wizard verified environment variables, confirmed the `posthog>=3.0.0` dependency in `requirements.txt`, wrote the correct PostHog token and host to the service's `.env` file, and added one supplemental event that closed a genuine observability gap.

## Events instrumented

| Event name | Description | File |
|---|---|---|
| `schedule_optimization_requested` | Fires at the start of every `/optimize` call with scheduling mode, task counts, and planning window length. | `services/planner_optimizer_service/app.py` |
| `schedule_optimization_succeeded` | Fires when the CP-SAT solver returns a feasible solution, with scheduled/unscheduled/fallback counts. | `services/planner_optimizer_service/app.py` |
| `schedule_optimization_failed` | Fires when the CP-SAT solver cannot find any feasible solution within the 2-second timeout. | `services/planner_optimizer_service/app.py` |
| `task_fallback_to_inbox` | Fires for each individual task that ends up unscheduled, with the cause (`no_safe_slot_found` or `low_slot_score`). | `services/planner_optimizer_service/app.py` |
| `task_no_slot_candidates` ✨ new | Fires when a task yields **zero** slot candidates before CP-SAT runs — indicating a fully blocked or over-constrained scheduling window. Distinguishes this case from solver-rejected tasks. | `services/planner_optimizer_service/app.py` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/411659/dashboard/1551481
- **Schedule Optimization Requests (Daily):** https://us.posthog.com/project/411659/insights/fZfH1J29
- **Optimization Funnel: Requested → Succeeded vs Failed:** https://us.posthog.com/project/411659/insights/nwlHumfr
- **Task Fallback to Inbox Rate (Daily):** https://us.posthog.com/project/411659/insights/zCkJew6e
- **Tasks with No Slot Candidates:** https://us.posthog.com/project/411659/insights/mj3JnUj3
- **Scheduled vs Unscheduled Tasks per Run:** https://us.posthog.com/project/411659/insights/KNLP9DSy

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
