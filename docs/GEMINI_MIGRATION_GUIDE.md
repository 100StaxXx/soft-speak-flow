# Gemini API Migration Guide

This guide documents the migration from Lovable AI Gateway to direct Google Gemini API calls in Firebase Cloud Functions.

## Overview

All Supabase Edge Functions that use Lovable AI Gateway (`https://ai.gateway.lovable.dev`) are being migrated to Firebase Cloud Functions that call the Gemini API directly using your API key.

## Migration Status

### ✅ Completed
- `generateCompanionName` - Companion name generation
- `mentorChat` - Mentor conversation AI
- `generateEvolutionCard` - Evolution card generation

### 🔄 In Progress
- `generate-companion-story` - Companion story generation
- `generate-companion-image` - Companion image generation
- `generate-quotes` - Quote generation
- `generate-daily-missions` - Daily mission generation

### ⏳ Pending
- `generate-weekly-insights`
- `generate-weekly-challenges`
- `generate-smart-notifications`
- `generate-proactive-nudges`
- `generate-reflection-reply`
- `generate-guild-story`
- `generate-cosmic-postcard`
- `generate-cosmic-deep-dive`
- `generate-daily-horoscope`
- `generate-mentor-script`
- `generate-mentor-content`
- `generate-lesson`
- And 20+ more functions...

## Architecture

### Before (Lovable Gateway)
```
Frontend → Supabase Edge Function → Lovable AI Gateway → Gemini API
```

### After (Direct Gemini)
```
Frontend → Firebase Cloud Function → Gemini API (direct)
```

## Shared Utilities

### `functions/src/gemini.ts`
Shared utility for calling Gemini API:
- `callGemini(prompt, systemPrompt?, config?)` - Main function to call Gemini
- `parseGeminiJSON(text)` - Parse JSON from Gemini response (handles markdown code blocks)

### `src/lib/firebase/functions.ts`
Frontend helper for calling Firebase Cloud Functions:
- `callFirebaseFunction(functionName, data)` - Generic function caller
- `mentorChat(data)` - Mentor chat wrapper
- `generateEvolutionCard(data)` - Evolution card wrapper
- `generateCompanionName(data)` - Companion name wrapper

## Migration Pattern

### 1. Create Firebase Cloud Function

```typescript
// functions/src/index.ts
import { callGemini, parseGeminiJSON } from "./gemini";

export const myFunction = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const { param1, param2 } = request.data;

  // Build prompt
  const systemPrompt = "You are a helpful assistant...";
  const userPrompt = `Generate something based on: ${param1}, ${param2}`;

  // Call Gemini
  const response = await callGemini(userPrompt, systemPrompt, {
    temperature: 0.9,
    maxOutputTokens: 2048,
  });

  // Parse if JSON response expected
  const data = parseGeminiJSON(response.text);

  return { result: data };
});
```

### 2. Update Frontend

```typescript
// Before
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { param1, param2 }
});

// After
import { callFirebaseFunction } from "@/lib/firebase/functions";
const data = await callFirebaseFunction("myFunction", { param1, param2 });
```

### 3. Add Helper Function (Optional)

```typescript
// src/lib/firebase/functions.ts
export async function myFunction(data: { param1: string; param2: string }) {
  return callFirebaseFunction<typeof data, { result: any }>("myFunction", data);
}
```

## Environment Variables

### Firebase Functions
Set in Firebase Console → Functions → Configuration:
- `GEMINI_API_KEY` - Your Google Gemini API key

### Frontend
No changes needed - Firebase handles authentication automatically.

## Testing

1. Deploy function:
   ```bash
   firebase deploy --only functions:myFunction
   ```

2. Test locally (if using emulator):
   ```bash
   firebase emulators:start --only functions
   ```

3. Test from frontend:
   ```typescript
   const result = await myFunction({ param1: "test", param2: "data" });
   console.log(result);
   ```

## Common Patterns

### Chat/Conversation Functions
```typescript
const systemPrompt = `You are ${mentorName}...`;
const userPrompt = `User message: ${message}`;
const response = await callGemini(userPrompt, systemPrompt, {
  temperature: 0.8,
  maxOutputTokens: 500,
});
```

### JSON Generation Functions
```typescript
const prompt = `Generate JSON with these fields: {...}`;
const systemPrompt = "Always respond with valid JSON only.";
const response = await callGemini(prompt, systemPrompt);
const data = parseGeminiJSON(response.text);
```

### Multi-step Functions
```typescript
// Step 1: Generate content
const contentResponse = await callGemini(contentPrompt, systemPrompt);

// Step 2: Process content
const processed = await processContent(contentResponse.text);

// Step 3: Generate follow-up
const followUpResponse = await callGemini(
  `Based on: ${processed}...`,
  systemPrompt
);
```

## Error Handling

All functions should handle:
- Authentication errors
- Invalid arguments
- Gemini API errors
- JSON parsing errors
- Rate limiting (if applicable)

Example:
```typescript
try {
  const response = await callGemini(prompt, systemPrompt);
  return { result: response.text };
} catch (error) {
  console.error("Error in myFunction:", error);
  if (error instanceof functions.https.HttpsError) {
    throw error;
  }
  throw new functions.https.HttpsError(
    "internal",
    `Failed: ${error.message}`
  );
}
```

## Rate Limiting

If the original function had rate limiting, implement it in Firestore:
```typescript
// Check rate limit
const rateLimitRef = db.collection("rate_limits").doc(`${userId}_${functionName}`);
const rateLimitDoc = await rateLimitRef.get();
const rateLimit = rateLimitDoc.data();

if (rateLimit && rateLimit.count >= MAX_REQUESTS) {
  throw new functions.https.HttpsError(
    "resource-exhausted",
    "Rate limit exceeded"
  );
}

// Update rate limit
await rateLimitRef.set({
  count: (rateLimit?.count || 0) + 1,
  resetAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000)),
}, { merge: true });
```

## Next Steps

1. Continue migrating functions in priority order
2. Update all frontend calls
3. Remove Supabase Edge Functions after migration
4. Remove Lovable API key from environment variables
5. Update documentation

## Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Functions TypeScript Guide](https://firebase.google.com/docs/functions/typescript)

