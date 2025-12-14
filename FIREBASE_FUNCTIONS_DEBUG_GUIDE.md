# Firebase Functions Debug Guide

## Issue: FirebaseError: internal

The `FirebaseError: internal` error is a generic error that means the Cloud Function threw an exception. This guide helps you diagnose and fix the issue.

## Root Causes Identified

Based on code review, the following issues have been fixed and need verification:

### 1. ✅ Fixed: Firebase Storage Bucket Usage

**Problem:** The code was using `admin.storage().bucket()` without explicitly specifying a bucket name, which requires a default bucket to be configured.

**Fix Applied:** Updated all three instances to explicitly use the default bucket name:
- `cosmiq-prod.appspot.com` (based on project ID)
- Added error handling for storage operations
- Added fallback to environment variable `STORAGE_BUCKET` if set

**Files Modified:**
- `functions/src/index.ts` (3 locations: lines ~2104, ~2406, ~2510)

### 2. ⚠️ Needs Verification: Function Deployment

**Issue:** Code changes need to be deployed to Firebase.

**Action Required:**
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 3. ⚠️ Needs Verification: API Keys

**Required Secrets:**
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY`

**Check if set:**
```bash
firebase functions:secrets:access
```

**Set if missing:**
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

### 4. ⚠️ Needs Verification: Firebase Storage Bucket

**Issue:** The default Storage bucket must exist and be accessible.

**Check:**
1. Go to [Firebase Console → Storage](https://console.firebase.google.com/project/cosmiq-prod/storage)
2. Verify bucket `cosmiq-prod.appspot.com` exists
3. If it doesn't exist, create it or update the code to use a different bucket

## Diagnostic Steps

### Step 1: Run Diagnostic Script

```powershell
.\scripts\diagnose-firebase-functions.ps1
```

This will check:
- Firebase CLI installation
- Authentication status
- Project configuration
- Functions build status
- Secrets configuration
- Storage bucket status

### Step 2: Check Function Logs

The real error message is in the Firebase Console logs, not in the client error:

```bash
# View all function logs
firebase functions:log

# View logs for specific function
firebase functions:log --only generateDailyMentorPepTalks

# View recent logs with errors
firebase functions:log --only generateDailyMentorPepTalks | Select-String -Pattern "error|Error|ERROR"
```

Or check in Firebase Console:
1. Go to [Firebase Console → Functions → Logs](https://console.firebase.google.com/project/cosmiq-prod/functions/logs)
2. Filter by function name: `generateDailyMentorPepTalks`
3. Look for error messages with full stack traces

### Step 3: Test API Keys

The code includes a `testApiKeys` function that verifies all API keys are accessible:

```typescript
// Call from your app
const functions = getFunctions();
const testApiKeys = httpsCallable(functions, 'testApiKeys');
const result = await testApiKeys();
console.log(result.data);
```

### Step 4: Verify Storage Bucket

**Option A: Check via Firebase Console**
1. Navigate to [Storage](https://console.firebase.google.com/project/cosmiq-prod/storage)
2. Verify bucket `cosmiq-prod.appspot.com` exists
3. Check bucket permissions

**Option B: Test via Code**
Add this test function temporarily:

```typescript
// In functions/src/index.ts
export const testStorage = onCall(async (request) => {
  try {
    const bucketName = process.env.STORAGE_BUCKET || "cosmiq-prod.appspot.com";
    const bucket = admin.storage().bucket(bucketName);
    
    // Try to list files (read permission test)
    const [files] = await bucket.getFiles({ maxResults: 1 });
    
    return { 
      success: true, 
      bucketName: bucket.name,
      message: "Storage bucket is accessible"
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
});
```

## Deployment Checklist

Before deploying, ensure:

- [ ] All code changes are saved
- [ ] Functions are built: `cd functions && npm run build`
- [ ] All required secrets are set
- [ ] Storage bucket exists and is accessible
- [ ] You're logged into Firebase: `firebase login`
- [ ] Correct project is selected: `firebase use cosmiq-prod`

## Deploy Functions

```bash
# Build functions
cd functions
npm run build
cd ..

# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:generateDailyMentorPepTalks
```

## Common Error Messages

### "Storage bucket not found"
- **Solution:** Create the default bucket in Firebase Console or update code to use existing bucket

### "API key not configured"
- **Solution:** Set the missing secret: `firebase functions:secrets:set <KEY_NAME>`

### "Permission denied"
- **Solution:** Check IAM roles for the Cloud Functions service account
- Ensure Storage Admin role is granted

### "Function timeout"
- **Solution:** The function has a 540-second timeout. If generation takes longer, consider:
  - Breaking into smaller functions
  - Using Cloud Tasks for async processing
  - Optimizing API calls

## Next Steps After Fix

1. **Deploy the fixes:**
   ```bash
   cd functions && npm run build && cd .. && firebase deploy --only functions
   ```

2. **Monitor logs:**
   ```bash
   firebase functions:log --only generateDailyMentorPepTalks
   ```

3. **Test the function:**
   - Call it from your app
   - Check for any new error messages
   - Verify audio files are uploaded to Storage

4. **Verify Storage:**
   - Check Firebase Console → Storage
   - Confirm files are being uploaded to `pep-talks/` or `mentor-audio/` folders

## Additional Resources

- [Firebase Functions Logs](https://console.firebase.google.com/project/cosmiq-prod/functions/logs)
- [Firebase Storage Console](https://console.firebase.google.com/project/cosmiq-prod/storage)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [Firebase Storage Admin SDK](https://firebase.google.com/docs/storage/admin/start)
