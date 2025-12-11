# Authentication Required to Complete Cleanup

## Current Status

✅ **Code Cleanup:** Complete
- Deleted orphaned function files
- Updated configuration files
- Created cleanup scripts

⚠️ **Deployment Cleanup:** Requires authentication
- Need to delete functions from Supabase
- Need to optionally remove secrets

## Why Authentication is Needed

The Supabase CLI requires authentication to:
- List deployed functions
- Delete functions
- Manage secrets

## How to Complete the Cleanup

### Method 1: Using Access Token (Recommended)

1. **Get your access token:**
   - Go to: https://supabase.com/dashboard/account/tokens
   - Create a new token or use an existing one

2. **Run the cleanup script:**
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN="your-token-here"
   .\scripts\cleanup-with-token.ps1
   ```

### Method 2: Interactive Login

1. **Login to Supabase:**
   ```powershell
   npx supabase login
   ```
   (This will open your browser for authentication)

2. **Link your project:**
   ```powershell
   npx supabase link --project-ref tffrgsaawvletgiztfry
   ```

3. **Run the cleanup script:**
   ```powershell
   .\scripts\cleanup-orphaned-auth-functions.ps1
   ```

### Method 3: Manual Commands (After Authentication)

```powershell
# Delete functions
npx supabase functions delete apple-native-auth
npx supabase functions delete google-native-auth

# Optionally remove secrets
npx supabase secrets unset GOOGLE_WEB_CLIENT_ID
npx supabase secrets unset GOOGLE_IOS_CLIENT_ID
```

## What Will Be Cleaned Up

1. **Functions:**
   - `apple-native-auth` (if deployed)
   - `google-native-auth` (if deployed)

2. **Secrets (optional):**
   - `GOOGLE_WEB_CLIENT_ID` (without VITE_ prefix)
   - `GOOGLE_IOS_CLIENT_ID` (without VITE_ prefix)

3. **Secrets to KEEP:**
   - `APPLE_SERVICE_ID` - Still in use
   - `VITE_GOOGLE_WEB_CLIENT_ID` - Used in frontend
   - `VITE_GOOGLE_IOS_CLIENT_ID` - Used in frontend

## Verification

After cleanup, verify:
```powershell
npx supabase functions list
npx supabase secrets list
```

---

**All code changes are complete. Only deployment cleanup requires your authentication.**

