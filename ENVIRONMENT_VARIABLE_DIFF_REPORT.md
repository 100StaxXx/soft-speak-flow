# Environment Variable Diff Check Report

**Generated:** $(date)  
**Project:** soft-speak-flow

---

## Executive Summary

This report identifies all environment variables referenced in the codebase and compares them against:
- Firebase Functions secrets (defined in `functions/src/index.ts`)
- `.env.local` (Vite frontend environment variables)
- Supabase Edge Functions secrets (Deno.env)

---

## 1. Frontend Environment Variables (Vite - `import.meta.env`)

These variables must be prefixed with `VITE_` and should be in `.env.local`:

### Required Firebase Configuration
| Variable | Used In | Status |
|----------|---------|--------|
| `VITE_FIREBASE_API_KEY` | `src/lib/firebase.ts:8` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `src/lib/firebase.ts:9` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_PROJECT_ID` | `src/lib/firebase.ts:10` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `src/lib/firebase.ts:11` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `src/lib/firebase.ts:12` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_APP_ID` | `src/lib/firebase.ts:13` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `src/lib/firebase.ts:14` | ⚠️ **MISSING** - Check `.env.local` |

### OAuth & Authentication
| Variable | Used In | Status |
|----------|---------|--------|
| `VITE_GOOGLE_WEB_CLIENT_ID` | `src/pages/Auth.tsx:224` | ⚠️ **MISSING** - Check `.env.local` |
| `VITE_GOOGLE_IOS_CLIENT_ID` | `src/pages/Auth.tsx:225` | ⚠️ **MISSING** - Check `.env.local` |

### Push Notifications
| Variable | Used In | Status |
|----------|---------|--------|
| `VITE_WEB_PUSH_KEY` | `src/utils/pushNotifications.ts:12` | ⚠️ **MISSING** - Check `.env.local` |

### Native Redirects
| Variable | Used In | Status |
|----------|---------|--------|
| `VITE_NATIVE_REDIRECT_BASE` | `src/utils/redirectUrl.ts:9` | ⚠️ **MISSING** - Check `.env.local` |

### Supabase (Scripts Only - Not Used in Frontend)
| Variable | Used In | Status |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Scripts only (`scripts/migrate-*.ts`, `scripts/export-*.ts`) | ⚠️ **SCRIPT ONLY** - Not used in frontend code |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Scripts only (`scripts/migrate-*.ts`, `scripts/export-*.ts`) | ⚠️ **SCRIPT ONLY** - Not used in frontend code |

### Vite Built-in Variables
| Variable | Used In | Status |
|----------|---------|--------|
| `import.meta.env.DEV` | `src/utils/logger.ts:44` | ✅ Auto-provided by Vite |
| `import.meta.env.MODE` | `src/utils/logger.ts:45` | ✅ Auto-provided by Vite |

---

## 2. Firebase Functions Secrets (`process.env`)

These should be set as Firebase Functions secrets using `firebase functions:secrets:set` or as environment variables in Firebase Console.

### Defined Secrets (using `defineSecret`)
| Secret | Defined In | Used In | Status |
|--------|------------|---------|--------|
| `GEMINI_API_KEY` | `functions/src/index.ts:35` | `functions/src/gemini.ts:28`, `functions/src/index.ts:2095` | ⚠️ **CHECK** - Verify set in Firebase |
| `PAYPAL_CLIENT_ID` | `functions/src/index.ts:13` | Various PayPal functions | ⚠️ **CHECK** - Verify set in Firebase |
| `PAYPAL_SECRET` | `functions/src/index.ts:14` | Various PayPal functions | ⚠️ **CHECK** - Verify set in Firebase |
| `VAPID_PUBLIC_KEY` | `functions/src/index.ts:17` | Push notification functions | ⚠️ **CHECK** - Verify set in Firebase |
| `VAPID_PRIVATE_KEY` | `functions/src/index.ts:18` | Push notification functions | ⚠️ **CHECK** - Verify set in Firebase |
| `VAPID_SUBJECT` | `functions/src/index.ts:19` | Push notification functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APNS_KEY_ID` | `functions/src/index.ts:22` | iOS push functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APNS_TEAM_ID` | `functions/src/index.ts:23` | iOS push functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APNS_BUNDLE_ID` | `functions/src/index.ts:24` | iOS push functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APNS_AUTH_KEY` | `functions/src/index.ts:25` | iOS push functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APNS_ENVIRONMENT` | `functions/src/index.ts:26` | iOS push functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APPLE_SHARED_SECRET` | `functions/src/index.ts:29` | Apple subscription functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APPLE_SERVICE_ID` | `functions/src/index.ts:30` | Apple subscription functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APPLE_IOS_BUNDLE_ID` | `functions/src/index.ts:31` | Apple subscription functions | ⚠️ **CHECK** - Verify set in Firebase |
| `APPLE_WEBHOOK_AUDIENCE` | `functions/src/index.ts:32` | Apple subscription functions | ⚠️ **CHECK** - Verify set in Firebase |

