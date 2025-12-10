# Authentication Diagnostic Report

## Overview
This report documents the findings from a deep diagnostic of the login and account creation functionality.

---

## Summary of Issues Found

### 🔴 CRITICAL ISSUE #1: Edge Function Environment Variables Not Configured

**Affected:** Native Google OAuth, Native Apple OAuth

The edge functions `google-native-auth` and `apple-native-auth` rely on environment variables that must be set as **Supabase Secrets**, but they're using `VITE_*` prefixed names which are typically for frontend use only.

**In `google-native-auth/index.ts` (lines 42-44):**
```typescript
const webClientId = Deno.env.get('VITE_GOOGLE_WEB_CLIENT_ID');
const iosClientId = Deno.env.get('VITE_GOOGLE_IOS_CLIENT_ID');
```

**In `apple-native-auth/index.ts` (line 47):**
```typescript
const appleServiceId = Deno.env.get('APPLE_SERVICE_ID');
```

**Fix Required:**
1. Either rename these to standard names (recommended):
   - `GOOGLE_WEB_CLIENT_ID`
   - `GOOGLE_IOS_CLIENT_ID`
   - `APPLE_SERVICE_ID`

2. Or set the secrets in Supabase with the `VITE_` prefix:
   ```bash
   supabase secrets set VITE_GOOGLE_WEB_CLIENT_ID="371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com"
   supabase secrets set VITE_GOOGLE_IOS_CLIENT_ID="371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com"
   supabase secrets set APPLE_SERVICE_ID="com.darrylgraham.revolution.web"
   ```

---

### 🔴 CRITICAL ISSUE #2: Missing Supabase Secrets for Edge Functions

The following secrets MUST be set in your Supabase project for auth to work:

| Secret Name | Purpose | Current Status |
|-------------|---------|----------------|
| `SUPABASE_URL` | Auto-provided by Supabase | ✅ Auto |
| `SUPABASE_ANON_KEY` | Auto-provided by Supabase | ✅ Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase | ✅ Auto |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Google OAuth audience validation | ⚠️ Needs manual setup |
| `VITE_GOOGLE_IOS_CLIENT_ID` | Google OAuth audience validation | ⚠️ Needs manual setup |
| `APPLE_SERVICE_ID` | Apple OAuth audience validation | ⚠️ Needs manual setup |

**To verify your secrets, run:**
```bash
supabase secrets list
```

**To set missing secrets:**
```bash
supabase secrets set VITE_GOOGLE_WEB_CLIENT_ID="your-web-client-id"
supabase secrets set VITE_GOOGLE_IOS_CLIENT_ID="your-ios-client-id"
supabase secrets set APPLE_SERVICE_ID="com.darrylgraham.revolution.web"
```

---

### 🟡 MODERATE ISSUE #3: Redirect URL Configuration

For OAuth to work, redirect URLs must be whitelisted in Supabase Dashboard.

**Required Redirect URLs (add these in Supabase Dashboard → Authentication → URL Configuration):**

1. Production: `https://app.cosmiq.quest`
2. Production: `https://cosmiq.quest`
3. Production: `https://cosmiq.app`
4. Development: `http://localhost:5173` (or your dev port)
5. Development: `http://localhost:3000`
6. Lovable previews: `*.lovable.dev`, `*.lovableproject.com`

**Current redirect URL logic (`src/utils/redirectUrl.ts`):**
- Native platforms: Uses `VITE_NATIVE_REDIRECT_BASE` = `https://app.cosmiq.quest`
- Web: Uses `window.location.origin`

---

### 🟡 MODERATE ISSUE #4: CORS Configuration Missing Domain

**FIXED:** The CORS configuration in `supabase/functions/_shared/cors.ts` was missing `app.cosmiq.quest` domain. This has been added to the allowed origins list.

---

### 🟡 MODERATE ISSUE #4: OAuth Provider Configuration

Ensure these providers are enabled in Supabase Dashboard → Authentication → Providers:

| Provider | Required Settings |
|----------|-------------------|
| **Google** | Client ID, Client Secret, Redirect URL |
| **Apple** | Service ID, Team ID, Key ID, Private Key |
| **Email** | Enable email confirmations if using signup verification |

---

## Code Analysis

### Auth Flow Diagram

