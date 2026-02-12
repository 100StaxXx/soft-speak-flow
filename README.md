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
cp .env.example .env
```

3. Set at minimum:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_NATIVE_REDIRECT_BASE`

4. Run the web app:

```sh
npm run dev
```

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
  - replaces DB cron jobs with GitHub-owned schedules
- `.github/workflows/backend-smoke.yml`
  - post-deploy backend smoke checks
- `docs/backend-cutover-checklist.md`
  - staging/production cutover and decommission sequence

Required GitHub secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`

Required Supabase project secrets (minimum):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

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