### Environment Variables (using `process.env` - NOT secrets)
| Variable | Used In | Status |
|----------|---------|--------|
| `OPENAI_API_KEY` | `functions/src/index.ts:2099, 2151, 2259, 2360` | ⚠️ **MISSING** - Should be a secret, currently using `process.env` |
| `ELEVENLABS_API_KEY` | `functions/src/index.ts:1915, 2016, 2103, 2187` | ⚠️ **MISSING** - Should be a secret, currently using `process.env` |
| `APP_URL` | `functions/src/index.ts:2659, 2708` | ⚠️ **OPTIONAL** - Defaults to "https://cosmiq.app" |

**⚠️ ISSUE:** `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` are accessed via `process.env` but should be defined as secrets using `defineSecret()` for consistency and security.

---

## 3. Supabase Edge Functions Secrets (`Deno.env.get`)

These should be set as Supabase secrets using `supabase secrets set`.

### Auto-Provided by Supabase
| Secret | Used In | Status |
|--------|---------|--------|
| `SUPABASE_URL` | Multiple edge functions | ✅ Auto-provided |
| `SUPABASE_ANON_KEY` | Multiple edge functions | ✅ Auto-provided |
| `SUPABASE_SERVICE_ROLE_KEY` | Multiple edge functions | ⚠️ **MANUAL SETUP REQUIRED** - Not auto-provided |

### API Keys
| Secret | Used In | Status |
|--------|---------|--------|
| `OPENAI_API_KEY` | `supabase/functions/transcribe-audio/index.ts:22`, `generate-tutorial-tts/index.ts:34`, `generate-evolution-voice/index.ts:71` | ⚠️ **CHECK** - Verify set in Supabase |
| `ELEVENLABS_API_KEY` | `supabase/functions/generate-mentor-audio/index.ts:130`, `generate-evolution-voice/index.ts:120` | ⚠️ **CHECK** - Verify set in Supabase |
| `LOVABLE_API_KEY` | Multiple generation functions (20+ files) | ⚠️ **CHECK** - Verify set in Supabase |
| `GEMINI_API_KEY` | Not found in Supabase functions | ✅ Not used |

### Apple/APNS Configuration
| Secret | Used In | Status |
|--------|---------|--------|
| `APPLE_SERVICE_ID` | `supabase/functions/send-apns-notification/index.ts` (via docs) | ⚠️ **CHECK** - Verify set in Supabase |
| `APNS_KEY_ID` | `supabase/functions/send-apns-notification/index.ts:37` | ⚠️ **CHECK** - Verify set in Supabase |
| `APNS_TEAM_ID` | `supabase/functions/send-apns-notification/index.ts:38` | ⚠️ **CHECK** - Verify set in Supabase |
| `APNS_BUNDLE_ID` | `supabase/functions/send-apns-notification/index.ts:39` | ⚠️ **CHECK** - Verify set in Supabase |
| `APNS_AUTH_KEY` | `supabase/functions/send-apns-notification/index.ts:40` | ⚠️ **CHECK** - Verify set in Supabase |
| `APNS_ENVIRONMENT` | `supabase/functions/send-apns-notification/index.ts:41` | ⚠️ **CHECK** - Verify set in Supabase |

### PayPal
| Secret | Used In | Status |
|--------|---------|--------|
| `PAYPAL_CLIENT_ID` | `supabase/functions/process-paypal-payout/index.ts:115` | ⚠️ **CHECK** - Verify set in Supabase |
| `PAYPAL_SECRET` | `supabase/functions/process-paypal-payout/index.ts:116` | ⚠️ **CHECK** - Verify set in Supabase |

