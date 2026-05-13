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

For each environment, register the exact callback URIs the app can send during OAuth:

- Web callback: `https://<app-domain>/calendar/oauth/callback`
- Native Google callback: `https://<project-ref>.supabase.co/functions/v1/google-calendar-auth/callback`
- Native Outlook callback: `https://<project-ref>.supabase.co/functions/v1/outlook-calendar-auth/callback`

Native Google and Outlook use Supabase callbacks so the Edge Functions can exchange provider codes server-side and then return to `cosmiq://calendar/oauth/callback`.

For Google Cloud OAuth web clients, add every production and staging web callback plus every Supabase Google callback under **Authorized redirect URIs**.
For Microsoft app registrations, add every production and staging web callback plus every Supabase Outlook callback you expect shipped builds to use.
Do not register or send callback URIs with query parameters; provider and native/web source are carried in signed OAuth state so Outlook.com personal accounts can complete the flow.
Add the Outlook callbacks under the Microsoft Entra **Web** platform, not the SPA or mobile/native platform. The edge function exchanges the code server-side with `OUTLOOK_CLIENT_SECRET`, so Microsoft must treat these callback URLs as confidential web-client redirects.

For Google OAuth testing before production verification, add each tester Gmail address under the OAuth consent screen test users list. Non-test users remain blocked until Google approves the app and requested Calendar scopes.

## 3) Redeploy auth functions

Deploy for each target environment:

```bash
supabase functions deploy google-calendar-auth --profile <profile>
supabase functions deploy outlook-calendar-auth --profile <profile>
```

## 4) Smoke test

1. Start Outlook connect from `/profile` on web or iOS.
2. Complete Microsoft consent and confirm the callback returns to the app.
3. Choose the primary Outlook calendar and primary Microsoft To Do list.
4. Open journeys/planner and confirm the settings UI only exposes send destinations, with no read/import sync controls.
5. Send a scheduled quest to Outlook Calendar and verify the external event is created.
6. Send an inbox or date-only quest to Microsoft To Do and verify the external task is created.
7. Edit or complete an Outlook item remotely and confirm the app does not import or mirror the provider-side change.
