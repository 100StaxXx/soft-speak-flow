# Planner Optimizer Service

This service hosts the Python OR-Tools scheduler used by the companion planner when
`PLANNER_OPTIMIZER_ENABLED=true`.

## Local setup

From the repo root:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/planner_optimizer_service/requirements.txt
```

## Run locally

From the repo root:

```bash
npm run planner:optimizer:dev
```

That starts the service at `http://127.0.0.1:8010/optimize`.

## Environment wiring

Point the planner backend at the local service:

```bash
export PLANNER_OPTIMIZER_ENABLED=true
export PLANNER_OPTIMIZER_URL=http://127.0.0.1:8010/optimize
```

Optional shared secret:

```bash
export PLANNER_OPTIMIZER_SECRET=replace-with-a-shared-secret
```

## Smoke test

Use the included sample request:

```bash
curl -sS http://127.0.0.1:8010/optimize \
  -H 'Content-Type: application/json' \
  --data @services/planner_optimizer_service/sample_request.json
```

## Test

```bash
npm run planner:optimizer:test
```

## Rollout Smoke

With the optimizer service already running, exercise the flagged remote-optimizer
planner path locally:

```bash
deno test --allow-net=127.0.0.1 supabase/functions/companion-planner-chat/rollout.smoke.ts
```

That smoke covers:

- easy same-day bundle scheduling
- crowded-day spillover into tomorrow
- explicit-date pinning with conflict callout
