# Gemini API Direct Integration Guide

This guide shows how to migrate from Lovable AI Gateway to direct Gemini API calls.

## Environment Variable

Set your Gemini API key in Firebase Functions:

```bash
firebase functions:secrets:set GEMINI_API_KEY
# When prompted, paste: AIzaSyCylcLYCVyGjG_7PRnLgr7vSLpHmfap-WY
```

Or for local development, add to `.env`:
```
GEMINI_API_KEY=AIzaSyCylcLYCVyGjG_7PRnLgr7vSLpHmfap-WY
```

## API Format Differences

### Old (Lovable AI Gateway)
```typescript
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User prompt' }
    ],
  }),
});

const data = await response.json();
const content = data.choices[0].message.content;
```

### New (Direct Gemini API)
```typescript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: 'System prompt\n\nUser prompt' }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    }),
  }
);

const data = await response.json();
const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
```

## Key Changes

1. **Endpoint**: Changed from Lovable gateway to Google's API
2. **Authentication**: API key in URL query param instead of Bearer token
3. **Request Format**: `messages` array → `contents` array with `parts`
4. **Response Format**: `choices[0].message.content` → `candidates[0].content.parts[0].text`
5. **System Prompts**: Combine system and user prompts into a single text string

## Available Models

- `gemini-2.0-flash-exp` - Fast, experimental
- `gemini-1.5-flash` - Stable, fast
- `gemini-1.5-pro` - More capable, slower

## Functions to Update

All Supabase Edge Functions in `supabase/functions/generate-*` that use Lovable AI Gateway should be migrated to use direct Gemini API calls.
