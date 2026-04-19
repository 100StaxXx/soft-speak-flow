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
- Native callback: `<native_redirect_base>/calendar/oauth/callback`

Where `native_redirect_base` should match `VITE_NATIVE_REDIRECT_BASE` for that environment.

For Microsoft app registrations, add every production and staging web domain plus every native redirect base you expect shipped builds to use.

## 3) Redeploy auth functions

Deploy for each target environment:

```bash
supabase functions deploy google-calendar-auth --profile <profile>
supabase functions deploy outlook-calendar-auth --profile <profile>
```

## 4) Smoke test

1. Start Outlook connect from `/profile` on web or iOS.
2. Complete Microsoft consent and confirm the callback returns to the app.
3. Choose the primary Outlook calendar and primary Microsoft To Do list, then enable `full sync`.
4. Open journeys/planner and confirm Outlook calendar events appear as read-only availability blocks.
5. Create a Microsoft To Do item and confirm it appears in the app Inbox/planner context.
6. Confirm a planner-created scheduled quest and verify it auto-publishes to Outlook Calendar.
7. Confirm a planner-created inbox or date-only quest and verify it auto-publishes to Microsoft To Do.
8. Edit or complete a synced Outlook To Do item remotely and confirm the app reflects the newer provider state.
