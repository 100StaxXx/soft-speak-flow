# Firebase Functions Debugging Guide

## Issue: FirebaseError: internal

The `FirebaseError: internal` error is a generic error that indicates the Cloud Function threw an exception. The actual error details are in the Firebase Console logs.

## Common Causes & Solutions

### 1. Function Not Deployed

**Problem:** Code changes haven't been deployed to Firebase.

**Solution:**
```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 2. Missing Firebase Secrets

**Problem:** Required API keys are not set in Firebase Secrets.

**Check:**
```bash
firebase functions:secrets:access GEMINI_API_KEY
firebase functions:secrets:access ELEVENLABS_API_KEY
firebase functions:secrets:access OPENAI_API_KEY
```

**Fix:**
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

### 3. Firebase Storage Bucket Not Configured

**Problem:** Default storage bucket doesn't exist or isn't configured.

**Solution:**
1. Go to Firebase Console → Storage
2. Ensure default bucket exists (usually `{projectId}.appspot.com`)
3. The code has been fixed to use explicit bucket names automatically

**Verify:**
- Console: https://console.firebase.google.com/project/cosmiq-prod/storage
- Default bucket should be: `cosmiq-prod.appspot.com`

### 4. Missing Dependencies

**Problem:** `form-data` or other dependencies not installed.

**Check:**
```bash
cd functions
npm list form-data
```

**Fix:**
```bash
cd functions
npm install
npm run build
```

### 5. API Errors (ElevenLabs, OpenAI, Gemini)

**Problem:** External API calls are failing.

**Check logs:**
```bash
firebase functions:log --only generateCompletePepTalk
```

**Verify API keys:**
- GEMINI_API_KEY: Valid Google Gemini API key
- ELEVENLABS_API_KEY: Valid ElevenLabs API key
- OPENAI_API_KEY: Valid OpenAI API key

## Recent Code Fixes

The following fixes have been applied to address storage bucket issues:

1. **Added `getStorageBucket()` helper function** - Explicitly gets bucket name from project config
2. **Improved error handling** - Better error messages for storage upload failures
3. **Storage bucket resolution** - Uses `{projectId}.appspot.com` as fallback if no default bucket configured

## Debugging Steps

### Step 1: Run Diagnostic Script

```powershell
.\scripts\diagnose-firebase-functions.ps1
```

### Step 2: Check Function Logs

**In Console:**
https://console.firebase.google.com/project/cosmiq-prod/functions/logs

**Via CLI:**
```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only generateCompletePepTalk

# Real-time logs
firebase functions:log --follow
```

### Step 3: Verify Function Deployment

```bash
# List deployed functions
firebase functions:list

# Check specific function
firebase functions:describe generateCompletePepTalk
```

### Step 4: Test Locally (Optional)

```bash
cd functions
npm run serve

# In another terminal, call the function
# (requires emulator setup)
```

## Function Endpoints

- `generateCompletePepTalk` - Generates pep talk script (uses GEMINI_API_KEY)
- `generateMentorAudio` - Generates audio from script (uses ELEVENLABS_API_KEY)
- `transcribeAudio` - Transcribes audio with timestamps (uses OPENAI_API_KEY)
- `generateDailyMentorPepTalks` - Generates complete pep talks with all steps (uses all 3 keys)

## Quick Verification Checklist

- [ ] All secrets set: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`
- [ ] Functions deployed: `firebase deploy --only functions`
- [ ] Firebase Storage bucket exists
- [ ] Dependencies installed: `cd functions && npm install`
- [ ] Code compiled: `cd functions && npm run build`
- [ ] Check logs for actual error message

## Getting Detailed Error Messages

The client only sees `FirebaseError: internal`, but the real error is in the server logs:

1. **Firebase Console:**
   - Go to Functions → Logs
   - Filter by function name
   - Look for ERROR level logs

2. **CLI:**
   ```bash
   firebase functions:log --only generateCompletePepTalk --limit 50
   ```

The logs will show:
- Stack traces
- API error responses
- Missing configuration errors
- Storage upload failures

## Project Configuration

- **Project ID:** `cosmiq-prod`
- **Default Storage Bucket:** `cosmiq-prod.appspot.com`
- **Functions Region:** (default, usually us-central1)
