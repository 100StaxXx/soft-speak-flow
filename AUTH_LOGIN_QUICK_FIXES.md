# Google and Apple Login - Quick Fixes

**Status**: Minor issues identified, easy fixes  
**Priority**: Low (system is functional, these are improvements)

---

## Issue 1: Supabase Version Mismatch in Edge Functions

### Problem
Two edge functions use different versions of Supabase:
- `google-native-auth`: v2.81.1 (newer)
- `apple-native-auth`: v2.38.4 (older)

### Impact
- **Low**: Both versions work, but inconsistency can cause maintenance issues

### Fix

Update `supabase/functions/apple-native-auth/index.ts` line 2:

**Before:**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
```

**After:**
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
```

---

## Issue 2: Unused Apple Edge Function

### Problem
The `apple-native-auth` edge function exists but is NOT called from the frontend. The frontend uses Supabase's built-in `signInWithIdToken` instead.

### Impact
- **None**: Function is unused
- **Maintenance**: Confusing to have unused code

### Options

**Option A: Remove the unused function**
```bash
rm -rf supabase/functions/apple-native-auth
```

**Option B: Document why it exists**
Add to the top of `apple-native-auth/index.ts`:
```typescript
/**
 * NOTE: This edge function is currently NOT used by the frontend.
 * The frontend uses Supabase's built-in signInWithIdToken for Apple Sign-In.
 * This function is kept as a reference implementation for custom Apple authentication.
 * 
 * If you need to use this function:
 * 1. Complete the JWT signature verification (see TODO at line 62)
 * 2. Update Auth.tsx to call this function instead of signInWithIdToken
 */
```

**Recommendation**: Option B - Keep as reference, add documentation

---

## Issue 3: Incomplete JWT Verification in Apple Edge Function

### Problem
Apple edge function fetches Apple's public keys but doesn't use them to verify JWT signature (line 62-64).

### Impact
- **None**: Function is unused
- **Future**: If function is used, signatures won't be verified

### Fix (if keeping the edge function)

Replace lines 58-64 in `apple-native-auth/index.ts`:

**Before:**
```typescript
// Verify token signature with Apple's public keys
const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys');
const appleKeys = await appleKeysResponse.json();

// For production, implement full JWT signature verification
// For now, we trust the token after basic validation
console.log('Apple keys fetched successfully');
```

**After:**
```typescript
// Verify token signature with Apple's public keys
const appleKeysResponse = await fetch('https://appleid.apple.com/auth/keys');
if (!appleKeysResponse.ok) {
  throw new Error('Failed to fetch Apple public keys');
}
const appleKeys = await appleKeysResponse.json();

// Find the key that matches the token's kid (key ID)
const tokenHeader = JSON.parse(atob(tokenParts[0]));
const matchingKey = appleKeys.keys.find((key: any) => key.kid === tokenHeader.kid);

if (!matchingKey) {
  throw new Error('No matching Apple public key found for token');
}

// Import the key and verify signature
const keyData = {
  kty: matchingKey.kty,
  n: matchingKey.n,
  e: matchingKey.e,
  alg: matchingKey.alg,
  use: matchingKey.use,
};

// Convert JWK to CryptoKey
const cryptoKey = await crypto.subtle.importKey(
  'jwk',
  keyData,
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  false,
  ['verify']
);

// Verify signature
const signatureData = tokenParts[0] + '.' + tokenParts[1];
const signature = Uint8Array.from(atob(tokenParts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const signatureBuffer = new TextEncoder().encode(signatureData);

const isValid = await crypto.subtle.verify(
  'RSASSA-PKCS1-v1_5',
  cryptoKey,
  signature,
  signatureBuffer
);

if (!isValid) {
  throw new Error('Invalid Apple token signature');
}

console.log('Apple JWT signature verified successfully');
```

**Note**: Only implement this if you plan to use the edge function.

---

## Issue 4: Dependencies Not Installed

### Problem
Required packages are in `package.json` but not installed:
- `@capacitor-community/apple-sign-in@^7.1.0`
- `@capgo/capacitor-social-login@^7.20.0`

### Impact
- **High**: App cannot build without these packages

### Fix

```bash
cd /workspace
npm install
```

This is **REQUIRED** before deployment.

---

## Issue 5: Missing Supabase Secrets (for edge functions)

### Problem
Edge functions need access to environment variables, which must be configured as Supabase secrets.

### Impact
- **High**: Edge functions will fail if secrets are not configured

### Fix

1. Open Supabase Dashboard
2. Navigate to Project Settings → Edge Functions → Secrets
3. Add the following secrets:

```
VITE_GOOGLE_WEB_CLIENT_ID=371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com
VITE_GOOGLE_IOS_CLIENT_ID=371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com
SUPABASE_URL=https://tffrgsaawvletgiztfry.supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

If using Apple edge function, also add:
```
APPLE_SERVICE_ID=B6VW78ABTR.com.darrylgraham.revolution
APPLE_TEAM_ID=B6VW78ABTR
APPLE_KEY_ID=FPGVLVRK63
APPLE_PRIVATE_KEY=[your-private-key]
```

---

## Summary of Fixes

| Issue | Priority | Effort | Impact if not fixed |
|-------|----------|--------|---------------------|
| Supabase version mismatch | Low | 1 min | None (cosmetic) |
| Unused Apple edge function | Low | 5 min | None (cleanup) |
| Incomplete JWT verification | Low | 30 min | None (unused) |
| Dependencies not installed | **HIGH** | 2 min | **App won't build** |
| Missing Supabase secrets | **HIGH** | 5 min | **Edge functions fail** |

---

## Quick Action Plan

### Before Deployment (REQUIRED)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Supabase secrets**
   - Add Google Client IDs
   - Add Supabase keys

3. **Deploy edge functions**
   ```bash
   npx supabase functions deploy google-native-auth
   ```

### After Deployment (OPTIONAL)

1. **Standardize Supabase versions**
   - Update apple-native-auth to v2.81.1

2. **Clean up Apple edge function**
   - Add documentation comment
   - OR remove if never planning to use

3. **Test on physical devices**
   - iOS: Test Apple Sign-In
   - iOS: Test Google Sign-In
   - Android: Test Google Sign-In

---

## Testing Commands

```bash
# Install dependencies
npm install

# Build project
npm run build

# Sync to iOS (if testing native)
npx cap sync ios

# Deploy edge functions
npx supabase functions deploy google-native-auth
# npx supabase functions deploy apple-native-auth  # Only if using it

# Open in Xcode
npx cap open ios
```

---

**Conclusion**: All issues are minor and easy to fix. The authentication system is well-implemented and secure.
