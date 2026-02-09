
# Outlook Calendar Integration: Auto-Sync + Per-Quest Control

## Overview

Add Outlook Calendar sync with **two modes** users can choose from:
- **Option A (Auto-Sync)**: All scheduled quests automatically appear in Outlook
- **Option B (Per-Quest)**: Individual "Send to Calendar" toggle on each quest

Users who don't care about this feature will never see it - the option only appears in Settings > Preferences.

---

## User Experience Flow

### Settings Screen (Opt-In)

**Location**: Profile page > Preferences tab

```text
┌─────────────────────────────────────────────────┐
│ 📅 Calendar Integrations                        │
│ Sync quests with your external calendars        │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌───────────────┐  ┌───────────────┐           │
│ │ 📫 Outlook    │  │ 📆 Google     │           │
│ │ Not Connected │  │ Connected ✓   │           │
│ │  [Connect]    │  │  [Manage]     │           │
│ └───────────────┘  └───────────────┘           │
│                                                 │
│ When connected, choose sync behavior:          │
│                                                 │
│ ○ Auto-sync all scheduled quests               │
│ ○ Choose per-quest (manual control)            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Per-Quest Toggle (When Manual Mode Selected)

In the **TaskAdvancedEditSheet**, add a new toggle:

```text
┌─────────────────────────────────────────────────┐
│ 📫 Sync to Outlook                              │
│                                       [Toggle]  │
│ This quest will appear in your Outlook calendar │
└─────────────────────────────────────────────────┘
```

Only visible when:
1. Outlook is connected
2. User has chosen "per-quest" sync mode
3. Quest has a scheduled date/time

---

## Technical Implementation

### Database Changes

**Add column to `daily_tasks` table:**

```sql
ALTER TABLE daily_tasks
ADD COLUMN sync_to_outlook BOOLEAN DEFAULT false;

ALTER TABLE daily_tasks
ADD COLUMN outlook_event_id TEXT DEFAULT NULL;
```

**Add column to `user_calendar_connections` table:**

```sql
ALTER TABLE user_calendar_connections
ADD COLUMN sync_mode TEXT DEFAULT 'auto' CHECK (sync_mode IN ('auto', 'manual'));
```

---

### New Edge Functions

#### 1. `outlook-calendar-auth`

Handles OAuth 2.0 flow with Microsoft Entra:

| Action | Description |
|--------|-------------|
| `get_auth_url` | Generate Microsoft OAuth URL |
| `exchange_code` | Exchange auth code for tokens |
| `refresh_token` | Refresh expired access token |
| `disconnect` | Remove connection and revoke access |
| `status` | Check connection health |

**Microsoft Graph Scopes:**
- `Calendars.ReadWrite` (create/update/delete events)
- `User.Read` (get email for display)
- `offline_access` (refresh token support)

#### 2. `outlook-calendar-events`

Handles event CRUD with Microsoft Graph API:

| Action | Description |
|--------|-------------|
| `sync` | Fetch events from Outlook to cache (for calendar view) |
| `create_event` | Push quest to Outlook calendar |
| `update_event` | Update synced quest in Outlook |
| `delete_event` | Remove synced event from Outlook |
| `push_all` | Sync all today's quests (for auto-mode) |

**API Endpoint:** `https://graph.microsoft.com/v1.0/me/calendar/events`

---

### New Frontend Files

| File | Purpose |
|------|---------|
| `src/hooks/useOutlookCalendarConnection.ts` | Hook for Outlook connection state |
| `src/components/CalendarIntegrationsSettings.tsx` | Settings card for both providers |
| `src/pages/OutlookCalendarCallback.tsx` | OAuth callback handler |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | Add CalendarIntegrationsSettings to Preferences tab |
| `src/App.tsx` | Add `/outlook-callback` route |
| `src/features/tasks/components/TaskAdvancedEditSheet.tsx` | Add "Sync to Outlook" toggle |
| `src/hooks/useTaskMutations.ts` | Call Outlook sync on task create/update (if auto-mode) |
| `supabase/config.toml` | Register new edge functions |

---

## Implementation Plan

### Phase 1: Backend Infrastructure

1. **Request Microsoft secrets** (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)
2. **Create `outlook-calendar-auth` edge function**
   - OAuth flow mirroring Google Calendar implementation
   - Token storage in `user_calendar_connections` with `provider: 'outlook'`
3. **Create `outlook-calendar-events` edge function**
   - CRUD operations for calendar events
   - Caching to `external_calendar_events` table

### Phase 2: Settings UI

4. **Create `CalendarIntegrationsSettings.tsx`**
   - Provider cards for Google and Outlook
   - Sync mode selector (auto vs manual)
   - Last synced timestamp display
5. **Create `useOutlookCalendarConnection.ts` hook**
   - Mirror of Google Calendar hook
6. **Add to Profile.tsx**
   - Import and render in Preferences tab
7. **Create OAuth callback page**
   - Route: `/outlook-callback`

### Phase 3: Per-Quest Sync Toggle

8. **Add database column**
   - `sync_to_outlook` boolean on `daily_tasks`
   - `outlook_event_id` for tracking synced events
9. **Update TaskAdvancedEditSheet.tsx**
   - Add "Sync to Outlook" toggle (conditional on connection + manual mode)
10. **Update task mutations**
    - On save: if toggle is on, call `outlook-calendar-events` to create/update event
    - Store returned event ID for future updates/deletes

### Phase 4: Auto-Sync Mode

11. **Hook task creation/update**
    - When auto-mode is enabled and quest has scheduled time
    - Automatically push to Outlook
12. **Handle task deletion**
    - Remove from Outlook when task is deleted
13. **Handle task completion**
    - Optionally mark as completed in Outlook (or leave as-is)

---

## Secrets Required

| Secret | Where to Get It |
|--------|-----------------|
| `MICROSOFT_CLIENT_ID` | Azure Portal > App registrations |
| `MICROSOFT_CLIENT_SECRET` | Azure Portal > App > Certificates & secrets |

**Azure Setup Steps:**
1. Go to Azure Portal > Microsoft Entra ID > App registrations
2. New registration: "Cosmiq Calendar Sync"
3. Supported account types: "Personal Microsoft accounts only" (or multi-tenant)
4. Redirect URI: `https://alilpush.lovable.app/outlook-callback`
5. API permissions: Add `Calendars.ReadWrite`, `User.Read`, `offline_access`
6. Create client secret and save both values

---

## Privacy-First Design

- **Opt-in only**: Feature hidden in Settings, never prompted unprompted
- **Per-quest control**: Users decide exactly what syncs
- **Clear disconnect**: One-click removal of connection
- **No surprise syncs**: Auto-mode clearly explained before enabling
- **Data isolation**: Outlook events cached locally, not shared

---

## Summary

This implementation gives users complete flexibility:
- Connect Outlook only if they want it
- Choose auto-sync for convenience OR manual control for privacy
- Never see calendar options if they don't connect
- Easy disconnect at any time

The architecture mirrors the existing Google Calendar integration, making the codebase consistent and maintainable.
