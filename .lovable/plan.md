
# Add Apple Sign-In Button to Authentication Page

## Summary

Great news! The Apple Sign-In infrastructure is already fully implemented - the edge function, native plugin integration, and OAuth handler code all exist. We just need to add the Apple Sign-In button back to the UI, which was previously removed.

## Current State

- **Edge function**: `apple-native-auth` - already deployed and working
- **Native plugin**: `@capacitor-community/apple-sign-in` - already installed
- **OAuth handler**: Lines 550-660 in Auth.tsx - complete native and web flows
- **Secrets configured**: `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, etc.
- **Missing**: The actual button in the UI

## What We'll Add

A single Apple Sign-In button that:
- Shows only on iOS devices (native) or as web fallback elsewhere
- Uses Apple's official design guidelines (black button with Apple logo)
- Connects to the existing `handleOAuthSignIn('apple')` function
- Shows a loading spinner when authenticating
- Works for both sign-in AND registration (Apple handles both the same way)

---

## Implementation Plan

### Step 1: Add Apple Sign-In Button to the Form

**File:** `src/pages/Auth.tsx`

Add an Apple Sign-In button after the email/password form, styled with Apple's branding guidelines:

```text
Location: After line 818 (after the main submit button)
```

The button will:
- Display "Sign in with Apple" or "Sign up with Apple" based on mode
- Use a black background with white text/icon (Apple's required style)
- Show loading state when `oauthLoading === 'apple'`
- Be disabled when any auth operation is in progress
- Call the existing `handleOAuthSignIn('apple')` function

### Step 2: Add Visual Divider

Add an "or" divider between the email form and the Apple button to separate the two authentication methods clearly.

---

## UI Layout (After Changes)

```text
┌─────────────────────────────────┐
│         Email Input             │
├─────────────────────────────────┤
│        Password Input           │
│        [Forgot password?]       │
├─────────────────────────────────┤
│   [Confirm Password] (signup)   │
├─────────────────────────────────┤
│    [ Sign In / Get Started ]    │  ← Primary email button
├─────────────────────────────────┤
│           ─── or ───            │  ← New divider
├─────────────────────────────────┤
│    [  Sign in with Apple ]      │  ← New Apple button
├─────────────────────────────────┤
│   Need an account? Sign up      │
│      Continue as Guest          │
└─────────────────────────────────┘
```

---

## Technical Details

### Button Component

```tsx
{/* Apple Sign In - divider and button */}
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-white/20" />
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="bg-transparent px-4 text-white/60">or</span>
  </div>
</div>

<Button
  type="button"
  onClick={() => handleOAuthSignIn('apple')}
  disabled={loading || oauthLoading !== null}
  className="w-full bg-white hover:bg-white/90 text-black font-semibold h-12 text-base flex items-center justify-center gap-3"
>
  {oauthLoading === 'apple' ? (
    <div className="animate-spin h-5 w-5 border-2 border-black/20 border-t-black rounded-full" />
  ) : (
    <>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
      {isLogin ? 'Sign in with Apple' : 'Sign up with Apple'}
    </>
  )}
</Button>
```

### File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Auth.tsx` | Add Apple button + divider after the form submit button (lines ~818-819) |

---

## Safety Considerations

- **Non-breaking**: Only adds UI elements, doesn't modify existing auth logic
- **Graceful fallback**: Web OAuth flow if native plugin unavailable
- **Error handling**: Existing toast notifications for failures
- **Loading states**: Prevents double-submissions

## After Implementation

Once approved and implemented, you should test on:
1. **iOS device via TestFlight** - Native Apple Sign-In sheet should appear
2. **Web browser** - Should redirect to Apple's web OAuth page
