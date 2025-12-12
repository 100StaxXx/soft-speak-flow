# Environment Variables Quick Reference

## Frontend (.env.local) - Required

```env
# Firebase Configuration (Required)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# OAuth (Required for native auth)
VITE_GOOGLE_WEB_CLIENT_ID=
VITE_GOOGLE_IOS_CLIENT_ID=

# Push Notifications (Required)
VITE_WEB_PUSH_KEY=

# Native Redirects (Required)
VITE_NATIVE_REDIRECT_BASE=https://app.cosmiq.quest
```

## Firebase Functions Secrets

Set via: `firebase functions:secrets:set SECRET_NAME` or Firebase Console

```bash
# API Keys
GEMINI_API_KEY
OPENAI_API_KEY          # ⚠️ Currently uses process.env, should be secret
ELEVENLABS_API_KEY      # ⚠️ Currently uses process.env, should be secret

# PayPal
PAYPAL_CLIENT_ID
PAYPAL_SECRET

# Web Push (VAPID)
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT

# iOS Push (APNS)
APNS_KEY_ID
APNS_TEAM_ID
APNS_BUNDLE_ID
APNS_AUTH_KEY
APNS_ENVIRONMENT

# Apple Subscriptions
APPLE_SHARED_SECRET
APPLE_SERVICE_ID
APPLE_IOS_BUNDLE_ID
APPLE_WEBHOOK_AUDIENCE

# App Configuration
APP_URL                 # Optional, defaults to "https://cosmiq.app"
```

## Supabase Edge Functions Secrets

Set via: `supabase secrets set SECRET_NAME --project-ref tffrgsaawvletgiztfry`

```bash
# ⚠️ CRITICAL - Not auto-provided
SUPABASE_SERVICE_ROLE_KEY

# API Keys
OPENAI_API_KEY
ELEVENLABS_API_KEY
LOVABLE_API_KEY

# Apple/APNS
APNS_KEY_ID
APNS_TEAM_ID
APNS_BUNDLE_ID
APNS_AUTH_KEY
APNS_ENVIRONMENT
APPLE_SERVICE_ID

# PayPal
PAYPAL_CLIENT_ID
PAYPAL_SECRET

# Security
INTERNAL_FUNCTION_SECRET
```

## Script Environment Variables

Set in shell environment or `.env` file for Node.js scripts:

```bash
# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Supabase (for migration scripts)
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=

# Firebase (for migration scripts)
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Migration-specific
NEW_SUPABASE_URL=
NEW_SERVICE_ROLE_KEY=
```

## Quick Setup Commands

### Frontend
```bash
# Create .env.local file
cp .env.example .env.local
# Edit .env.local with your values
```

### Firebase Functions
```bash
# Set secrets one by one (will prompt for value)
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
# ... etc
```

### Supabase Edge Functions
```bash
# Link project first
supabase link --project-ref tffrgsaawvletgiztfry

# Set secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-key"
supabase secrets set OPENAI_API_KEY="your-key"
# ... etc
```

## Issues to Fix

1. **Missing `.env.local`** - Create file with all VITE_* variables
2. **Firebase Functions** - Convert `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` to use `defineSecret()`
3. **Supabase** - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (not auto-provided)

See `ENVIRONMENT_VARIABLE_DIFF_REPORT.md` for complete details.

