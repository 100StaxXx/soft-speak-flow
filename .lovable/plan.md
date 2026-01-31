

# Sync Contacts with Phone Contacts

## Overview

Yes! You can sync contacts from your phone's native contacts into the app. Since Cosmiq is an iOS-native app using Capacitor, we can use a Capacitor contacts plugin to access the device's contact list.

## What This Will Do

| Feature | Description |
|---------|-------------|
| Import from Phone | Pull contacts from your iPhone's Contacts app |
| Permission Request | App will ask for contacts access permission |
| Selective Import | Choose which contacts to import (or import all) |
| Duplicate Detection | Skip contacts that already exist in the app |
| Merge Data | Map phone contact fields → app contact fields |

---

## Implementation Plan

### Part 1: Install Capacitor Contacts Plugin

Install the `@capawesome-team/capacitor-contacts` plugin (the most actively maintained option):

```bash
npm install @capawesome-team/capacitor-contacts
npx cap sync ios
```

### Part 2: Add iOS Permission

Update `Info.plist` with the contacts permission description:

```xml
<key>NSContactsUsageDescription</key>
<string>We use your contacts to help you quickly add people to your network without typing their information manually.</string>
```

### Part 3: Create Phone Contacts Hook

New file: `src/hooks/usePhoneContacts.ts`

This hook will:
- Check/request contacts permission
- Fetch all or specific contacts from the phone
- Format phone contacts to match our database schema

```text
Phone Contact Fields → App Contact Fields
├── givenName + familyName → name
├── emailAddresses[0] → email
├── phoneNumbers[0] → phone
├── organizationName → company
├── jobTitle → role
└── image (optional) → avatar_url
```

### Part 4: Add Import UI

Update the Contacts page with:

1. **"Import from Phone" button** - Shows on empty state and in header
2. **Contact picker modal** - Select which contacts to import
3. **Import progress** - Show progress during bulk import
4. **Duplicate handling** - Skip or update existing matches by phone/email

### Visual Flow

```text
┌────────────────────────────────┐
│  NO CONTACTS YET               │
│                                │
│  [+ Add Contact]               │
│                                │
│  ── or ──                      │
│                                │
│  [📱 Import from Phone]        │  ← NEW
└────────────────────────────────┘

User taps "Import from Phone"
          ↓
┌────────────────────────────────┐
│  SELECT CONTACTS               │
│                                │
│  [✓] Select All (147)          │
│                                │
│  ☐ John Smith                  │
│  ☑ Jane Doe                    │
│  ☑ Bob Johnson                 │
│  ...                           │
│                                │
│  [Import 2 Contacts]           │
└────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `package.json` | Add `@capawesome-team/capacitor-contacts` |
| `ios/App/App/Info.plist` | Add `NSContactsUsageDescription` |
| `src/hooks/usePhoneContacts.ts` | **New** - Hook for native contacts access |
| `src/components/contacts/PhoneContactsPicker.tsx` | **New** - Modal to select contacts |
| `src/components/contacts/ContactsEmptyState.tsx` | Add "Import from Phone" button |
| `src/pages/Contacts.tsx` | Add import button and connect picker |

---

## Technical Notes

- **iOS Only**: The plugin works on native iOS. On web, the import button will be hidden
- **Permission Handling**: If user denies permission, show helpful message with settings link
- **Duplicate Check**: Match by phone number OR email to prevent duplicates
- **Batch Import**: Use batch insert for performance on large contact lists

---

## After Implementation

You'll need to:
1. Pull the code changes
2. Run `npm install` to get the new plugin
3. Run `npx cap sync ios` to sync native dependencies  
4. Open Xcode and rebuild the app

