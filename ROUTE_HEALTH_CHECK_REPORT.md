# Route Health Check Report

## Executive Summary

This report identifies route navigation issues, missing pages, data dependency problems, onboarding flow risks, and Mentor tab guard requirements.

---

## 1. Missing Routes (Pages That Don't Exist)

### ❌ `/mood-history` - **BROKEN**
**Status:** Route does not exist, but navigation attempts occur

**Locations:**
- `src/pages/Reflection.tsx` (lines 140, 202) - "View History" button

**Impact:** Users clicking "View History" will hit a 404 page

**Recommendation:** 
- Create `/mood-history` route and page, OR
- Remove/disable the "View History" buttons, OR
- Redirect to an existing page (e.g., `/reflection` with history view)

---

### ❌ `/push-settings` - **BROKEN**
**Status:** Route does not exist, but navigation attempts occur

**Locations:**
- `src/components/DailyContentWidget.tsx` (line 120) - "Settings" button

**Impact:** Users clicking "Settings" in Daily Content Widget will hit a 404 page

**Recommendation:**
- Create `/push-settings` route and page for notification preferences, OR
- Remove the Settings button, OR
- Redirect to `/profile` (where notification settings might be)

---

## 2. Pages That Expect Data That May Not Load

### ⚠️ `/mentor` (Mentor Tab)
**Data Dependencies:**
- `profile.selected_mentor_id` - Required for mentor data
- `companion` - Required for companion features
- `mentor` document from Firestore - Required for mentor image/quote

**Potential Issues:**
- If `selected_mentor_id` is null/undefined, mentor data fetch fails silently
- If companion fails to load, some features may break
- If mentor document doesn't exist, image/quote loading fails

**Current Guards:**
- `enableOnboardingGuard={false}` - **GUARDS DISABLED** when accessed via `/mentor`
- When `enableOnboardingGuard={true}` (via `/`), checks for:
  - Missing mentor → redirects to onboarding
  - Missing companion → redirects to onboarding
  - Incomplete onboarding → redirects to onboarding

**Recommendation:** 
- **Mentor tab SHOULD have data-load guards** even when `enableOnboardingGuard={false}`
- Add explicit checks for `resolvedMentorId` before rendering mentor-dependent content
- Show loading/error states if mentor data fails to load

---

### ⚠️ `/mentor-chat`
**Data Dependencies:**
- `profile.selected_mentor_id` - Required
- `mentor` document - Required

**Current Behavior:**
- Shows loading state while profile/mentor loads
- Shows error state if mentor not found
- Redirects to `/mentor-selection` if no mentor selected

**Status:** ✅ **HANDLED CORRECTLY** - Has proper loading/error states

---

### ⚠️ `/pep-talk/:id`
**Data Dependencies:**
- `pep_talks` document with matching ID

**Current Behavior:**
- If pep talk not found, navigates to `/library`
- Shows loading state while fetching

**Status:** ✅ **HANDLED CORRECTLY** - Has error handling and fallback

---

### ⚠️ `/cosmic/:placement/:sign`
**Data Dependencies:**
- Cosmiq content based on placement and sign parameters

**Status:** ⚠️ **NEEDS VERIFICATION** - Check if content exists for all sign/placement combinations

---

### ⚠️ `/library`
**Data Dependencies:**
- `favorites` collection
- `downloads` collection
- `quotes` collection (for favorite quotes)

**Current Behavior:**
- Uses React Query with proper loading states
- Handles empty states gracefully

**Status:** ✅ **HANDLED CORRECTLY** - Has proper loading/error handling

---

## 3. Onboarding Flow - Potential Deadlocks/Loops

### 🔄 Onboarding Redirect Logic Analysis

**Entry Points:**
1. `/onboarding` - Direct access (protected route, `requireMentor={false}`)
2. `/auth` → `getAuthRedirectPath()` → `/onboarding` (if no profile or incomplete)
3. `/` (Home) → `Index` with `enableOnboardingGuard={true}` → redirects to `/onboarding`
4. `/mentor` → `Index` with `enableOnboardingGuard={false}` → **NO REDIRECT**

**Potential Deadlock Scenarios:**

#### Scenario 1: Profile Creation Race Condition
**Location:** `src/pages/Auth.tsx` (lines 113-122)
- `ensureProfile()` may timeout (10s timeout)
- If timeout occurs, navigation still proceeds with `null` profile
- `getAuthRedirectPath()` may then redirect to `/onboarding`
- If profile creation is still in progress, user may be stuck

**Risk:** ⚠️ **MEDIUM** - Timeout handling exists but may cause confusion

---

#### Scenario 2: Onboarding Completion Check Loop
**Location:** `src/pages/Index.tsx` (lines 194-209)

