<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of the **Planner Optimizer Service** (`services/planner_optimizer_service/`) with PostHog analytics.

## Summary of changes

- **`services/planner_optimizer_service/app.py`** — Added PostHog SDK initialization using the `Posthog()` instance-based constructor with `enable_exception_autocapture=True`. A FastAPI `lifespan` context manager flushes events on shutdown, and `atexit.register(posthog_client.shutdown)` ensures events are never lost on process exit. Four analytics events are captured in the `POST /optimize` endpoint, tracking the full lifecycle of a schedule optimization request.

- **`services/planner_optimizer_service/requirements.txt`** — Added `posthog>=3.0.0` and `python-dotenv>=1.0.0` as dependencies.

- **`services/planner_optimizer_service/.env`** — Created with `POSTHOG_API_KEY` and `POSTHOG_HOST` environment variables (covered by `.gitignore`).

## Events instrumented

| Event | Description | File |
|---|---|---|
| `schedule_optimization_requested` | Fired when a planner optimizer request is received — tracks `scheduling_mode`, task count, existing task count, calendar event count, and planning window length | `services/planner_optimizer_service/app.py` |
| `schedule_optimization_succeeded` | Fired when the optimizer solver returns a feasible result — tracks `scheduled_count`, `unscheduled_count`, `fallback_to_inbox_count`, and `scheduling_mode` | `services/planner_optimizer_service/app.py` |
| `schedule_optimization_failed` | Fired when the CP-SAT solver cannot find a feasible solution (503 error) — tracks `scheduling_mode`, task count, and raw solver status code | `services/planner_optimizer_service/app.py` |
| `task_fallback_to_inbox` | Fired per task that falls back to inbox — captures `reason_codes` and `cause` (`no_safe_slot_found` or `low_slot_score`) | `services/planner_optimizer_service/app.py` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/411659/dashboard/1549681
- **Optimization Requests Over Time**: https://us.posthog.com/project/411659/insights/RtUwV7tS
- **Optimization Success vs Failure Funnel**: https://us.posthog.com/project/411659/insights/RVRGYVSZ
- **Schedule Optimization Failures Over Time**: https://us.posthog.com/project/411659/insights/XurTkvMx
- **Task Inbox Fallbacks Over Time**: https://us.posthog.com/project/411659/insights/ajTYzpm4
- **Scheduled vs Unscheduled Tasks by Mode**: https://us.posthog.com/project/411659/insights/YJO5Tyvg

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