```
User clicks "Sign In" or "Create Account"
            ↓
      ┌─────────────────────────────────────────┐
      │  Email/Password Auth                     │
      │  - signInWithPassword() or signUp()     │
      │  - Direct to Supabase Auth API          │
      │  - No edge functions needed             │
      └─────────────────────────────────────────┘
            ↓
      ┌─────────────────────────────────────────┐
      │  Google/Apple OAuth (Web)               │
      │  - signInWithOAuth()                    │
      │  - Redirects to OAuth provider          │
      │  - Returns with code/token              │
      └─────────────────────────────────────────┘
            ↓
      ┌─────────────────────────────────────────┐
      │  Google/Apple OAuth (Native iOS)        │
      │  - Uses native SDK (SocialLogin plugin) │
      │  - Gets idToken/identityToken          │
      │  - Calls edge function to verify        │  ← FAILS if secrets not set
      │  - Edge function creates session        │
      └─────────────────────────────────────────┘
            ↓
      ┌─────────────────────────────────────────┐
      │  Post-Auth Navigation                   │
      │  - ensureProfile() creates profile      │
      │  - getAuthRedirectPath() decides route  │
      │  - Navigate to /tasks or /onboarding    │
      └─────────────────────────────────────────┘
```

### Files Involved in Authentication

| File | Purpose |
|------|---------|
| `src/pages/Auth.tsx` | Main auth UI and flow orchestration |
| `src/hooks/useAuth.ts` | Auth state management |
| `src/utils/authRedirect.ts` | Post-auth navigation and profile creation |
| `src/utils/redirectUrl.ts` | OAuth redirect URL handling |
| `src/integrations/supabase/client.ts` | Supabase client configuration |
| `supabase/functions/google-native-auth/index.ts` | Native Google auth handler |
| `supabase/functions/apple-native-auth/index.ts` | Native Apple auth handler |
| `src/components/ProtectedRoute.tsx` | Route protection with auth check |

---

## Applied Fixes

### ✅ Fix 1: Updated Edge Functions to Use Standard Environment Variable Names

**`supabase/functions/google-native-auth/index.ts`** - Changed to use standard names with better error messages:
```typescript
// Note: These must be set as Supabase secrets via `supabase secrets set`
const webClientId = Deno.env.get('GOOGLE_WEB_CLIENT_ID');
const iosClientId = Deno.env.get('GOOGLE_IOS_CLIENT_ID');

// Added validation with clear error message
if (!webClientId && !iosClientId) {
  console.error('Missing Google Client ID secrets...');
  throw new Error('Google OAuth not configured - missing client IDs');
}
```

### ✅ Fix 2: Added Missing Domain to CORS Configuration

Added `app.cosmiq.quest` and other `cosmiq.quest` domains to `supabase/functions/_shared/cors.ts`.

### ✅ Fix 3: Fixed Signup Flow for Immediate Login

Updated `src/pages/Auth.tsx` to handle cases where email confirmation is disabled:
- If Supabase returns a session immediately after signup, user is navigated to the app
- If email confirmation is required, user sees the "Check your email" message

### ⚠️ Action Required: Set Supabase Secrets

**This is the most likely cause of auth failures.** Run these commands after linking your Supabase project:

```bash
# Link to your Supabase project first
supabase link --project-ref opbfpbbqvuksuvmtmssd

# Set the required secrets for native OAuth
supabase secrets set GOOGLE_WEB_CLIENT_ID="371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com"
supabase secrets set GOOGLE_IOS_CLIENT_ID="371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com"
supabase secrets set APPLE_SERVICE_ID="com.darrylgraham.revolution.web"

# Deploy the updated edge functions
supabase functions deploy google-native-auth
supabase functions deploy apple-native-auth
```

### Fix 3: Verify Supabase Dashboard Configuration

1. Go to Supabase Dashboard → Authentication → Providers
2. Ensure Google and Apple are properly configured
3. Go to Authentication → URL Configuration
4. Add all necessary redirect URLs

---

## Testing Checklist

After applying fixes, test each auth method:

- [ ] Email/Password Login
- [ ] Email/Password Signup (check email confirmation flow)
- [ ] Google OAuth (Web)
- [ ] Google OAuth (Native iOS)
- [ ] Apple OAuth (Web)
- [ ] Apple OAuth (Native iOS)
- [ ] Password Reset

---

## Environment Variables Reference

### Frontend (.env)
```
VITE_SUPABASE_URL="https://opbfpbbqvuksuvmtmssd.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
VITE_GOOGLE_WEB_CLIENT_ID="371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com"
VITE_GOOGLE_IOS_CLIENT_ID="371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com"
VITE_NATIVE_REDIRECT_BASE="https://app.cosmiq.quest"
```

### Supabase Edge Function Secrets (via `supabase secrets set`)
```
GOOGLE_WEB_CLIENT_ID="..."
GOOGLE_IOS_CLIENT_ID="..."
APPLE_SERVICE_ID="..."
APPLE_KEY_ID="..."
APPLE_TEAM_ID="..."
APPLE_PRIVATE_KEY="..."
```
