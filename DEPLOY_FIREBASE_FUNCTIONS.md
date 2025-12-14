# Firebase Functions Deployment Checklist

## Pre-Deployment Verification

### 1. Verify Secrets Are Set

```powershell
# Check each secret
firebase functions:secrets:access GEMINI_API_KEY
firebase functions:secrets:access ELEVENLABS_API_KEY
firebase functions:secrets:access OPENAI_API_KEY
```

**If missing, set them:**
```powershell
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set ELEVENLABS_API_KEY
firebase functions:secrets:set OPENAI_API_KEY
```

### 2. Verify Firebase Storage Bucket Exists

**Check in Console:**
https://console.firebase.google.com/project/cosmiq-prod/storage

Default bucket should be: `cosmiq-prod.appspot.com`

If it doesn't exist, Firebase Storage will be automatically created when you first use it, but you may need to enable it in the console.

### 3. Build Functions

```powershell
cd functions
npm install
npm run build
cd ..
```

**Verify build succeeded:**
- Check that `functions/lib/index.js` exists
- No TypeScript compilation errors

### 4. Deploy Functions

```powershell
firebase deploy --only functions
```

**Or deploy specific function:**
```powershell
firebase deploy --only functions:generateCompletePepTalk
firebase deploy --only functions:generateMentorAudio
firebase deploy --only functions:transcribeAudio
```

## Post-Deployment Verification

### 1. Check Deployment Status

```powershell
firebase functions:list
```

### 2. Check Function Logs

```powershell
# All functions
firebase functions:log

# Specific function
firebase functions:log --only generateCompletePepTalk --limit 20
```

**Or in Console:**
https://console.firebase.google.com/project/cosmiq-prod/functions/logs

### 3. Test Function (if needed)

Use the Firebase Console to test callable functions:
https://console.firebase.google.com/project/cosmiq-prod/functions

## Common Issues & Solutions

### Issue: "Function not found" or "Permission denied"

**Solution:**
- Verify function was deployed: `firebase functions:list`
- Check IAM permissions in Firebase Console
- Ensure user has Firebase Functions Admin role

### Issue: "Missing required API key"

**Solution:**
- Verify secrets are set: `firebase functions:secrets:access <SECRET_NAME>`
- Redeploy after setting secrets
- Check function secrets configuration in code matches Firebase Secrets

### Issue: "Storage bucket not found"

**Solution:**
- Verify bucket exists: https://console.firebase.google.com/project/cosmiq-prod/storage
- Enable Firebase Storage if not already enabled
- Default bucket name is `{projectId}.appspot.com` (code now handles this automatically)

### Issue: "Timeout" or "Function execution took too long"

**Solution:**
- Check function timeout settings (currently 540s for generateDailyMentorPepTalks)
- Review function logs for slow operations
- Consider optimizing API calls or increasing timeout

## Function Reference

### generateCompletePepTalk
- **Secrets Required:** `GEMINI_API_KEY`
- **Purpose:** Generates pep talk script content
- **Timeout:** Default (60s)

### generateMentorAudio
- **Secrets Required:** `ELEVENLABS_API_KEY`
- **Purpose:** Generates audio from script using ElevenLabs
- **Timeout:** Default (60s)

### transcribeAudio
- **Secrets Required:** `OPENAI_API_KEY`
- **Purpose:** Transcribes audio with word-level timestamps
- **Timeout:** Default (60s)

### generateDailyMentorPepTalks
- **Secrets Required:** `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`
- **Purpose:** Generates complete pep talks (script + audio + transcript) for all mentors
- **Timeout:** 540s (9 minutes)

## Quick Deployment Commands

```powershell
# Full deployment
cd functions; npm install; npm run build; cd ..; firebase deploy --only functions

# Check logs after deployment
firebase functions:log --limit 50

# Verify deployment
firebase functions:list
```
