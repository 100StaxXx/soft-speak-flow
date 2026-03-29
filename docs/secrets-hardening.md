# Secrets Hardening

## Frontend build allowlist

Only these client-visible variables should be used in browser builds:

- `VITE_APP_VERSION`
- `VITE_GOOGLE_IOS_CLIENT_ID`
- `VITE_GOOGLE_WEB_CLIENT_ID`
- `VITE_NATIVE_REDIRECT_BASE`
- `VITE_SENTRY_DSN`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Do not add service-role keys, webhook secrets, provider API secrets, or internal function secrets to any `VITE_*` variable.

## Server-only variables

Use non-`VITE_*` names for privileged credentials. Common examples in this repo:

- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_FUNCTION_SECRET`
- `INFLUENCER_DASHBOARD_SECRET`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `PAYPAL_SECRET`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `OUTLOOK_CLIENT_SECRET`
- `APPLE_PRIVATE_KEY`
- `APNS_AUTH_KEY`

## Local setup

- Keep tracked templates in `.env.example` only.
- Store local secrets in untracked files such as `.env.local`.
- Run `npm run hooks:install` once to enable the pre-commit secret scan.
- Run `npm run secrets:scan` before opening a PR if you touched env files, workflows, or provider integrations.

## Rotation checklist

- Rotate `SUPABASE_SERVICE_ROLE_KEY`.
- Rotate `INTERNAL_FUNCTION_SECRET`.
- Create or rotate `INFLUENCER_DASHBOARD_SECRET`.
- Review and rotate `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `PAYPAL_SECRET`, Google/Outlook client secrets, APNS auth material, and Apple private key if they were ever stored outside secret managers.
- Remove any tracked env files that ever held live values.
- If real secrets were committed historically, coordinate a history rewrite separately from normal code changes.