### Internal Security
| Secret | Used In | Status |
|--------|---------|--------|
| `INTERNAL_FUNCTION_SECRET` | `supabase/functions/send-shout-notification/index.ts:23`, `send-apns-notification/index.ts:21` | ⚠️ **CHECK** - Verify set in Supabase |

### OAuth (Potentially Unused)
| Secret | Used In | Status |
|--------|---------|--------|
| `VITE_GOOGLE_WEB_CLIENT_ID` | Referenced in docs, but edge functions may not use | ⚠️ **VERIFY** - Check if actually used |
| `VITE_GOOGLE_IOS_CLIENT_ID` | Referenced in docs, but edge functions may not use | ⚠️ **VERIFY** - Check if actually used |

---

## 4. Script Environment Variables (`process.env`)

These are used in Node.js scripts and should be set in the shell environment or `.env` file.

| Variable | Used In | Status |
|----------|---------|--------|
| `GOOGLE_APPLICATION_CREDENTIALS` | `scripts/seed-cosmiq-catalog.ts:63`, `scripts/verify-catalog-seed.ts:38`, `scripts/migrate-profiles-to-firestore.ts:35` | ⚠️ **CHECK** - Path to service account JSON |
| `VITE_SUPABASE_URL` | `scripts/migrate-profiles-to-firestore.ts:19`, `scripts/migrate-mentors-to-firestore.ts:15`, `scripts/migrate-data-to-firestore.js:31`, `scripts/export-mentors-json.ts:9` | ⚠️ **CHECK** - May be legacy |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `scripts/migrate-profiles-to-firestore.ts:20`, `scripts/migrate-mentors-to-firestore.ts:16`, `scripts/export-mentors-json.ts:10` | ⚠️ **CHECK** - May be legacy |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/migrate-data-to-firestore.js:33`, `scripts/backup-storage.ts:16` | ⚠️ **CHECK** - Service role key for scripts |
| `SUPABASE_URL` | `scripts/backup-storage.ts:15` | ⚠️ **CHECK** - Supabase URL for scripts |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `scripts/migrate-data-to-firestore.js:66`, `scripts/import-csv-to-firestore.js:27` | ⚠️ **CHECK** - Path to Firebase service account |
| `FIREBASE_SERVICE_ACCOUNT` | `scripts/migrate-data-to-firestore.js:82`, `scripts/import-csv-to-firestore.js:41` | ⚠️ **CHECK** - JSON string of service account |
| `NEW_SUPABASE_URL` | `scripts/upload-storage.ts:16` | ⚠️ **CHECK** - Migration script variable |
| `NEW_SERVICE_ROLE_KEY` | `scripts/upload-storage.ts:17` | ⚠️ **CHECK** - Migration script variable |

---

## 5. Issues & Recommendations

### 🔴 Critical Issues

1. **Missing `.env.local` file**
   - No `.env.local` file found in the repository
   - All `VITE_*` variables are missing
   - **Action:** Create `.env.local` with all required Vite variables

2. **Firebase Functions: Inconsistent Secret Usage**
   - `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` use `process.env` instead of `defineSecret()`
   - Other API keys use `defineSecret()` properly
   - **Action:** Refactor to use `defineSecret()` for consistency

3. **Supabase Edge Functions: Missing Service Role Key**
   - `SUPABASE_SERVICE_ROLE_KEY` is NOT auto-provided by Supabase
   - Required by many edge functions for admin operations
   - **Action:** Set manually via `supabase secrets set SUPABASE_SERVICE_ROLE_KEY="..."`

### ⚠️ Warnings

1. **Potential Duplication**
   - Some variables exist in both Firebase Functions and Supabase Edge Functions
   - Examples: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `APNS_*` variables
   - **Action:** Verify both environments have the same values

2. **Legacy Supabase Variables**
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are used in scripts
   - May be legacy if project migrated to Firebase
   - **Action:** Verify if still needed or can be removed

3. **OAuth Variable Naming Confusion**
   - Frontend uses `VITE_GOOGLE_WEB_CLIENT_ID` and `VITE_GOOGLE_IOS_CLIENT_ID`
   - Supabase edge functions may need these without `VITE_` prefix
   - **Action:** Verify Supabase edge functions don't need these (or set both versions)

### ✅ Recommendations

1. **Create `.env.local` template**
   ```env
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   VITE_FIREBASE_MEASUREMENT_ID=

   # OAuth
   VITE_GOOGLE_WEB_CLIENT_ID=
   VITE_GOOGLE_IOS_CLIENT_ID=

   # Push Notifications
   VITE_WEB_PUSH_KEY=

   # Native Redirects
   VITE_NATIVE_REDIRECT_BASE=https://app.cosmiq.quest
   ```

2. **Standardize Firebase Functions Secrets**
   - Convert `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` to use `defineSecret()`
   - Update all references to use the secret object

3. **Documentation**
   - Create a centralized `.env.example` file
   - Document which variables are required vs optional
   - Document where each variable should be set (Firebase Console, Supabase secrets, `.env.local`)

---

## 6. Quick Checklist

### Frontend (`.env.local`)
- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`
- [ ] `VITE_FIREBASE_MEASUREMENT_ID`
- [ ] `VITE_GOOGLE_WEB_CLIENT_ID`
- [ ] `VITE_GOOGLE_IOS_CLIENT_ID`
- [ ] `VITE_WEB_PUSH_KEY`
- [ ] `VITE_NATIVE_REDIRECT_BASE`

