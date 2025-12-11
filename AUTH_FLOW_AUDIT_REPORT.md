# Authentication Flow End-to-End Audit Report

**Date:** Generated on audit request  
**Scope:** Complete authentication flow trace for Apple, Google, and Email/Password login

---

## Executive Summary

The application has **migrated from Supabase Auth to Firebase Auth** for frontend authentication. However, there are **critical red flags** where Supabase Auth is still being referenced, and **orphaned edge functions** that are no longer used.

---

## 1. Email/Password Authentication Flow

### Files Involved:
1. **`src/pages/Auth.tsx`** (lines 348-398)
   - Entry point: `handleAuth()` function
   - Validates email/password with Zod schema
   - Calls `signIn()` or `signUp()` from Firebase auth

2. **`src/lib/firebase/auth.ts`** (lines 40-53)
   - `signUp()`: Uses `createUserWithEmailAndPassword()` from Firebase
   - `signIn()`: Uses `signInWithEmailAndPassword()` from Firebase
   - `resetPassword()`: Uses `sendPasswordResetEmail()` from Firebase

3. **`src/utils/authRedirect.ts`** (lines 46-90)
   - `ensureProfile()`: Creates profile in Firestore after signup
   - `getAuthRedirectPath()`: Determines redirect path based on profile state

### Flow Diagram:
```
User submits email/password
    ↓
Auth.tsx validates input
    ↓
Firebase Auth: signIn() or signUp()
    ↓
ensureProfile() creates/updates Firestore profile
    ↓
getAuthRedirectPath() determines destination
    ↓
Navigate to /onboarding or /tasks
```

### Status: ✅ **CLEAN** - No Supabase Auth references

---

## 2. Google Login Authentication Flow

### Files Involved:

#### Web Flow:
1. **`src/pages/Auth.tsx`** (lines 446-625)
   - Entry point: `handleOAuthSignIn('google')`
   - Web path: Calls `signInWithGoogle()` from Firebase auth

2. **`src/lib/firebase/auth.ts`** (lines 66-122)
   - `signInWithGoogle()`: Uses `signInWithPopup()` or `signInWithRedirect()` with `GoogleAuthProvider`
   - Falls back to redirect on localhost if popup is blocked

#### Native iOS/Android Flow:
1. **`src/pages/Auth.tsx`** (lines 457-500)
   - Detects native platform
   - Uses `@capgo/capacitor-social-login` plugin
   - Gets `idToken` and `accessToken` from native SDK
   - Calls `signInWithGoogleCredential()` with Firebase

2. **`src/lib/firebase/auth.ts`** (lines 124-136)
   - `signInWithGoogleCredential()`: Uses `GoogleAuthProvider.credential()` and `signInWithCredential()`

### Flow Diagram:
```
User clicks "Continue with Google"
    ↓
┌─────────────────────────────────────┐
│  Web Platform                       │
│  - signInWithGoogle()               │
│  - Firebase popup/redirect          │
└─────────────────────────────────────┘
    OR
┌─────────────────────────────────────┐
│  Native Platform (iOS/Android)      │
│  - SocialLogin.login()              │
│  - Get idToken from native SDK      │
│  - signInWithGoogleCredential()     │
│  - Firebase credential sign-in      │
└─────────────────────────────────────┘
    ↓
ensureProfile() creates/updates profile
    ↓
Navigate to appropriate route
```

### Status: ✅ **CLEAN** - Uses Firebase Auth only

---

## 3. Apple Login Authentication Flow

### Files Involved:

#### Native iOS Flow:
1. **`src/pages/Auth.tsx`** (lines 504-560)
   - Entry point: `handleOAuthSignIn('apple')`
   - Detects iOS native platform
   - Uses `@capacitor-community/apple-sign-in` plugin
   - Generates nonce and hashes it for Apple
   - Gets `identityToken` from native SDK
   - Calls `signInWithAppleCredential()` with Firebase

