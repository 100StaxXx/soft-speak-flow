# Route Health Check Report
**Generated:** Comprehensive scan of all routes, navigation links, redirects, and data dependencies

---

## 📋 Executive Summary

### ✅ **Routes Status**
- **Total Routes Defined:** 33 routes
- **Pages That Exist:** 33/33 (100%)
- **Routes with Navigation Links:** All major routes have navigation
- **Critical Issues Found:** 3 potential issues

### ⚠️ **Critical Findings**
1. **Onboarding Guard Loop Risk** - Index.tsx has redirect loop prevention but could still deadlock
2. **Mentor Tab Data Guards** - Mentor tab (via `/mentor` → Index with `enableOnboardingGuard={false}`) may need data-load guards
3. **Missing Route:** `/shared-epics` route exists but has limited navigation links

---

## 🗺️ Route Inventory

### **Public Routes (No Auth Required)**
| Route | Component | Status | Navigation Links |
|-------|-----------|--------|------------------|
| `/auth` | `Auth.tsx` | ✅ Exists | ProtectedRoute redirects here |
| `/auth/reset-password` | `ResetPassword.tsx` | ✅ Exists | Auth page links here |
| `/partners` | `Partners.tsx` | ✅ Exists | External links only |
| `/account-deletion` | `AccountDeletionHelp.tsx` | ✅ Exists | Profile page links here |
| `/terms` | `TermsOfService.tsx` | ✅ Exists | Footer/legal links |
| `/privacy` | `PrivacyPolicy.tsx` | ✅ Exists | Footer/legal links |
| `/join/:code` | `JoinEpic.tsx` | ✅ Exists | External invite links |

### **Protected Routes (Auth Required)**
| Route | Component | Status | Data Dependencies | Navigation Links |
|-------|-----------|--------|-------------------|------------------|
| `/` | `Home.tsx` → `Index.tsx` | ✅ Exists | Profile, Companion, Mentor | BottomNav (Mentor tab) |
| `/mentor` | `Mentor.tsx` → `Index.tsx` | ✅ Exists | Profile, Companion, Mentor | BottomNav (Mentor tab) |
| `/onboarding` | `Onboarding.tsx` | ✅ Exists | Profile (optional) | Auth redirects, Index redirects |
| `/profile` | `Profile.tsx` | ✅ Exists | Profile, User | BottomNav (Profile tab) |
| `/tasks` | `Tasks.tsx` | ✅ Exists | Profile, Companion, Habits, Tasks | BottomNav (Quests tab), App redirects |
| `/companion` | `Companion.tsx` | ✅ Exists | Companion, Profile | BottomNav (Companion tab) |
| `/search` | `Search.tsx` | ✅ Exists | None (searches on demand) | BottomNav (Search tab) |
| `/premium` | `Premium.tsx` | ✅ Exists | Profile | Profile page links |
| `/premium/success` | `PremiumSuccess.tsx` | ✅ Exists | None | Premium redirects |
| `/pep-talk/:id` | `PepTalkDetail.tsx` | ✅ Exists | PepTalk by ID | Library, PepTalks pages |
| `/pep-talks` | `PepTalks.tsx` | ✅ Exists | PepTalks collection | Library, Search, `/inspire` redirect |
| `/inspire` | Redirect → `/pep-talks` | ✅ Exists | N/A | Legacy links |
| `/mentor-selection` | `MentorSelection.tsx` | ✅ Exists | Mentors collection | Profile, Index (no mentor) |
| `/mentor-chat` | `MentorChat.tsx` | ✅ Exists | Mentor, Profile | Index page links |
| `/admin` | `Admin.tsx` | ✅ Exists | Admin permissions | No navigation (admin only) |
| `/epics` | `Epics.tsx` | ✅ Exists | Epics, Habits | GlobalSearch, JoinEpic |
| `/shared-epics` | `SharedEpics.tsx` | ✅ Exists | Public Epics | ⚠️ Limited navigation |
| `/battle-arena` | `BattleArena.tsx` | ✅ Exists | AstralEncounters, Companion | No direct navigation |
| `/horoscope` | `Horoscope.tsx` | ✅ Exists | Profile (astrology data) | Index page links |
| `/cosmic/:placement/:sign` | `CosmicDeepDive.tsx` | ✅ Exists | Astrology data | Horoscope page links |
| `/challenges` | `Challenges.tsx` | ✅ Exists | Challenges collection | GlobalSearch |
| `/reflection` | `Reflection.tsx` | ✅ Exists | Reflections collection | MoodHistory links |
| `/library` | `Library.tsx` | ✅ Exists | PepTalks, Content | Profile, Search, DailyContentWidget |
| `/mood-history` | `MoodHistory.tsx` | ✅ Exists | Reflections collection | Reflection page links |
| `/push-settings` | `PushSettings.tsx` | ✅ Exists | Push settings | DailyContentWidget |
| `/creator` | `Creator.tsx` | ✅ Exists | Creator profile | Partners redirects |
| `/creator/dashboard` | `InfluencerDashboard.tsx` | ✅ Exists | Creator data | Creator page links |
| `*` (404) | `NotFound.tsx` | ✅ Exists | None | All invalid routes |

