# Database State Report

**Last Updated:** 2026-02-12
**Status:** Backend ownership migrated to self-managed hosted Supabase workflow

## Current Source of Truth

- Supabase linkage file: `supabase/config.toml`
- Runtime frontend env template: `.env.example`
- Function deployment allow-list: `supabase/function-manifest.json`
- CI deployment workflow: `.github/workflows/supabase-deploy.yml`

## Required Cutover Inputs

Before deployment, set real values for:

- `supabase/config.toml` -> `project_id`
- `.env` -> `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- GitHub secrets -> `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`

## Scheduling Ownership

Legacy DB cron scheduling has been removed from runtime ownership.

- Historical migration: `supabase/migrations/20251127174517_49eb8abb-f580-4245-958c-ded03fd9168c.sql`
- Cleanup migration: `supabase/migrations/20260212090000_remove_legacy_hardcoded_cron_jobs.sql`
- Active scheduler: `.github/workflows/scheduled-functions.yml`

Scheduled functions:

- `generate-daily-mentor-pep-talks`
- `schedule-daily-mentor-pushes`
- `dispatch-daily-pushes`
