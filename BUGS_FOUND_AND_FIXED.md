# Bugs Found and Fixed

## 🔴 Critical Bug #1: Orphaned Edge Function Calls

**Location:** `soft-speak-flow/src/pages/Auth.tsx`

**Issue:** The file was still calling deleted edge functions:
- Line 425: `supabase.functions.invoke('google-native-auth', ...)`
- Line 527: `supabase.functions.invoke('apple-native-auth', ...)`

**Impact:** 
- Native Google/Apple sign-in would fail
- Functions would return 404 errors
- Users couldn't authenticate on native platforms

**Fix:** ✅ Replaced edge function calls with Firebase Auth:
- Google: Now uses `signInWithGoogleCredential()` from Firebase
- Apple: Now uses `signInWithAppleCredential()` from Firebase

**Status:** ✅ Fixed

---

## ⚠️ Bug #2: Incomplete Migration in Duplicate File

**Location:** `soft-speak-flow/src/pages/Auth.tsx`

**Issue:** The file still has Supabase Auth references in:
- OAuth callback handlers (lines 178-223)
- Session check logic (lines 225-262)
- `handlePostAuthNavigation` function signature (expects Session instead of User)

**Impact:**
- OAuth redirects might not work correctly
- Session checks use wrong auth system
- Type mismatches

**Fix Status:** ⚠️ Partially fixed - Edge function calls removed, but other Supabase references remain

**Recommendation:** 
- Option 1: Replace entire file with correct version from `src/pages/Auth.tsx`
- Option 2: Complete the migration by replacing all Supabase Auth references

---

## ✅ Verification

**Checked:**
- ✅ No references to deleted functions in `src/` directory
- ✅ Main `src/pages/Auth.tsx` uses Firebase Auth correctly
- ✅ Cleanup scripts have no syntax errors
- ✅ Config files are valid

**Remaining Issues:**
- ⚠️ `soft-speak-flow/src/pages/Auth.tsx` needs complete migration to Firebase Auth

---

## Next Steps

1. **Complete migration of `soft-speak-flow/src/pages/Auth.tsx`:**
   - Replace OAuth callback handlers with Firebase redirect handling
   - Replace session checks with Firebase auth state listeners
   - Update `handlePostAuthNavigation` to accept User instead of Session

2. **Or delete the duplicate file** if `soft-speak-flow/` is not the active codebase

3. **Test authentication flows** after fixes

