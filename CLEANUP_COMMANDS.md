# Authentication Cleanup - Manual Commands

**Status:** Ready to execute  
**Note:** Supabase CLI commands need to be run manually as CLI is not installed in this environment

## Quick Start: Use the Scripts

We've created automated scripts to handle the cleanup:

**For Linux/Mac:**
```bash
chmod +x scripts/cleanup-orphaned-auth-functions.sh
./scripts/cleanup-orphaned-auth-functions.sh
```

**For Windows (PowerShell):**
```powershell
.\scripts\cleanup-orphaned-auth-functions.ps1
```

The scripts will:
- Check if functions are deployed
- Delete them if found
- Optionally remove unused secrets (with confirmation)
- Keep APPLE_SERVICE_ID (still in use)

---

## Manual Commands (Alternative)

---

## Step 1: Check if Functions are Deployed

First, verify if the orphaned functions are deployed:

```bash
supabase functions list
```

Look for:
- `apple-native-auth`
- `google-native-auth`

---

## Step 2: Undeploy Functions (if deployed)

If the functions are listed, undeploy them:

```bash
supabase functions delete apple-native-auth
supabase functions delete google-native-auth
```

**Expected output:**
```
Function apple-native-auth deleted
Function google-native-auth deleted
```

---

## Step 3: Verify Secrets Usage

**IMPORTANT:** Before removing any secrets, verify they're not used elsewhere.

### Secrets Analysis:

1. **`APPLE_SERVICE_ID`** - ✅ **KEEP THIS**
   - Still used in: `supabase/functions/apple-webhook/index.ts`
   - Still used in: `functions/src/index.ts` (Firebase Functions)
   - **DO NOT REMOVE**

2. **`GOOGLE_WEB_CLIENT_ID`** (without VITE_ prefix) - ⚠️ **MAY BE SAFE TO REMOVE**
   - Was only used in deleted `google-native-auth` function
   - Frontend uses `VITE_GOOGLE_WEB_CLIENT_ID` (different secret)
   - **Check if used elsewhere before removing**

3. **`GOOGLE_IOS_CLIENT_ID`** (without VITE_ prefix) - ⚠️ **MAY BE SAFE TO REMOVE**
   - Was only used in deleted `google-native-auth` function
   - Frontend uses `VITE_GOOGLE_IOS_CLIENT_ID` (different secret)
   - **Check if used elsewhere before removing**

### Check Secret Usage:

```bash
# List all secrets
supabase secrets list

# Search codebase for usage (already done - see below)
```

**Codebase Search Results:**
- `GOOGLE_WEB_CLIENT_ID` (no VITE_): Only found in deleted function and docs
- `GOOGLE_IOS_CLIENT_ID` (no VITE_): Only found in deleted function and docs
- `APPLE_SERVICE_ID`: Used in `apple-webhook` and Firebase Functions - **KEEP**

---

## Step 4: Remove Secrets (Optional - Only if not used)

**⚠️ WARNING:** Only remove these if you've verified they're not used elsewhere.

```bash
# Check if these secrets exist
supabase secrets list | grep -E "GOOGLE_WEB_CLIENT_ID|GOOGLE_IOS_CLIENT_ID"

# If they exist and are NOT used elsewhere, remove them:
supabase secrets unset GOOGLE_WEB_CLIENT_ID
supabase secrets unset GOOGLE_IOS_CLIENT_ID
```

**Note:** The frontend uses `VITE_GOOGLE_WEB_CLIENT_ID` and `VITE_GOOGLE_IOS_CLIENT_ID` (with VITE_ prefix), which are different secrets/environment variables.

---

## Step 5: Verify Cleanup

After cleanup, verify:

```bash
# List functions (should not show apple-native-auth or google-native-auth)
supabase functions list

# List secrets (verify GOOGLE_WEB_CLIENT_ID and GOOGLE_IOS_CLIENT_ID are removed if you removed them)
supabase secrets list
```

---

## Summary

### ✅ Completed (Code Changes):
- Deleted `apple-native-auth/index.ts`
- Deleted `google-native-auth/index.ts`
- Removed function configs from `config.toml`

### ⚠️ Manual Steps Required:
1. Undeploy functions from Supabase (if deployed)
2. Optionally remove `GOOGLE_WEB_CLIENT_ID` and `GOOGLE_IOS_CLIENT_ID` secrets (if not used elsewhere)

### ✅ Keep These Secrets:
- `APPLE_SERVICE_ID` - Still used in `apple-webhook` function
- `VITE_GOOGLE_WEB_CLIENT_ID` - Used in frontend
- `VITE_GOOGLE_IOS_CLIENT_ID` - Used in frontend

---

## Quick Command Reference

```bash
# 1. Check deployed functions
supabase functions list

# 2. Undeploy orphaned functions
supabase functions delete apple-native-auth
supabase functions delete google-native-auth

# 3. List all secrets
supabase secrets list

# 4. Remove secrets (only if not used elsewhere)
supabase secrets unset GOOGLE_WEB_CLIENT_ID
supabase secrets unset GOOGLE_IOS_CLIENT_ID
```

---

**Next Steps:** Run these commands when you have access to Supabase CLI and your project is linked.

