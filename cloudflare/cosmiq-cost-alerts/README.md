# Cosmiq cost alert receiver

This Cloudflare Worker is the production receiver for application cost-guardrail
webhooks. It acknowledges an alert only after storing a sanitized record in the
bound KV namespace. Stored records expire after 30 days.

## Routes

- `GET /health` — public liveness check.
- `POST /v1/cost-alert` — authenticated ingestion using
  `ALERT_INGEST_TOKEN`.
- `GET /alerts/<ALERT_VIEW_TOKEN>` — private server-rendered inbox.
- `GET /alerts/<ALERT_VIEW_TOKEN>.json` — private operational JSON view.
- `GET /v1/alerts` — private JSON view using either a bearer token or
  `X-Cosmiq-Alert-View-Token`.

The view credential is a secret. Never commit, log, or put it in public support
material.

## Data handling

The receiver discards arbitrary metadata and redacts UUIDs, email addresses,
and URLs before durable storage or push delivery. ntfy is optional and
best-effort; a relay failure is recorded on the stored alert and does not cause
the webhook to fail after KV persistence succeeds.

## Verification

```sh
node --test src/index.test.mjs
npx wrangler deploy --dry-run
```

Production deployment additionally requires the `ALERT_INGEST_TOKEN` and
`ALERT_VIEW_TOKEN` Worker secrets and the `ALERTS` KV binding in
`wrangler.toml`. Keep the matching Supabase values in
`COST_ALERT_WEBHOOK_URL` and `COST_ALERT_WEBHOOK_BEARER_TOKEN`.
