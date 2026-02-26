# Apple subscription backend (Supabase Edge Functions)

The Apple subscription flow now lives entirely in Supabase Edge Functions. The frontend keeps calling `check-apple-subscription` to read access state and `verify-apple-receipt` after purchases or restores; everything else is handled server-side.

## Environment variables you need

Add the following secrets to your Supabase project (Project Settings → Secrets or `supabase/config.toml` when testing locally):

- `APPLE_SHARED_SECRET` – The app-specific shared secret from App Store Connect (used for receipt verification).
- `APPLE_MONTHLY_PRODUCT_IDS` – Comma separated list of monthly product IDs (e.g. `cosmiq_premium_monthly,com.darrylgraham.revolution.monthly`).
- `APPLE_YEARLY_PRODUCT_IDS` – Comma separated list of yearly/annual product IDs (e.g. `cosmiq_premium_yearly,com.darrylgraham.revolution.yearly`).
- `APPLE_MONTHLY_PRICE_CENTS` – (Optional) Override the stored amount for monthly receipts; defaults to `999` ($9.99).
- `APPLE_YEARLY_PRICE_CENTS` – (Optional) Override the stored amount for yearly receipts; defaults to `5999` ($59.99).

The functions will log which environment (Production/Sandbox) Apple reports so you can confirm the correct secret is in place.

## How it works

- **verify-apple-receipt** now centralizes receipt validation, plan detection, and database updates through `_shared/appleSubscriptions.ts`. It:
  - Verifies the receipt against production and automatically retries the sandbox endpoint on `21007`.
  - Extracts the newest subscription transaction and maps the product ID to `monthly` or `yearly` using your configured product IDs.
  - Upserts the `subscriptions` row, updates the user profile, and records a payment history entry if one doesn't already exist for the transaction.
- **check-apple-subscription** simply reads the stored subscription row for the authenticated user and returns a consistent `{ subscribed, status, plan, subscription_end }` payload.
- **apple-webhook** now shares the same upsert logic for activation/renewals so that server notifications stay in sync with manual receipt verification.

Because everything flows through the shared helper, state stays consistent whether it comes from App Store server-to-server notifications or a manual restore inside the app.
