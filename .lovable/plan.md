
# Fix Contacts Runtime Error in Native iOS App

## Problem

The app crashes on TestFlight with:
```
TypeError: Module name, '@capacitor-co...
```

This happens because `usePhoneContacts.ts` has a **top-level import** of `@capacitor-community/contacts`:

```typescript
import { Contacts, PermissionStatus } from '@capacitor-community/contacts';
```

When Vite loads this file, it tries to resolve the module immediately - but since we externalized it for web builds, it can't be found at runtime in the native WebView.

## Root Cause

| Step | What Happens |
|------|--------------|
| 1 | User navigates to Contacts page |
| 2 | `Contacts.tsx` imports `PhoneContactsPicker` |
| 3 | `PhoneContactsPicker` imports `usePhoneContacts` |
| 4 | `usePhoneContacts` tries to import `@capacitor-community/contacts` at top level |
| 5 | Module resolution fails → App crashes before any code runs |

The platform check (`Capacitor.isNativePlatform()`) happens **too late** - the import already failed.

## Solution

Use **dynamic imports** to load the Contacts plugin only when actually needed on native platforms.

### Changes to `src/hooks/usePhoneContacts.ts`

1. Remove the top-level import of `@capacitor-community/contacts`
2. Define a local type for permission status (since we can't import it)
3. Dynamically import the plugin inside each function that uses it
4. Only load the module when `isNative` is true

```typescript
// BEFORE (crashes immediately)
import { Contacts, PermissionStatus } from '@capacitor-community/contacts';

// AFTER (loads only when needed)
type ContactsPermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

const checkPermission = useCallback(async () => {
  if (!isNative) return 'denied';
  
  // Dynamic import - only runs on native
  const { Contacts } = await import('@capacitor-community/contacts');
  const status = await Contacts.checkPermissions();
  // ...
}, [isNative]);
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePhoneContacts.ts` | Remove top-level import, use dynamic imports in callbacks |

## Why This Works

- On **web**: `isNative` is false, functions return early, dynamic import never runs
- On **native iOS**: When contacts are actually accessed, the plugin is loaded dynamically
- The **build** still externalizes the module (via `vite.config.ts`)
- The **runtime** only loads it when actually needed

## Technical Implementation

```text
Before:
  Module Load → Import fails → App crashes

After:
  Module Load → No import → App starts
       ↓
  User opens Contacts → Checks isNative
       ↓
  Native? → Dynamic import → Plugin loads → Works
  Web? → Return early → No import needed
```
