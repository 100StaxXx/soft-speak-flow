# Cosmiq App

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Edge Functions, Storage)
- Capacitor (iOS native shell)

## Local development

1. Install dependencies:

```sh
npm install
```

2. Configure environment values:

```sh
cp .env.example .env.local
```

3. Set the client-visible values you need:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_NATIVE_REDIRECT_BASE`

4. Run the web app:

```sh
npm run dev
```

## Secrets and envs

- `.env.example` is the only tracked env template.
- Keep real secrets in untracked files such as `.env.local`.
- Only these vars should be exposed to frontend bundles:
  - `VITE_APP_VERSION`
  - `VITE_GOOGLE_IOS_CLIENT_ID`
  - `VITE_GOOGLE_WEB_CLIENT_ID`
  - `VITE_NATIVE_REDIRECT_BASE`
  - `VITE_SENTRY_DSN`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_URL`
- Server-only credentials must use non-`VITE_*` names.

Secret scan commands:

```sh
npm run secrets:scan
npm run hooks:install
```

More detail lives in [`docs/secrets-hardening.md`](/Users/macbookair/Developer/soft-speak-flow/docs/secrets-hardening.md).

## Backend ownership model

This repository is configured for self-managed hosted Supabase outside the previous managed platform.

- Supabase project linkage: `supabase/config.toml`
- Function allow-list: `supabase/function-manifest.json`
- Manifest generation/check:

```sh
./scripts/generate-function-manifest.sh
./scripts/check-function-manifest.sh
```

## Deployment automation

GitHub Actions workflows:

- `.github/workflows/supabase-deploy.yml`
  - checks function manifest
  - validates required Supabase secrets
  - pushes DB migrations
  - deploys allow-listed Edge Functions
- `.github/workflows/scheduled-functions.yml`
  - manual fallback for scheduled functions while primary scheduling runs via Supabase `pg_cron`
- `.github/workflows/backend-smoke.yml`
  - post-deploy backend smoke checks
- `docs/backend-cutover-checklist.md`
  - staging/production cutover and decommission sequence

Required GitHub secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `INTERNAL_FUNCTION_SECRET`

Required Supabase project secrets (minimum):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_FUNCTION_SECRET`
- `INFLUENCER_DASHBOARD_SECRET`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `COST_ALERT_WEBHOOK_URL`
- `COST_ALERT_WEBHOOK_BEARER_TOKEN`

Optional Supabase project secrets for emergency guardrails:

- `COST_KILL_SWITCH_ALL`
- `COST_KILL_SWITCH_TEXT`
- `COST_KILL_SWITCH_IMAGE`
- `COST_KILL_SWITCH_TTS`
- `COST_KILL_SWITCH_MUSIC`
- `COST_KILL_SWITCH_TRANSCRIPTION`
- `COST_KILL_SWITCH_VIDEO`
- `COST_KILL_SWITCH_ENDPOINTS`

## Cost guardrails

This repo now includes backend spend guardrails for high-cost AI and media routes:

- runtime feature flags and monthly budgets in `public.cost_guardrail_config`
- monthly state rollups in `public.cost_guardrail_state`
- per-provider-call telemetry in `public.cost_events`
- threshold/anomaly alert history in `public.cost_alert_events`
- reporting views:
  - `public.cost_driver_endpoints_daily_v`
  - `public.cost_driver_users_daily_v`
  - `public.cost_budget_status_v`

Threshold alerts emit at `50%`, `80%`, `90%`, and `100%` of the configured monthly budget. When a scope hits `100%`, the backend blocks further spend for that scope until the budget is raised or the next UTC month starts.

Manual shutdown and provider-side budget setup are documented in [`docs/cost-guardrails-runbook.md`](/Users/macbookair/Developer/soft-speak-flow/docs/cost-guardrails-runbook.md).

## iOS build troubleshooting

### Add the iOS platform

If `npx cap sync ios` reports that the iOS platform has not been added, add it once with:

```sh
npx cap add ios
```

After the platform is created, you can rerun `npx cap sync ios` to copy the latest web assets and update native dependencies.

The Capacitor iOS project includes a custom CocoaPods `post_install` hook (see `ios/App/Podfile`) that scans every downloaded `.xcframework`. If a framework ships without the plain `ios-arm64` slice that the `[CP] Copy XCFrameworks` script expects, the hook clones the closest non-simulator `ios-arm64_*` variant into place. This prevents `rsync` errors like the ones seen for `IONFilesystemLib` or `FBSDKCoreKit_Basics`.

If you still hit `[CP] Copy XCFrameworks` failures:

1. Ensure JavaScript deps are installed: `npm install`
2. On macOS, clean and reinstall Pods:
   ```sh
   cd ios/App
   rm -rf Pods Podfile.lock
   pod install
   ```
   If CocoaPods reports that the sandbox is out of sync with `Podfile.lock`, run the root-level helper to regenerate the iOS pods:
   ```sh
   npm run ios:sync
   ```
3. In Xcode, delete Derived Data for the app target, then rebuild.

After a fresh `pod install`, the hook repopulates missing `ios-arm64` slices automatically, so the build completes even when upstream vendors omit that directory.
