# ⚠️ ARCHIVED: Supabase Migration Guide

**Status:** This document is **ARCHIVED** and kept for historical reference only.

**Current Status:** The migration from Supabase to Firebase has been **COMPLETED**. This app now uses Firebase exclusively.

---

## Migration Complete ✅

The Cosmiq app has been fully migrated from Supabase to Firebase. All active code now uses:

- ✅ **Firebase Authentication** (replaces Supabase Auth)
- ✅ **Firestore Database** (replaces Supabase PostgreSQL)
- ✅ **Firebase Cloud Functions** (replaces Supabase Edge Functions)
- ✅ **Firebase Storage** (replaces Supabase Storage)

---

## For Current Setup

If you're setting up the app for the first time, see:

- **`FIREBASE-SETUP.md`** - Firebase project setup
- **`SET_FIREBASE_SECRETS.md`** - Firebase Functions secrets configuration
- **`FRONTEND_ENV_SETUP.md`** - Frontend environment variables

---

## Historical Reference

The content below is kept for historical reference only and should **NOT** be used for current setup.

<details>
<summary>Click to view archived Supabase setup instructions</summary>

# Supabase Migration Guide: Fresh Start on New Project

## Overview
This guide covers setting up the fresh Supabase project: `tffrgsaawvletgiztfry`

**Project URL**: `https://tffrgsaawvletgiztfry.supabase.co`

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
supabase link --project-ref tffrgsaawvletgiztfry
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
supabase secrets set --project-ref tffrgsaawvletgiztfry \
  SUPABASE_URL="https://tffrgsaawvletgiztfry.supabase.co" \
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
  VITE_GOOGLE_WEB_CLIENT_ID="<YOUR_GOOGLE_WEB_CLIENT_ID>" \
  VITE_GOOGLE_IOS_CLIENT_ID="<YOUR_GOOGLE_IOS_CLIENT_ID>" \
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

</details>

---

**Last Updated:** 2025-01-27  
**Migration Completed:** 2024-12-11  
**Status:** Archived for historical reference
