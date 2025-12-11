# Setting Firebase Functions Secrets

## Option 1: Using Firebase CLI (Recommended)

Run these commands one at a time in PowerShell. Each command will prompt you to enter the secret value:

```powershell
# Set Gemini API Key
firebase functions:secrets:set GEMINI_API_KEY

# Set OpenAI API Key  
firebase functions:secrets:set OPENAI_API_KEY

# Set ElevenLabs API Key
firebase functions:secrets:set ELEVENLABS_API_KEY
```

**Note:** After setting secrets, you need to update your function code to use them. Currently, the functions use `process.env`, which works for environment variables but not secrets.

## Option 2: Set as Environment Variables in Firebase Console

1. Go to: https://console.firebase.google.com/project/cosmiq-prod/functions
2. Click on any function
3. Go to "Configuration" tab
4. Scroll to "Environment variables"
5. Add:
   - `GEMINI_API_KEY` = `<YOUR_GEMINI_API_KEY>` (get from Google Cloud Console)
   - `OPENAI_API_KEY` = `<YOUR_OPENAI_KEY>`
   - `ELEVENLABS_API_KEY` = `<YOUR_ELEVENLABS_KEY>`

**Note:** Environment variables set in the console apply to ALL functions in the project.

## Option 3: Update Code to Use Secrets Properly

If you want to use Firebase Secrets (recommended for production), you need to:

1. Declare secrets in your function definitions
2. Update the code to access secrets via the secret object

Example:
```typescript
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const generateCompanionName = functions.runWith({
  secrets: [geminiApiKey]
}).https.onCall(async (request) => {
  const GEMINI_API_KEY = geminiApiKey.value();
  // ... rest of function
});
```

## Quick Fix (Easiest)

For now, the easiest solution is **Option 2** - set them as environment variables in the Firebase Console. This will work immediately with your current code.