```typescript
useEffect(() => {
  if (!enableOnboardingGuard) return;
  if (!user || !isReady || !profile) return;
  
  if (profile.onboarding_completed === true) return;
  
  const missingMentor = !resolvedMentorId;
  const explicitlyIncomplete = profile.onboarding_completed === false;
  const missingCompanion = !companion && !companionLoading;
  
  if (missingMentor || explicitlyIncomplete || missingCompanion) {
    navigate("/onboarding");
  }
}, [enableOnboardingGuard, user, isReady, profile, companion, companionLoading, navigate, resolvedMentorId]);
```

**Potential Issues:**
1. If `companionLoading` is stuck in loading state, user may be redirected to onboarding repeatedly
2. If `resolvedMentorId` is null but profile has `onboarding_completed: true`, user may be stuck in loop
3. If onboarding completes but companion creation fails, user may loop between `/onboarding` and `/`

**Risk:** ⚠️ **MEDIUM-HIGH** - Multiple conditions could cause loops

**Recommendation:**
- Add a redirect counter/timeout to prevent infinite loops
- Add explicit check: if `onboarding_completed === true`, don't redirect regardless of other conditions
- Add better error handling for companion creation failures

---

#### Scenario 3: Onboarding Completion Navigation
**Location:** `src/components/onboarding/StoryOnboarding.tsx` (lines 517-545)

**Flow:**
1. User completes onboarding
2. `handleJourneyComplete()` refetches companion and profile
3. Navigates to `/tasks`
4. If refetch fails or data not ready, navigation still proceeds

**Risk:** ⚠️ **LOW** - Navigation proceeds even if data not ready (graceful degradation)

---

#### Scenario 4: Auth Redirect Path Logic
**Location:** `src/utils/authRedirect.ts` (lines 9-39)

**Logic:**
```typescript
if (userProfile?.onboarding_completed) {
  return "/tasks";
}
if (!userProfile || !resolvedMentorId) {
  return "/onboarding";
}
return "/tasks";
```

**Potential Issue:**
- If `onboarding_completed: true` but `selected_mentor_id` is null, user goes to `/tasks`
- `/tasks` may then redirect back if it requires mentor
- Could create a redirect loop

**Risk:** ⚠️ **LOW-MEDIUM** - Depends on `/tasks` page requirements

---

## 4. Mentor Tab Data-Load Guards

### Current State

**Route:** `/mentor` → `Mentor.tsx` → `Index.tsx` with `enableOnboardingGuard={false}`

**Guards Disabled:**
- When `enableOnboardingGuard={false}`, the onboarding check (lines 194-209) is skipped
- This means users can access `/mentor` even if:
  - No mentor selected
  - No companion created
  - Onboarding incomplete

**Current Behavior Without Guards:**
- If `resolvedMentorId` is null, shows "Choose your mentor" UI (lines 238-262)
- If profile/companion still loading, shows loading spinner (lines 212-223)
- If profile doesn't exist, redirects to onboarding (lines 187-192)

**Recommendation:** ✅ **GUARDS ARE APPROPRIATE**

**Reasoning:**
1. The page handles missing mentor gracefully (shows selection UI)
2. Loading states are properly handled
3. New users without profiles are redirected to onboarding
4. The page is designed to work without strict onboarding completion requirements

**However, consider:**
- Adding explicit error boundaries for mentor data fetch failures
- Adding retry logic if mentor document doesn't exist
- Adding fallback UI if companion fails to load

---

## 5. Navigation Patterns Analysis

### useEffect Navigation Hooks

#### ✅ Safe Navigation Patterns

1. **App.tsx** (lines 134-147)
   - Redirects `/` to `/tasks` on initial load
   - Uses `sessionStorage` to prevent multiple redirects
   - **Status:** ✅ Safe

2. **App.tsx** (lines 150-159)
   - Listens for native push navigation events
   - **Status:** ✅ Safe

3. **ProtectedRoute.tsx** (lines 19-24)
   - Redirects to `/auth` if not logged in
   - **Status:** ✅ Safe

4. **Index.tsx** (lines 187-192)
   - Redirects to onboarding if no profile
   - **Status:** ✅ Safe (has proper guards)

#### ⚠️ Potentially Problematic Patterns

1. **Index.tsx** (lines 194-209)
   - Onboarding guard redirect
   - **Risk:** Could loop if conditions not met
   - **Recommendation:** Add redirect counter/timeout

2. **Auth.tsx** (lines 100-178)
   - Complex post-auth navigation with timeouts
   - **Risk:** Multiple navigation attempts possible
   - **Status:** ✅ Has guards (`hasRedirected.current`)

---

## 6. Route-to-Page Mapping Verification

### ✅ All Routes Have Corresponding Pages

