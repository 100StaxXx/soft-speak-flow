
# Add "Import All Contacts" with Permission Request

## Problem

Currently, the phone contacts import flow:
1. Opens the picker dialog
2. Auto-fetches contacts (which requests permission silently)
3. Shows "0 found" if permission is denied (confusing!)
4. Requires manually selecting each contact

Users want to:
1. See a clear permission request before importing
2. Have an "Import All" option to quickly import everything

## Solution

Add a permission request step that shows before fetching contacts, and add an "Import All" button alongside "Select All" for faster bulk imports.

## Changes

### 1. Create `ContactsPermissionDialog.tsx`

A new dialog component (similar to `PermissionRequestDialog`) specifically for contacts access:

| State | Display |
|-------|---------|
| Prompt | "Import Contacts?" with explanation and "Allow Access" button |
| Denied | "Contacts Access Blocked" with instructions to enable in Settings |

### 2. Update `PhoneContactsPicker.tsx`

| Change | Description |
|--------|-------------|
| Add permission check state | Check permission before auto-fetching |
| Show permission dialog first | If permission not granted, show request dialog |
| Add "Import All" button | Quick action to import all non-duplicate contacts |
| Fix error state bug | Return the error from `fetchContacts` directly instead of checking stale state |

**New Flow:**

```text
Dialog Opens
     |
     v
Check Permission
     |
     +--> Granted --> Fetch Contacts --> Show Selection
     |
     +--> Prompt --> Show Permission Dialog --> Request --> Granted --> Fetch
     |                                                  |
     |                                                  +--> Denied --> Show Error
     |
     +--> Denied --> Show "Enable in Settings" Message
```

**New "Import All" button:**
- Appears alongside "Select All" checkbox
- One tap to import all non-duplicate contacts
- Disabled if all contacts are duplicates

### 3. Update `usePhoneContacts.ts`

| Change | Description |
|--------|-------------|
| Return error from fetchContacts | Make the function return both contacts and error state |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/contacts/ContactsPermissionDialog.tsx` | New file - permission request UI |
| `src/components/contacts/PhoneContactsPicker.tsx` | Add permission flow + Import All button |
| `src/hooks/usePhoneContacts.ts` | Improve error handling in fetchContacts |

## Result

1. When user taps the phone import button, they see a friendly permission request first
2. Clear messaging if permission is denied (not just "0 found")
3. "Import All" button for one-tap bulk import
4. Better UX that explains why contacts access is needed

