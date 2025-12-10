# Supabase Migration Guide: Fresh Start on New Project

## Overview
This guide covers setting up the fresh Supabase project: `opbfpbbqvuksuvmtmssd`

**Project URL**: `https://opbfpbbqvuksuvmtmssd.supabase.co`

---

## Phase 1: Local Setup

### 1.1 Clone and Install
```bash
# Clone your repo from GitHub
git clone <your-repo-url>
cd <project-folder>
npm install

# Install Supabase CLI
npm install -g supabase
```

### 1.2 Link to Project
```bash
supabase link --project-ref opbfpbbqvuksuvmtmssd
```

---

## Phase 2: Database Setup

### 2.1 Enable Required Extensions
In Supabase Dashboard → SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### 2.2 Push All Migrations
```bash
supabase db push
```

This creates all tables, functions, triggers, and RLS policies from scratch.

---

## Phase 3: Set Secrets

### 3.1 Required Secrets (27 total)
Set all secrets via CLI:
```bash
supabase secrets set --project-ref opbfpbbqvuksuvmtmssd \
  SUPABASE_URL="https://opbfpbbqvuksuvmtmssd.supabase.co" \
  SUPABASE_ANON_KEY="<YOUR_ANON_KEY>" \
  SUPABASE_SERVICE_ROLE_KEY="<YOUR_SERVICE_ROLE_KEY>" \
  OPENAI_API_KEY="<YOUR_OPENAI_KEY>" \
  ELEVENLABS_API_KEY="<YOUR_ELEVENLABS_KEY>" \
  LOVABLE_API_KEY="<YOUR_LOVABLE_KEY>" \
  ALLOWED_ORIGINS="https://app.cosmiq.quest" \
  ENVIRONMENT="production" \
  APP_URL="https://app.cosmiq.quest" \
  INTERNAL_FUNCTION_SECRET="<GENERATE_A_STRONG_SECRET>" \
  VAPID_PUBLIC_KEY="<YOUR_VAPID_PUBLIC_KEY>" \
  VAPID_PRIVATE_KEY="<YOUR_VAPID_PRIVATE_KEY>" \
  VAPID_SUBJECT="mailto:admin@cosmiq.quest" \
  APPLE_SERVICE_ID="com.darrylgraham.revolution.web" \
  APPLE_IOS_BUNDLE_ID="com.darrylgraham.revolution" \
  APPLE_SHARED_SECRET="<YOUR_APPLE_SHARED_SECRET>" \
  APPLE_WEBHOOK_AUDIENCE="appstoreconnect-v1" \
  APNS_KEY_ID="<YOUR_APNS_KEY_ID>" \
  APNS_TEAM_ID="<YOUR_APNS_TEAM_ID>" \
  APNS_AUTH_KEY="<APNS_P8_CONTENTS>" \
  APNS_BUNDLE_ID="com.darrylgraham.revolution" \
  APNS_ENVIRONMENT="production" \
  VITE_GOOGLE_WEB_CLIENT_ID="371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com" \
  VITE_GOOGLE_IOS_CLIENT_ID="371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com" \
  PAYPAL_CLIENT_ID="<YOUR_PAYPAL_CLIENT_ID>" \
  PAYPAL_SECRET="<YOUR_PAYPAL_SECRET>"
```


### 3.2 Secrets Reference Table

| Secret Name | Description | Required |
|-------------|-------------|----------|
| SUPABASE_URL | Project URL | ✅ |
| SUPABASE_ANON_KEY | Anon/public key | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | Service role key | ✅ |
| SUPABASE_DB_URL | Database connection string | ✅ |
| SUPABASE_PUBLISHABLE_KEY | Same as anon key | ✅ |
| OPENAI_API_KEY | OpenAI API key | ✅ |
| ELEVENLABS_API_KEY | ElevenLabs TTS | ✅ |
| LOVABLE_API_KEY | Lovable AI | ✅ |
| APPLE_TEAM_ID | Apple Developer Team ID | ✅ |
| APPLE_KEY_ID | Apple Auth Key ID | ✅ |
| APPLE_PRIVATE_KEY | Apple Auth Private Key | ✅ |
| APPLE_SERVICE_ID | com.darrylgraham.revolution.web | ✅ |
| APPLE_SHARED_SECRET | App Store shared secret | ✅ |
| APPLE_IOS_BUNDLE_ID | com.darrylgraham.revolution | ✅ |
| APNS_KEY_ID | APNs Key ID | ✅ |
| APNS_TEAM_ID | APNs Team ID | ✅ |
| APNS_AUTH_KEY | APNs Auth Key (P8) | ✅ |
| APNS_BUNDLE_ID | APNs Bundle ID | ✅ |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | Optional |
| VITE_GOOGLE_WEB_CLIENT_ID | Google Web Client ID | Optional |
| VITE_GOOGLE_IOS_CLIENT_ID | Google iOS Client ID | Optional |
| DISCORD_BOT_TOKEN | Discord bot token | Optional |
| DISCORD_WEBHOOK_URL | Discord webhook URL | Optional |
| DISCORD_GUILD_ID | Discord Guild ID | Optional |
| PAYPAL_CLIENT_ID | PayPal Client ID | Optional |
| PAYPAL_SECRET | PayPal Secret | Optional |
| STRIPE_SECRET_KEY | Stripe Secret Key | Optional |
| VITE_NATIVE_REDIRECT_BASE | https://app.cosmiq.quest | ✅ |

