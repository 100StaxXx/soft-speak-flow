# Firebase Functions Fix Summary

## Problem
Functions were throwing `FirebaseError: internal` errors due to Firebase Storage bucket configuration issues.

## Root Cause
The code was calling `admin.storage().bucket()` without an explicit bucket name. This requires a default bucket to be configured, and if it's not set, the call fails with an internal error.

## Solution Applied

### 1. Added Storage Bucket Helper Function
Created `getStorageBucket()` helper function that:
- Explicitly resolves the bucket name from Firebase project configuration
- Uses `admin.app().options.storageBucket` if available
- Falls back to `{projectId}.appspot.com` pattern (standard Firebase default)
- Throws clear error if project ID is not configured

**Location:** `functions/src/index.ts` (around line 2051)

### 2. Updated All Storage Bucket Calls
Fixed 3 locations where storage buckets were accessed:
- `generateAndUploadAudio()` function - Line ~2104
- `generateMentorAudio` Cloud Function - Line ~2406  
- `generateFullMentorAudio` Cloud Function - Line ~2532

### 3. Improved Error Handling
Added try-catch blocks around storage upload operations with:
- Clear error messages indicating which bucket failed
- Proper error propagation to Cloud Functions error handling

### 4. Created Diagnostic Tools
- **Diagnostic Script:** `scripts/diagnose-firebase-functions.ps1`
  - Checks Firebase CLI installation
  - Verifies secrets are configured
  - Checks function deployment status
  - Validates dependencies

- **Debugging Guide:** `FIREBASE_FUNCTIONS_DEBUGGING.md`
  - Common issues and solutions
  - Step-by-step debugging process
  - Log access instructions

- **Deployment Checklist:** `DEPLOY_FIREBASE_FUNCTIONS.md`
  - Pre-deployment verification steps
  - Deployment commands
  - Post-deployment verification
  - Troubleshooting guide

## Code Changes

### Before
```typescript
const bucket = admin.storage().bucket(); // Could fail if no default bucket
```

### After
```typescript
function getStorageBucket() {
  const projectId = admin.app().options.projectId;
  if (!projectId) {
    throw new Error("Firebase project ID not configured");
  }
  const bucketName = admin.app().options.storageBucket || `${projectId}.appspot.com`;
  return admin.storage().bucket(bucketName);
}

// Usage
const bucket = getStorageBucket();
try {
  await file.save(Buffer.from(audioBytes), { metadata: { contentType: "audio/mpeg" } });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
} catch (error) {
  console.error(`Failed to upload audio to Firebase Storage bucket ${bucket.name}:`, error);
  throw new Error(`Storage upload failed: ${error.message}`);
}
```

## Next Steps

### 1. Verify Secrets Are Set
```powershell
firebase functions:secrets:access GEMINI_API_KEY
firebase functions:secrets:access ELEVENLABS_API_KEY
firebase functions:secrets:access OPENAI_API_KEY
```

### 2. Build Functions
```powershell
cd functions
npm run build
cd ..
```

### 3. Deploy Functions
```powershell
firebase deploy --only functions
```

### 4. Verify Deployment
```powershell
firebase functions:list
firebase functions:log --limit 20
```

### 5. Check Function Logs
If errors persist, check detailed logs:
```powershell
firebase functions:log --only generateCompletePepTalk --limit 50
```

Or in Firebase Console:
https://console.firebase.google.com/project/cosmiq-prod/functions/logs

## Expected Behavior After Fix

1. ✅ Storage bucket is resolved automatically using project ID
2. ✅ Clear error messages if storage upload fails
3. ✅ Functions no longer throw generic "internal" errors for storage issues
4. ✅ Detailed error logs in Firebase Console for debugging

## Testing

After deployment, test the functions:
- `generateCompletePepTalk` - Should generate script
- `generateMentorAudio` - Should generate and upload audio
- `generateDailyMentorPepTalks` - Should complete full workflow

## Related Functions

These functions use the storage bucket helper:
- `generateAndUploadAudio()` - Helper function for audio uploads
- `generateMentorAudio` - Cloud Function for generating mentor audio
- `generateFullMentorAudio` - Cloud Function for full audio generation

All of these now use explicit bucket resolution and improved error handling.