2. **`src/lib/firebase/auth.ts`** (lines 138-152)
   - `signInWithAppleCredential()`: Uses `OAuthProvider('apple.com')` and `signInWithCredential()`

#### Web Flow:
- **`src/pages/Auth.tsx`** (lines 591-601)
  - Shows error toast: "Please use Apple Sign-In on iOS devices"
  - **NOT IMPLEMENTED** for web

### Flow Diagram:
```
User clicks "Continue with Apple"
    ↓
┌─────────────────────────────────────┐
│  Native iOS Platform                │
│  - SignInWithApple.authorize()      │
│  - Get identityToken from native    │
│  - signInWithAppleCredential()      │
│  - Firebase credential sign-in      │
└─────────────────────────────────────┘
    OR
┌─────────────────────────────────────┐
│  Web Platform                       │
│  - Shows error message              │
│  - NOT IMPLEMENTED                  │
└─────────────────────────────────────┘
    ↓
ensureProfile() creates/updates profile
    ↓
Navigate to appropriate route
```

### Status: ⚠️ **PARTIAL** - Native iOS works, web not implemented

---

## 4. Post-Authentication Flow

### Files Involved:
1. **`src/pages/Auth.tsx`** (lines 98-178)
   - `handlePostAuthNavigation()`: Centralized post-auth logic
   - Ensures profile exists
   - Determines redirect path
   - Handles navigation

2. **`src/utils/authRedirect.ts`**
   - `ensureProfile()`: Creates profile in Firestore if missing
   - `getAuthRedirectPath()`: Returns `/onboarding` or `/tasks` based on profile state

3. **`src/hooks/useAuth.ts`**
   - Manages Firebase auth state
   - Provides `user`, `session`, and `signOut()` function
   - Uses `onAuthStateChanged()` from Firebase

### Status: ✅ **CLEAN** - Uses Firebase Auth

---

## 🔴 RED FLAGS - Critical Issues

### RED FLAG #1: Orphaned Supabase Auth Edge Functions

**Location:** `supabase/functions/apple-native-auth/index.ts` and `supabase/functions/google-native-auth/index.ts`

**Issue:** These edge functions are **NOT being called** by the frontend anymore. They use Supabase Auth to create sessions, but the frontend now uses Firebase Auth directly.

**Evidence:**
- `apple-native-auth/index.ts` (lines 71-74, 227-233): Creates Supabase admin client and uses `supabase.auth.verifyOtp()`
- `google-native-auth/index.ts` (lines 65-67, 171-176): Creates Supabase admin client and uses `supabase.auth.verifyOtp()`
- **Frontend code** (`src/pages/Auth.tsx`): Does NOT call these edge functions - uses Firebase Auth directly

**Impact:** 
- These functions are dead code
- They create confusion about which auth system is in use
- They may still be deployed and consuming resources

**Recommendation:** 
- **DELETE** these edge functions if they're not needed
- OR document them as legacy/hybrid support if intentionally kept

---

### RED FLAG #2: Components Using Supabase Auth for User Verification

**Location:** Three components are still using `supabase.auth.getUser()` instead of Firebase Auth:

1. **`src/components/AskMentorChat.tsx`** (line 97)
   ```typescript
   const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
   ```