---

## Phase 4: Deploy Edge Functions

### 4.1 Deploy All Functions
```bash
# Deploy all edge functions (70+)
for fn in $(ls supabase/functions | grep -v '^_'); do
  echo "Deploying $fn..."
  supabase functions deploy "$fn" --project-ref opbfpbbqvuksuvmtmssd
done
```

---

## Phase 5: Configure Cron Jobs

Run in Supabase SQL Editor:
```sql
-- Daily pushes (1 PM UTC)
SELECT cron.schedule(
  'dispatch-daily-pushes-native',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://opbfpbbqvuksuvmtmssd.supabase.co/functions/v1/dispatch-daily-pushes-native',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmZwYmJxdnVrc3V2bXRtc3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA4MTgsImV4cCI6MjA4MDc5NjgxOH0.0IpdmZyokW17gckZrRytKXAVJx4Vi5sq1QfJ283vKsw'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);

-- Daily quote pushes (2:30 PM UTC)
SELECT cron.schedule(
  'dispatch-daily-quote-pushes',
  '30 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://opbfpbbqvuksuvmtmssd.supabase.co/functions/v1/dispatch-daily-quote-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmZwYmJxdnVrc3V2bXRtc3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA4MTgsImV4cCI6MjA4MDc5NjgxOH0.0IpdmZyokW17gckZrRytKXAVJx4Vi5sq1QfJ283vKsw'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);

-- Daily decay (5 AM UTC)
SELECT cron.schedule(
  'process-daily-decay',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://opbfpbbqvuksuvmtmssd.supabase.co/functions/v1/process-daily-decay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmZwYmJxdnVrc3V2bXRtc3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjA4MTgsImV4cCI6MjA4MDc5NjgxOH0.0IpdmZyokW17gckZrRytKXAVJx4Vi5sq1QfJ283vKsw'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);
```

---

## Phase 6: Configure OAuth Providers

### 6.1 Google OAuth
In Supabase Dashboard → Authentication → Providers → Google:
- Client ID: `371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com`
- Client Secret: Your Google Client Secret

In Google Cloud Console, add redirect URL:
- `https://opbfpbbqvuksuvmtmssd.supabase.co/auth/v1/callback`

### 6.2 Apple Sign In
In Supabase Dashboard → Authentication → Providers → Apple:
- Service ID: `com.darrylgraham.revolution.web`
- Team ID: `B6VW78ABTR`
- Key ID: `FPGVLVRK63`
- Private Key: Your Apple Private Key

---

## Phase 7: Create Storage Buckets

In Supabase Dashboard → Storage, create these public buckets:
- `pep-talk-audio`
- `audio-pep-talks`
- `video-pep-talks`
- `quotes-json`
- `mentors-avatars`
- `voice-samples`
- `playlists-assets`
- `hero-media`
- `mentor-audio`
- `evolution-cards`

---

## Phase 8: Update Apple Webhook

In App Store Connect → App Information:
- Production Server URL: `https://opbfpbbqvuksuvmtmssd.supabase.co/functions/v1/apple-webhook`
- Version: Version 2

---

## Phase 9: Regenerate Types & Rebuild

```bash
# Regenerate TypeScript types
./REGENERATE_TYPES.sh

# Build app
npm run build

# Sync iOS
npx cap sync ios
```

---

## Phase 10: Validation Checklist

- [ ] User signup/login works
- [ ] Companion creation succeeds
- [ ] Quest completion awards XP
- [ ] Subscription purchase works
- [ ] Push notifications fire
- [ ] Mentor chat responds
- [ ] Daily missions generate
- [ ] Storage files upload/download

---

## Troubleshooting

### Edge functions 500 errors
```bash
supabase functions logs <function-name> --project-ref opbfpbbqvuksuvmtmssd
```

### Missing secrets
```bash
supabase secrets list --project-ref opbfpbbqvuksuvmtmssd
```

### Cron jobs not firing
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```
