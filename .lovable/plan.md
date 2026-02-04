
# Integrate Lovable Cloud Managed Apple Sign-In

## Summary

You've enabled Apple Sign-In managed by Lovable Cloud - great choice! The button is already in the UI, and the post-auth redirect logic correctly handles new vs. existing users. We just need to wire up the web OAuth flow to use Lovable's managed integration.

## Current State Analysis

| Component | Status |
|-----------|--------|
| Apple button in UI | ✅ Already added |
| Native iOS flow | ✅ Works via Capacitor plugin + edge function |
| Post-auth redirect logic | ✅ New users → onboarding, existing → tasks |
| Web OAuth flow | ⚠️ Needs update for Lovable Cloud |

## How the Redirect Logic Works

Your existing `getAuthRedirectPath` function already handles the new vs. returning user logic perfectly:

```text
User signs in with Apple
        │
        ▼
┌─────────────────────────────┐
│ Fetch profile from database │
└─────────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│ Has profile with onboarding_      │
│ completed = true?                 │
└───────────────────────────────────┘
     │                    │
    YES                  NO
     │                    │
     ▼                    ▼
  /tasks             /onboarding
(existing user)     (new user)
```

---

## Implementation Plan

### Step 1: Configure Lovable Cloud Social Auth

Use the social auth configuration tool to generate the `@lovable.dev/cloud-auth-js` integration module. This creates the `src/integrations/lovable` folder with the proper OAuth helpers.

### Step 2: Update Web OAuth Flow in Auth.tsx

Modify the web fallback path (lines 673-678) to use Lovable's managed OAuth for Apple Sign-In while keeping the native iOS flow unchanged.

**Current code:**
```typescript
const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: getRedirectUrlWithPath('/'),
  },
});
```

**Updated code:**
```typescript
// For Apple on web, use Lovable Cloud managed OAuth
if (provider === 'apple') {
  const { lovable } = await import("@/integrations/lovable");
  const { error } = await lovable.auth.signInWithOAuth("apple", {
    redirect_uri: getRedirectUrl(),
  });
  if (error) throw new Error(error.message);
  return; // Redirect happens automatically
}

// For other providers, use standard Supabase OAuth
const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: getRedirectUrlWithPath('/'),
  },
});
```

---

## Flow Summary After Changes

```text
┌─────────────────────────────────────────────────────────────────┐
│                     User clicks "Sign in with Apple"            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
        Native iOS?                      Web browser?
              │                               │
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────────┐
│ Capacitor Apple plugin  │    │ Lovable Cloud managed OAuth     │
│ + edge function         │    │ lovable.auth.signInWithOAuth()  │
│ (keeps working as-is)   │    │ (uses Lovable's Apple config)   │
└─────────────────────────┘    └─────────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              handlePostAuthNavigation() triggered               │
│                                                                 │
│   → ensureProfile() - creates profile if new user               │
│   → getAuthRedirectPath() - determines destination              │
│       - No profile or onboarding incomplete → /onboarding       │
│       - Onboarding complete → /tasks                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/integrations/lovable/` | Generated automatically by social auth tool |
| `src/pages/Auth.tsx` | Update web OAuth section (~line 673) to use Lovable Cloud for Apple |

## Testing Recommendations

After implementation:
1. **Web browser**: Click Apple Sign-In → should redirect to Apple's OAuth page
2. **New user**: Complete Apple auth → should land on `/onboarding`
3. **Existing user**: Sign in again → should land on `/tasks`
4. **iOS TestFlight**: Native Apple sheet should still work as before
