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
- Before shipping frontend/mobile clients that call new RPCs, verify the target project has the corresponding migration applied and that PostgREST can resolve the function signature from schema cache.
- For mission completion specifically, confirm `public.complete_daily_mission_with_xp(uuid, text, integer)` exists and is executable by `authenticated` before releasing clients that depend on it.
- Deploy frontend with production `VITE_SUPABASE_*` values.

## 3) Rollback window

- Keep previous Supabase project active for 14 days.
- Disable writes from clients by rotating publishable key in the old project.
- Keep read access for diagnostics only.

## 4) Final decommission

- Remove legacy project secrets and access tokens.
- Delete unused scheduled infrastructure from old project.
- Archive old project logs and compliance exports.
