# Run Cleanup Now - Step by Step

**Status:** Ready to execute  
**Requirement:** Supabase CLI authentication needed

---

## Step 1: Authenticate with Supabase

First, you need to log in to Supabase:

```powershell
npx supabase login
```

This will:
1. Open your browser
2. Ask you to authenticate
3. Store your credentials locally

**Alternative (if browser doesn't open):**
```powershell
npx supabase login --no-browser
```
Then follow the instructions to get a token and use:
```powershell
npx supabase login --token YOUR_TOKEN
```

---

## Step 2: Link Your Project (if needed)

If the project isn't already linked:

```powershell
npx supabase link --project-ref tffrgsaawvletgiztfry
```

---

## Step 3: Run the Cleanup

Once authenticated, run the cleanup script:

```powershell
.\scripts\cleanup-orphaned-auth-functions.ps1
```

**Or run commands manually:**

```powershell
# Check what functions are deployed
npx supabase functions list

# Delete the orphaned functions (if they exist)
npx supabase functions delete apple-native-auth
npx supabase functions delete google-native-auth

# List secrets
npx supabase secrets list

# Optionally remove unused secrets (if they exist and you confirm they're not used)
npx supabase secrets unset GOOGLE_WEB_CLIENT_ID
npx supabase secrets unset GOOGLE_IOS_CLIENT_ID
```

---

## Quick One-Liner (After Authentication)

After you've authenticated, you can run:

```powershell
npx supabase functions delete apple-native-auth; npx supabase functions delete google-native-auth; Write-Host "✅ Cleanup complete! Check secrets manually if needed."
```

---

## What Gets Cleaned Up

1. **Functions to delete:**
   - `apple-native-auth` (if deployed)
   - `google-native-auth` (if deployed)

2. **Secrets to optionally remove:**
   - `GOOGLE_WEB_CLIENT_ID` (only if not used elsewhere)
   - `GOOGLE_IOS_CLIENT_ID` (only if not used elsewhere)

3. **Secrets to KEEP:**
   - `APPLE_SERVICE_ID` - Still used in `apple-webhook` function
   - `VITE_GOOGLE_WEB_CLIENT_ID` - Used in frontend
   - `VITE_GOOGLE_IOS_CLIENT_ID` - Used in frontend

---

## Verification

After cleanup, verify:

```powershell
# Check functions (should not show apple-native-auth or google-native-auth)
npx supabase functions list

# Check secrets
npx supabase secrets list
```

---

**Ready?** Start with Step 1: `npx supabase login`

