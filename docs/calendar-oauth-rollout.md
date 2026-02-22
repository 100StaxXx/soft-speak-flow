# Calendar OAuth Rollout Checklist

This checklist covers the non-code rollout steps for Google/Outlook calendar auth.

## 1) Set required secrets per Supabase environment

Run for each profile/environment (example: `prod`, `staging`):

```bash
supabase secrets set --profile <profile> GOOGLE_CALENDAR_CLIENT_ID="..."
supabase secrets set --profile <profile> GOOGLE_CALENDAR_CLIENT_SECRET="..."
supabase secrets set --profile <profile> OUTLOOK_CLIENT_ID="..."
supabase secrets set --profile <profile> OUTLOOK_CLIENT_SECRET="..."
```

Verify they exist:

```bash
supabase secrets list --profile <profile>
```

## 2) Verify OAuth redirect allowlists

For each environment base URL, ensure both providers allow:

- `<native_redirect_base>/calendar/oauth/callback`

Where `native_redirect_base` should match `VITE_NATIVE_REDIRECT_BASE` for that environment.

## 3) Redeploy auth functions

Deploy for each target environment:

```bash
supabase functions deploy google-calendar-auth --profile <profile>
supabase functions deploy outlook-calendar-auth --profile <profile>
```

## 4) Smoke test

1. Start Google connect from `/profile` in iOS app.
2. Complete provider consent.
3. Confirm callback returns to app and provider shows connected.
4. Repeat for Outlook.