| Route | Page File | Status |
|-------|-----------|--------|
| `/auth` | `Auth.tsx` | ✅ Exists |
| `/auth/reset-password` | `ResetPassword.tsx` | ✅ Exists |
| `/onboarding` | `Onboarding.tsx` | ✅ Exists |
| `/` | `Home.tsx` → `Index.tsx` | ✅ Exists |
| `/mentor` | `Mentor.tsx` → `Index.tsx` | ✅ Exists |
| `/profile` | `Profile.tsx` | ✅ Exists |
| `/premium` | `Premium.tsx` | ✅ Exists |
| `/premium/success` | `PremiumSuccess.tsx` | ✅ Exists |
| `/pep-talk/:id` | `PepTalkDetail.tsx` | ✅ Exists |
| `/mentor-selection` | `MentorSelection.tsx` | ✅ Exists |
| `/admin` | `Admin.tsx` | ✅ Exists |
| `/tasks` | `Tasks.tsx` | ✅ Exists |
| `/epics` | `Epics.tsx` | ✅ Exists |
| `/join/:code` | `JoinEpic.tsx` | ✅ Exists |
| `/shared-epics` | `SharedEpics.tsx` | ✅ Exists |
| `/battle-arena` | `BattleArena.tsx` | ✅ Exists |
| `/mentor-chat` | `MentorChat.tsx` | ✅ Exists |
| `/horoscope` | `Horoscope.tsx` | ✅ Exists |
| `/cosmic/:placement/:sign` | `CosmicDeepDive.tsx` | ✅ Exists |
| `/challenges` | `Challenges.tsx` | ✅ Exists |
| `/reflection` | `Reflection.tsx` | ✅ Exists |
| `/library` | `Library.tsx` | ✅ Exists |
| `/pep-talks` | `PepTalks.tsx` | ✅ Exists |
| `/inspire` | Redirects to `/pep-talks` | ✅ Valid redirect |
| `/search` | `Search.tsx` | ✅ Exists |
| `/companion` | `Companion.tsx` | ✅ Exists |
| `/partners` | `Partners.tsx` | ✅ Exists |
| `/account-deletion` | `AccountDeletionHelp.tsx` | ✅ Exists |
| `/terms` | `TermsOfService.tsx` | ✅ Exists |
| `/privacy` | `PrivacyPolicy.tsx` | ✅ Exists |
| `/creator` | `Creator.tsx` | ✅ Exists |
| `/creator/dashboard` | `InfluencerDashboard.tsx` | ✅ Exists |
| `*` (404) | `NotFound.tsx` | ✅ Exists |

### ❌ Routes Referenced But Don't Exist

| Route | Referenced In | Status |
|-------|---------------|--------|
| `/mood-history` | `Reflection.tsx` | ❌ **MISSING** |
| `/push-settings` | `DailyContentWidget.tsx` | ❌ **MISSING** |

---

## 7. Recommendations Summary

### ✅ FIXED

1. **✅ Created `/mood-history` route** - `src/pages/MoodHistory.tsx` created and added to routes
2. **✅ Created `/push-settings` route** - `src/pages/PushSettings.tsx` created and added to routes
3. **✅ Added redirect loop prevention** - Implemented in `src/pages/Index.tsx` with:
   - Redirect counter (max 3 redirects)
   - Time-based throttling (5 second window)
   - Error logging when loop detected
   - Automatic reset when onboarding completes

### High Priority

3. **Add redirect loop prevention** to onboarding guard in `Index.tsx`
   - Add redirect counter (max 3 redirects)
   - Add timeout between redirects
   - Log redirect attempts for debugging

4. **Improve onboarding completion logic**
   - If `onboarding_completed === true`, don't redirect regardless of other conditions
   - Add explicit error handling for companion creation failures

### Medium Priority

5. **Add error boundaries** for mentor data loading in `Index.tsx`
6. **Add retry logic** if mentor document doesn't exist
7. **Verify all sign/placement combinations** work for `/cosmic/:placement/:sign`

### Low Priority

8. **Add analytics** to track navigation failures
9. **Add unit tests** for navigation logic
10. **Document navigation flow** for future developers

---

## 8. Testing Checklist

- [ ] Test navigation to `/mood-history` (currently 404)
- [ ] Test navigation to `/push-settings` (currently 404)
- [ ] Test onboarding flow with slow network (check for loops)
- [ ] Test onboarding completion with companion creation failure
- [ ] Test `/mentor` access without mentor selected
- [ ] Test `/mentor` access with mentor data fetch failure
- [ ] Test auth redirect with profile creation timeout
- [ ] Test all cosmic deep dive sign/placement combinations
- [ ] Test navigation from all entry points to onboarding
- [ ] Test protected routes with expired sessions

---

## Conclusion

The routing system is generally well-structured, but **2 critical missing routes** need immediate attention. The onboarding flow has potential for redirect loops that should be addressed with proper guards and timeouts. The Mentor tab's data-load guards are appropriately configured, but could benefit from additional error handling.

**Overall Health Score: 7/10**

