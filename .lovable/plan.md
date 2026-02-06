

# Fix: Remove Paywall from Onboarding Flow

## Problem

You're seeing the subscription paywall during onboarding, which blocks new users from completing signup. This is happening because `/onboarding` is wrapped in `ProtectedRoute`, which checks subscription/trial status before rendering the page.

## Root Cause

In `App.tsx` line 283:
```tsx
<Route path="/onboarding" element={<ProtectedRoute requireMentor={false}><Onboarding /></ProtectedRoute>} />
```

`ProtectedRoute` shows `TrialExpiredPaywall` when `hasAccess` is false. Although monetization is currently disabled in `useAccessStatus.ts` (always returns `hasAccess: true`), this creates an unnecessary dependency.

## Solution

Remove `ProtectedRoute` wrapper from the onboarding route. Onboarding should:
1. Only require authentication (which `StoryOnboarding` already handles via `useAuth`)
2. NOT check subscription/trial status (user hasn't even started their trial yet)

## File Changes

| File | Change |
|------|--------|
| `src/App.tsx` | Remove `ProtectedRoute` wrapper from `/onboarding` route |

## Implementation

**Before:**
```tsx
<Route path="/onboarding" element={<ProtectedRoute requireMentor={false}><Onboarding /></ProtectedRoute>} />
```

**After:**
```tsx
<Route path="/onboarding" element={<Onboarding />} />
```

The `StoryOnboarding` component already:
- Checks for authenticated user via `useAuth` hook
- Redirects to `/journeys` if onboarding is already completed
- No subscription/trial check needed during initial signup

## Why This is Safe

- `Onboarding.tsx` just renders `StoryOnboarding`
- `StoryOnboarding` internally uses `useAuth()` to get the user
- If no user is logged in, the auth-related queries will handle it gracefully
- New users during onboarding shouldn't be blocked by paywall logic

## Expected Result

After this change:
- New users can complete onboarding without seeing the subscription paywall
- Trial period starts after onboarding completes (when profile is created)
- Existing paywall logic remains intact for post-onboarding routes

