# Supabase Migration Guide: Lovable Cloud → Self-Managed

## Overview
This guide covers migrating from Lovable Cloud (project: `tffrgsaawvletgiztfry`) to a self-managed Supabase project.

---

## Phase 1: Pre-Migration (Current Project)

### 1.1 Export Data
```bash
# Export schema
supabase db dump -f supabase/export/schema.sql --project-ref tffrgsaawvletgiztfry

# Export data (excludes schema)
supabase db dump -f supabase/export/data.sql --data-only --project-ref tffrgsaawvletgiztfry

# Export auth users (if supported by your CLI version)
supabase auth export --project-ref tffrgsaawvletgiztfry > supabase/export/auth.json
```

### 1.2 Backup Storage
```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_URL="https://tffrgsaawvletgiztfry.supabase.co"

# Run backup script
npx ts-node scripts/backup-storage.ts
```

### 1.3 Document Current Secrets
Export all secret values before migration (store securely):

| Secret Name | Description |
|-------------|-------------|
| SUPABASE_URL | https://tffrgsaawvletgiztfry.supabase.co |
| SUPABASE_ANON_KEY | Current anon key |
| SUPABASE_SERVICE_ROLE_KEY | Current service role key |
| SUPABASE_DB_URL | Database connection string |
| OPENAI_API_KEY | OpenAI API key |
| ELEVENLABS_API_KEY | ElevenLabs TTS key |
| APPLE_TEAM_ID | Apple Developer Team ID |
| APPLE_KEY_ID | Apple Auth Key ID |
| APPLE_PRIVATE_KEY | Apple Auth Private Key (PEM) |
| APPLE_SERVICE_ID | com.darrylgraham.revolution.web |
| APPLE_SHARED_SECRET | App Store shared secret |
| APPLE_IOS_BUNDLE_ID | com.darrylgraham.revolution |
| APNS_KEY_ID | APNs Key ID |
| APNS_TEAM_ID | APNs Team ID |
| APNS_AUTH_KEY | APNs Auth Key (P8) |
| APNS_BUNDLE_ID | APNs Bundle ID |
| GOOGLE_CLIENT_ID | Google OAuth Client ID |
| VITE_GOOGLE_WEB_CLIENT_ID | Google Web Client ID |
| VITE_GOOGLE_IOS_CLIENT_ID | Google iOS Client ID |
| DISCORD_BOT_TOKEN | Discord bot token |
| DISCORD_WEBHOOK_URL | Discord webhook URL |
| DISCORD_GUILD_ID | Discord Guild ID |
| PAYPAL_CLIENT_ID | PayPal Client ID |
| PAYPAL_SECRET | PayPal Secret |
| STRIPE_SECRET_KEY | Stripe Secret Key |
| LOVABLE_API_KEY | Lovable API Key |
| VITE_NATIVE_REDIRECT_BASE | https://app.cosmiq.quest |

---

## Phase 2: New Project Setup

### 2.1 Create New Supabase Project
1. Go to https://supabase.com/dashboard
2. Create new project in your organization
3. Note these values:
   - **Project Ref**: `<NEW_PROJECT_REF>`
   - **API URL**: `https://<NEW_PROJECT_REF>.supabase.co`
   - **Anon Key**: `<NEW_ANON_KEY>`
   - **Service Role Key**: `<NEW_SERVICE_ROLE_KEY>`
   - **DB Password**: `<NEW_DB_PASSWORD>`

### 2.2 Enable Required Extensions
In SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

---

## Phase 3: Apply Migration

### 3.1 Update Config Files

**supabase/config.toml** - Update first line:
```toml
project_id = "<NEW_PROJECT_REF>"
```

**.env** - Update:
```env
VITE_SUPABASE_URL=https://<NEW_PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<NEW_ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<NEW_PROJECT_REF>
```

**.env.example** - Update with same placeholders

**REGENERATE_TYPES.sh** - Update PROJECT_ID:
```bash
PROJECT_ID="<NEW_PROJECT_REF>"
```

### 3.2 Link and Push Schema
```bash
# Link to new project
supabase link --project-ref <NEW_PROJECT_REF>

# Push all migrations
supabase db push
```

### 3.3 Load Data
```bash
# Connect and load data
psql "postgres://postgres.<NEW_PROJECT_REF>:<NEW_DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres" < supabase/export/data.sql
```

### 3.4 Update Cron Jobs
The cron jobs reference hardcoded URLs. Run this SQL with new values:

```sql
-- Remove old jobs
SELECT cron.unschedule('dispatch-daily-pushes-native');
SELECT cron.unschedule('dispatch-daily-quote-pushes');
SELECT cron.unschedule('process-daily-decay');

-- Recreate with new URLs
SELECT cron.schedule(
  'dispatch-daily-pushes-native',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/dispatch-daily-pushes-native',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <NEW_ANON_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);

SELECT cron.schedule(
  'dispatch-daily-quote-pushes',
  '30 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/dispatch-daily-quote-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <NEW_ANON_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);

SELECT cron.schedule(
  'process-daily-decay',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/process-daily-decay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <NEW_ANON_KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id
  $$
);
```

