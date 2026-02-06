

# Fix: Deploy `generate-companion-image` Edge Function

## Problem Identified

The `generate-companion-image` edge function is returning a **404 Not Found** error because it hasn't been deployed:

```text
Error: Failed to send a request to the Edge Function
Network Request: POST /functions/v1/generate-companion-image → Error: Failed to fetch
Direct Test: 404 - "Requested function was not found"
```

The function code exists at `supabase/functions/generate-companion-image/index.ts` (932 lines) and is configured in `config.toml`, but it's not running in the edge environment.

---

## Root Cause

The function was likely never deployed, or a previous deployment failed. The recent work focused on `process-daily-decay` but this function wasn't explicitly redeployed.

---

## Solution

**Deploy the `generate-companion-image` edge function** to make companion creation work again.

This is a zero-code-change fix — the function code is already complete and correct.

---

## What Happens After Deployment

1. User clicks "Begin Your Journey" on onboarding
2. Frontend calls `supabase.functions.invoke('generate-companion-image', { body: {...} })`
3. Edge function generates companion image using Lovable AI gateway
4. Image is uploaded to storage, URL returned
5. Companion is created in database

---

## Verification Steps

After deployment:
1. Navigate to `/onboarding`
2. Complete the onboarding flow (select color, animal, element, story tone)
3. Click "Begin Your Journey"
4. Companion should be created successfully with generated image

