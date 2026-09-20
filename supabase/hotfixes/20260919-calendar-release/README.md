# Calendar OAuth release baseline

Deployed September 19, 2026 to shared project opbfpbbqvuksuvmtmssd.
This Google handler is a fresh production snapshot with exactly one functional change:
Cosmiq authorization requests add Google Tasks scope; Graceward retains the original scopes.
Product-aware signed OAuth state, redirects and account checks are preserved.
Do not overwrite it with the older root Google handler without reconciling those changes.
Outlook already requests Tasks.ReadWrite and was not redeployed.

Deployment: `supabase functions deploy google-calendar-auth --use-api --no-verify-jwt --project-ref opbfpbbqvuksuvmtmssd --workdir supabase/hotfixes/20260919-calendar-release`.
The handler validates auth and signed callbacks internally. This does not grant new access by itself:
Cosmiq users must reconnect Google and explicitly approve Tasks access.