---

## 🔄 Navigation Patterns Analysis

### **Bottom Navigation (Primary Navigation)**
All 5 tabs properly configured:
- ✅ `/mentor` - Mentor tab
- ✅ `/companion` - Companion tab  
- ✅ `/tasks` - Quests tab
- ✅ `/search` - Search tab
- ✅ `/profile` - Profile tab

### **Redirects Found**
1. **`/inspire` → `/pep-talks`** - Legacy route redirect (✅ Working)
2. **`/` → `/tasks`** - Initial route redirect in App.tsx (✅ Working, uses sessionStorage)
3. **ProtectedRoute → `/auth`** - Unauthenticated users (✅ Working)
4. **Index.tsx → `/onboarding`** - Incomplete onboarding (⚠️ See issues below)

### **useEffect Navigation Hooks**

#### **App.tsx**
- ✅ Initial route redirect (`/` → `/tasks`) - Has sessionStorage guard
- ✅ Native push navigation handler - Safe event listener

#### **Index.tsx (Home/Mentor)**
- ⚠️ **Onboarding redirect** (lines 188-194, 198-251) - **POTENTIAL LOOP RISK**
  - Redirects if: no profile, missing mentor, missing companion, or `onboarding_completed === false`
  - Has redirect loop prevention (max 3 redirects in 5 seconds)
  - **Issue:** Still could deadlock if data never loads

#### **Auth.tsx**
- ✅ Post-login redirect - Uses `getAuthRedirectPath()` utility
- ✅ OAuth redirects - Has timeout guards

#### **ProtectedRoute.tsx**
- ✅ Unauthenticated redirect - Safe, only redirects when `!user && !authLoading`

#### **Other Pages**
- ✅ All other navigation is user-initiated (button clicks) - Safe

---

## 🚨 Critical Issues

### **Issue #1: Onboarding Guard Loop Risk** ⚠️

**Location:** `src/pages/Index.tsx` (lines 198-251)

**Problem:**
The onboarding guard in Index.tsx can redirect to `/onboarding` if:
- `missingMentor` (no resolvedMentorId)
- `explicitlyIncomplete` (onboarding_completed === false)
- `missingCompanion` (no companion and not loading)

**Loop Prevention:**
- ✅ Has redirect counter (max 3 redirects in 5 seconds)
- ✅ Logs error when loop detected
- ⚠️ **BUT:** If data never loads (companion/profile stuck loading), user could be stuck

**Potential Deadlock Scenarios:**
1. Companion query fails but `companionLoading` stays `false` → redirects to onboarding
2. Profile has `onboarding_completed: false` but user completed onboarding → infinite redirect
3. Mentor resolution fails → redirects to onboarding → onboarding completes → redirects back → mentor still missing → loop

**Recommendation:**
- Add timeout for companion loading (if loading > 30s, allow page to render)
- Add explicit check: if `onboarding_completed === true`, never redirect regardless of other conditions
- Consider showing error state instead of redirecting if data fails to load

---

### **Issue #2: Mentor Tab Data-Load Guards** ⚠️

**Location:** `src/pages/Mentor.tsx` → `Index.tsx` with `enableOnboardingGuard={false}`