### Firebase Functions Secrets
- [ ] `GEMINI_API_KEY`
- [ ] `OPENAI_API_KEY` (currently `process.env`, should be secret)
- [ ] `ELEVENLABS_API_KEY` (currently `process.env`, should be secret)
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_SECRET`
- [ ] `VAPID_PUBLIC_KEY`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `VAPID_SUBJECT`
- [ ] `APNS_KEY_ID`
- [ ] `APNS_TEAM_ID`
- [ ] `APNS_BUNDLE_ID`
- [ ] `APNS_AUTH_KEY`
- [ ] `APNS_ENVIRONMENT`
- [ ] `APPLE_SHARED_SECRET`
- [ ] `APPLE_SERVICE_ID`
- [ ] `APPLE_IOS_BUNDLE_ID`
- [ ] `APPLE_WEBHOOK_AUDIENCE`
- [ ] `APP_URL` (optional, defaults to "https://cosmiq.app")

### Supabase Edge Functions Secrets
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (CRITICAL - not auto-provided)
- [ ] `OPENAI_API_KEY`
- [ ] `ELEVENLABS_API_KEY`
- [ ] `LOVABLE_API_KEY`
- [ ] `APNS_KEY_ID`
- [ ] `APNS_TEAM_ID`
- [ ] `APNS_BUNDLE_ID`
- [ ] `APNS_AUTH_KEY`
- [ ] `APNS_ENVIRONMENT`
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_SECRET`
- [ ] `INTERNAL_FUNCTION_SECRET`
- [ ] `APPLE_SERVICE_ID`

---

## 7. Summary Statistics

- **Total unique environment variables found:** ~40+
- **Frontend (Vite) variables:** 12
- **Firebase Functions secrets:** 17
- **Supabase Edge Functions secrets:** 13+
- **Script variables:** 8
- **Missing `.env.local` file:** ✅ Yes (needs to be created)
- **Variables with naming inconsistencies:** 2 (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`)

---

## 8. Next Steps

1. **Immediate Actions:**
   - Create `.env.local` file with all required Vite variables
   - Verify Firebase Functions secrets are set in Firebase Console
   - Verify Supabase secrets are set (especially `SUPABASE_SERVICE_ROLE_KEY`)

2. **Code Improvements:**
   - Refactor Firebase Functions to use `defineSecret()` for `OPENAI_API_KEY` and `ELEVENLABS_API_KEY`
   - Create `.env.example` template file
   - Add validation/error messages for missing environment variables

3. **Documentation:**
   - Update `FIREBASE-SETUP.md` with complete variable list
   - Create `ENV_SETUP.md` with setup instructions for all environments
   - Document which variables are shared between Firebase and Supabase

---

**Report Generated:** $(date)  
**Tool:** Environment Variable Diff Check Script