---

## Phase 4: Configure Services

### 4.1 Set All Secrets
```bash
supabase secrets set --project-ref <NEW_PROJECT_REF> \
  SUPABASE_URL="https://<NEW_PROJECT_REF>.supabase.co" \
  SUPABASE_ANON_KEY="<NEW_ANON_KEY>" \
  SUPABASE_SERVICE_ROLE_KEY="<NEW_SERVICE_ROLE_KEY>" \
  SUPABASE_DB_URL="postgres://postgres.<NEW_PROJECT_REF>:<DB_PASSWORD>@..." \
  OPENAI_API_KEY="sk-..." \
  ELEVENLABS_API_KEY="..." \
  APPLE_TEAM_ID="..." \
  APPLE_KEY_ID="..." \
  APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..." \
  APPLE_SERVICE_ID="com.darrylgraham.revolution.web" \
  APPLE_SHARED_SECRET="..." \
  APPLE_IOS_BUNDLE_ID="com.darrylgraham.revolution" \
  APNS_KEY_ID="..." \
  APNS_TEAM_ID="..." \
  APNS_AUTH_KEY="-----BEGIN PRIVATE KEY-----..." \
  APNS_BUNDLE_ID="com.darrylgraham.revolution" \
  GOOGLE_CLIENT_ID="...apps.googleusercontent.com" \
  VITE_GOOGLE_WEB_CLIENT_ID="...apps.googleusercontent.com" \
  VITE_GOOGLE_IOS_CLIENT_ID="...apps.googleusercontent.com" \
  DISCORD_BOT_TOKEN="..." \
  DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  DISCORD_GUILD_ID="..." \
  PAYPAL_CLIENT_ID="..." \
  PAYPAL_SECRET="..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  VITE_NATIVE_REDIRECT_BASE="https://app.cosmiq.quest"
```

### 4.2 Deploy Edge Functions
```bash
# Deploy all functions
for fn in $(ls supabase/functions | grep -v '^_'); do
  echo "Deploying $fn..."
  supabase functions deploy "$fn" --project-ref <NEW_PROJECT_REF>
done
```

### 4.3 Upload Storage Files
```bash
# For each bucket, upload backed-up files
# Example using supabase-js or CLI:
for bucket in pep-talk-audio audio-pep-talks video-pep-talks quotes-json mentors-avatars voice-samples playlists-assets hero-media mentor-audio evolution-cards; do
  echo "Uploading to $bucket..."
  # Use supabase storage upload or a custom script
done
```

### 4.4 Configure OAuth Providers
In Supabase Dashboard → Authentication → Providers:

**Google:**
- Client ID: Your Google Web Client ID
- Client Secret: Your Google Client Secret

**Apple:**
- Service ID: com.darrylgraham.revolution.web
- Team ID: Your Apple Team ID
- Key ID: Your Apple Key ID
- Private Key: Your Apple Private Key (PEM)

### 4.5 Update Apple Webhook
In App Store Connect → App Information:
- Production Server URL: `https://<NEW_PROJECT_REF>.supabase.co/functions/v1/apple-webhook`
- Version: Version 2

---

## Phase 5: Client Updates

### 5.1 Regenerate Types
```bash
./REGENERATE_TYPES.sh
```

### 5.2 Update Capacitor Config
In `capacitor.config.ts`, update if any URLs are hardcoded.

### 5.3 Rebuild iOS App
```bash
npm run build
npx cap sync ios
# Open Xcode and rebuild
```

---

## Phase 6: Validation

### 6.1 Verify Cron Jobs
```sql
SELECT * FROM cron.job;
-- Check last run status
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### 6.2 Test Critical Flows
- [ ] User signup/login
- [ ] Companion evolution
- [ ] Quest completion + XP
- [ ] Subscription purchase
- [ ] Push notifications
- [ ] Mentor chat
- [ ] Daily missions generation
- [ ] Storage file access

### 6.3 Revoke Old Credentials
After validation, rotate/revoke old Lovable Cloud credentials to ensure no traffic hits old project.

---

## Troubleshooting

### Common Issues

**Cron jobs not firing:**
- Check pg_cron extension is enabled
- Verify URLs and anon key in cron job definitions
- Check `cron.job_run_details` for errors

**Edge functions 500 errors:**
- Check function logs: `supabase functions logs <function-name>`
- Verify all secrets are set correctly
- Check CORS configuration in `_shared/cors.ts`

**Storage access denied:**
- Verify bucket policies are applied
- Check RLS policies on `storage.objects`
- Ensure buckets are marked public if needed

**Apple webhook failures:**
- Verify webhook URL is correct in App Store Connect
- Check edge function logs for errors
- Verify APPLE_SHARED_SECRET is correct