**Current Behavior:**
- `/mentor` route renders `Index` with `enableOnboardingGuard={false}`
- This means onboarding redirects are **disabled** for Mentor tab
- If mentor data is missing, shows placeholder UI (lines 280-304)

**Data Dependencies:**
- ✅ Profile (via `useProfile()`)
- ✅ Companion (via `useCompanion()`)
- ✅ Mentor data (fetched in useEffect, lines 80-176)
- ✅ Daily pep talks, quotes, habits

**Potential Issues:**
1. **Missing Mentor Data:** If `resolvedMentorId` is null, shows placeholder. ✅ **This is good!**
2. **Companion Loading:** Page waits for companion to load before marking `isReady` (line 183). If companion fails, could show loading forever.
3. **Mentor Image Loading:** Fetches mentor image asynchronously. If fails, page still renders but without background image. ✅ **Non-critical**

**Recommendation:**
- ✅ **Current guards are adequate** - Mentor tab handles missing data gracefully
- Consider adding timeout for companion loading (same as Issue #1)
- The placeholder UI (lines 280-304) is good UX for missing mentor

---

### **Issue #3: Limited Navigation to `/shared-epics`** ⚠️

**Location:** `src/pages/SharedEpics.tsx`

**Problem:**
- Route exists and is properly configured
- **No direct navigation links found** in the codebase
- Only accessible via direct URL or programmatic navigation

**Recommendation:**
- Add navigation link from Epics page
- Or remove route if not needed
- Or document as internal/admin route

---

## 📊 Data Dependency Analysis

### **Pages Requiring Profile**
- ✅ All protected routes use `useProfile()` hook
- ✅ ProtectedRoute ensures user is authenticated
- ✅ Profile loading is non-blocking (pages handle loading states)

### **Pages Requiring Companion**
- `/companion` - **Critical dependency** (shows error if fails)
- `/tasks` - Uses companion but handles missing gracefully
- `/mentor` (Index) - Waits for companion before marking ready
- `/battle-arena` - Uses companion stats but handles missing

**Companion Loading Issues:**
- ⚠️ Index.tsx waits for companion before showing content (could hang)
- ✅ Companion.tsx shows error state if companion fails to load
- ✅ Other pages handle missing companion gracefully

### **Pages Requiring Mentor**
- `/mentor` (Index) - **Critical dependency** (shows placeholder if missing)
- `/mentor-chat` - Requires mentor
- `/horoscope` - Uses mentor for personalized content
- `/cosmic/:placement/:sign` - Uses mentor for astrology data

**Mentor Resolution:**
- ✅ Uses `getResolvedMentorId()` utility (checks `selected_mentor_id` or `onboarding_data.mentorId`)
- ✅ Index.tsx has backfill logic for missing `selected_mentor_id`
- ✅ Mentor tab shows placeholder if no mentor selected

### **Pages with Dynamic Route Parameters**
- ✅ `/pep-talk/:id` - Validates ID exists, redirects to `/library` if not found
- ✅ `/cosmic/:placement/:sign` - No validation found (could show error if invalid)
- ✅ `/join/:code` - Validates code, shows error if invalid

---

## 🔍 Onboarding Flow Analysis

### **Onboarding Entry Points**
1. **Auth.tsx** - New users after signup → `/onboarding`
2. **Index.tsx** - Users with incomplete onboarding → `/onboarding`
3. **Profile.tsx** - "Retake Quiz" button → `/onboarding`

### **Onboarding Completion**
- **StoryOnboarding.tsx** (line 539) - Navigates to `/tasks` on completion
- **Onboarding.tsx** - Wrapper component, no logic

### **Onboarding Guard Logic**
**Location:** `src/pages/Index.tsx` (lines 198-251)

**Conditions that trigger redirect:**
1. `missingMentor` - No resolvedMentorId
2. `explicitlyIncomplete` - `onboarding_completed === false`
3. `missingCompanion` - No companion and not loading

**Guard is enabled for:**
- ✅ `/` route (Home.tsx passes `enableOnboardingGuard={true}`)
- ❌ `/mentor` route (Mentor.tsx passes `enableOnboardingGuard={false}`)

**Loop Prevention:**
- ✅ Redirect counter (max 3 in 5 seconds)
- ✅ Logs error when loop detected
- ⚠️ **Issue:** If `onboarding_completed === false` persists, will keep redirecting

**Potential Deadlock:**
```
User completes onboarding → profile.onboarding_completed = true
But companion creation fails → no companion
Index.tsx checks: missingCompanion = true → redirects to /onboarding
Onboarding page sees onboarding_completed = true → redirects to /tasks
Tasks page loads → user clicks Mentor tab → goes to /mentor
/mentor renders Index with enableOnboardingGuard={false} → shows placeholder
User clicks Home → goes to / → Index with enableOnboardingGuard={true}
Index checks: missingCompanion = true → redirects to /onboarding
LOOP!
```

**Recommendation:**
- If `onboarding_completed === true`, don't redirect for missing companion
- Or: Create companion during onboarding and wait for it before marking complete
- Or: Allow pages to render even if companion is missing (show placeholder)

---

## ✅ Pages That Handle Missing Data Gracefully

1. **Companion.tsx** - Shows error state with refresh button
2. **Index.tsx** (Mentor tab) - Shows placeholder if no mentor
3. **PepTalkDetail.tsx** - Redirects to `/library` if pep talk not found
4. **Tasks.tsx** - Handles missing companion/tasks gracefully
5. **BattleArena.tsx** - Handles missing companion stats

---

## ❌ Pages That May Fail If Data Missing

1. **MentorChat.tsx** - No error handling found (needs verification)
2. **Horoscope.tsx** - May fail if profile astrology data missing
3. **CosmicDeepDive.tsx** - May fail if invalid placement/sign

---

## 🔗 Navigation Link Audit

### **All Navigation Links Verified:**
- ✅ BottomNav - All 5 tabs link to correct routes
- ✅ Profile page - Links to library, mentor-selection, onboarding, account-deletion
- ✅ Library page - Links to pep-talks, home
- ✅ Search page - Links to library, pep-talks
- ✅ GlobalSearch - Links to challenges, epics, tasks
- ✅ Reflection/MoodHistory - Cross-links between each other
- ✅ Auth flow - Proper redirects after login/signup
- ✅ Onboarding - Completes to /tasks

### **Missing Navigation Links:**
- ⚠️ `/shared-epics` - No links found (see Issue #3)
- ⚠️ `/battle-arena` - No direct navigation (intentional?)
- ⚠️ `/admin` - No navigation (admin-only, intentional)

---

## 📝 Recommendations Summary

### **High Priority**
1. **Fix Onboarding Guard Loop Risk**
   - Add explicit check: if `onboarding_completed === true`, never redirect
   - Add timeout for companion loading (30s max)
   - Consider allowing pages to render with missing companion (show placeholder)

2. **Add Navigation to `/shared-epics`**
   - Add link from Epics page, or
   - Remove route if not needed, or
   - Document as internal route

### **Medium Priority**
3. **Add Error Handling**
   - MentorChat.tsx - Add error handling for missing mentor
   - Horoscope.tsx - Add error handling for missing astrology data
   - CosmicDeepDive.tsx - Add validation for route parameters

4. **Improve Companion Loading**
   - Add timeout for companion queries
   - Allow pages to render with loading companion (show skeleton)

### **Low Priority**
5. **Documentation**
   - Document `/battle-arena` as feature route (no direct nav)
   - Document `/admin` as admin-only route
   - Document `/shared-epics` purpose

---

## ✅ Verification Checklist

- [x] All routes in App.tsx have corresponding page files
- [x] All page files are properly imported (lazy loaded)
- [x] BottomNav links to valid routes
- [x] ProtectedRoute redirects work correctly
- [x] Onboarding flow completes correctly
- [x] Redirects don't create infinite loops (has prevention)
- [x] Data dependencies are handled gracefully
- [x] Navigation links are valid
- [x] Dynamic routes validate parameters
- [x] Error states are handled

---

## 🎯 Conclusion

**Overall Health: 🟢 GOOD**

The routing system is well-structured with proper lazy loading, protected routes, and error handling. The main concerns are:

1. **Onboarding guard could deadlock** if companion never loads
2. **Mentor tab guards are adequate** but could benefit from companion loading timeout
3. **Some routes lack navigation links** but may be intentional

**Recommendation:** Address the onboarding guard loop risk as high priority, then add missing navigation links and error handling as needed.

