# Backend Cutover Checklist

## 1) Staging validation

- Set `supabase/config.toml` project id to staging project ref.
- Update `.env` to staging frontend Supabase values.
- Deploy backend via `.github/workflows/supabase-deploy.yml`.
- Run `.github/workflows/backend-smoke.yml`.
- Verify OAuth, Edge function invocations, push scheduling, and storage writes.

## 2) Production cutover

- Set production project ref/keys in `.env` and GitHub secrets.
- Run `Supabase Deploy` workflow.
- Run `Backend Smoke` workflow.
- Deploy frontend with production `VITE_SUPABASE_*` values.

## 3) Rollback window

- Keep previous Supabase project active for 14 days.
- Disable writes from clients by rotating publishable key in the old project.
- Keep read access for diagnostics only.

## 4) Final decommission

- Remove legacy project secrets and access tokens.
- Delete unused scheduled infrastructure from old project.
- Archive old project logs and compliance exports.