2. **`src/components/AdminReferralTesting.tsx`** (line 141)
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   ```

3. **`src/components/JoinEpicDialog.tsx`** (line 59)
   ```typescript
   const { data: user } = await supabase.auth.getUser();
   ```

**Issue:** These components are checking authentication using Supabase Auth, but the app uses Firebase Auth. This will **fail** for users authenticated via Firebase.

**Impact:**
- Authentication checks will fail
- Users may be incorrectly denied access
- Potential security issues

**Recommendation:**
- Replace with `useAuth()` hook from `src/hooks/useAuth.ts`
- Or use `firebaseAuth.currentUser` directly
- Or use `firebaseAuth.onAuthStateChanged()` for reactive checks

---

### RED FLAG #3: Supabase Client Still Configured for Auth

**Location:** `src/integrations/supabase/client.ts` (lines 31-36)

**Issue:** The Supabase client is still configured with auth settings:
```typescript
auth: {
  storage: supabaseStorage,
  persistSession: true,
  autoRefreshToken: true,
}
```

**Impact:**
- May cause confusion
- Unnecessary configuration if auth is not used
- Could lead to accidental use of Supabase Auth

**Recommendation:**
- Remove auth configuration if Supabase Auth is not intentionally hybrid
- Document if this is intentional for database access only

---

## 📋 Complete File Inventory

### Core Authentication Files:
- ✅ `src/pages/Auth.tsx` - Main auth UI and flow orchestration
- ✅ `src/lib/firebase/auth.ts` - Firebase auth functions
- ✅ `src/lib/firebase/firebase.ts` - Firebase initialization
- ✅ `src/utils/authRedirect.ts` - Post-auth navigation logic
- ✅ `src/hooks/useAuth.ts` - Auth state management hook
- ✅ `src/lib/firebase/profiles.ts` - Profile management (Firestore)

### Orphaned/Unused Files:
- 🔴 `supabase/functions/apple-native-auth/index.ts` - **NOT CALLED** by frontend
- 🔴 `supabase/functions/google-native-auth/index.ts` - **NOT CALLED** by frontend

### Files Needing Updates:
- 🔴 `src/components/AskMentorChat.tsx` - Uses `supabase.auth.getUser()`
- 🔴 `src/components/AdminReferralTesting.tsx` - Uses `supabase.auth.getUser()`
- 🔴 `src/components/JoinEpicDialog.tsx` - Uses `supabase.auth.getUser()`

### Supporting Files (Supabase for Database Only):
- ✅ `src/integrations/supabase/client.ts` - Supabase client (for database, not auth)
- ✅ Multiple components using Supabase for database queries (not auth)

---

## ✅ Summary

### What's Working:
1. ✅ Email/Password auth fully migrated to Firebase
2. ✅ Google login (web + native) fully migrated to Firebase
3. ✅ Apple login (native iOS) fully migrated to Firebase
4. ✅ Post-auth flow uses Firebase
5. ✅ Profile management uses Firestore

### What Needs Fixing:
1. 🔴 **CRITICAL:** Three components using `supabase.auth.getUser()` instead of Firebase
2. 🔴 **HIGH:** Orphaned edge functions still using Supabase Auth
3. ⚠️ **MEDIUM:** Apple Sign-In not implemented for web
4. ⚠️ **LOW:** Supabase client still has auth configuration

### Migration Status:
- **Frontend Auth:** ✅ 100% Firebase
- **Backend Auth:** 🔴 Edge functions still use Supabase (but not called)
- **Database:** ✅ Supabase (intentional)
- **Profiles:** ✅ Firestore (intentional)

---

## 🎯 Action Items

### Immediate (Critical):
1. Fix `AskMentorChat.tsx` to use Firebase Auth
2. Fix `AdminReferralTesting.tsx` to use Firebase Auth
3. Fix `JoinEpicDialog.tsx` to use Firebase Auth

### High Priority:
4. Delete or document `apple-native-auth` edge function
5. Delete or document `google-native-auth` edge function

### Medium Priority:
6. Implement Apple Sign-In for web (optional)
7. Clean up Supabase client auth configuration

---

## 📝 Notes

- The app appears to be in a **hybrid state** where:
  - Frontend uses Firebase Auth exclusively
  - Database uses Supabase
  - Profiles use Firestore
  - Some legacy Supabase Auth code remains but is not called

- The orphaned edge functions suggest a **partial migration** where native auth was initially handled via Supabase edge functions, but was later changed to use Firebase directly.

