# Epics & Guilds Feature - Comprehensive Bug Report

## Overview

This report documents all identified bugs, inconsistencies, and potential issues in the Epics and Guilds feature after a thorough code review.

---

## 🔴 CRITICAL BUGS

### 1. Epic Owner Not Added to `epic_members` Table

**Location:** `src/hooks/useEpics.ts` - `createEpic` mutation

**Description:**
When a user creates an epic, they are NOT added to the `epic_members` table. The epic is created with the owner's `user_id`, but no corresponding `epic_members` record is inserted.

**Impact:**
- Owner doesn't appear in the Guild Leaderboard
- Owner's contributions are never tracked (`total_contribution` never increments)
- `GuildMembersSection` shows "Invite others to join your guild" even when the owner exists
- Discord unlock threshold (3+ members) never accounts for the owner
- Member count is always 1 less than actual participants

**Affected Components:**
- `GuildMembersSection.tsx` (line 147: `if (members.length <= 1)`)
- `EpicDiscordSection.tsx` (Discord unlock logic)
- `EpicLeaderboard.tsx` (owner missing from rankings)
- `generate-guild-story` function (member count validation)

**Evidence:**
```typescript
// useEpics.ts - createEpic mutation
// After creating epic, only links habits - never adds owner to epic_members
const { error: linkError } = await supabase
  .from("epic_habits")
  .insert(...)
// Missing: INSERT INTO epic_members (epic_id, user_id) VALUES (epic.id, user.id)
```

---

### 2. Epic Progress Only Updates for Owner's Habits

**Location:** `supabase/migrations/20251129040000_fix_epic_progress_trigger.sql`

**Description:**
The `update_epic_progress` trigger filters by `e.user_id = NEW.user_id`, meaning epic progress is ONLY updated when the epic OWNER completes habits, not when joined members do.

**Impact:**
- Joined members' habit completions don't contribute to epic progress
- Epic `progress_percentage` only reflects owner's activity
- Progress bar and milestone celebrations only trigger for owner's actions

**Evidence:**
```sql
-- Line 22-24 in the trigger
WHERE eh.habit_id = NEW.habit_id
  AND e.status = 'active'
  AND e.user_id = NEW.user_id  -- ❌ This filters to only owner's habits
```

**Expected Behavior:**
Should check if `NEW.user_id` is a member of the epic (either owner or in `epic_members`).

---

### 3. Epic Members Contribution Tracking Not Updated

**Location:** Database triggers and `epic_members` table

**Description:**
The `epic_members` table has a `total_contribution` column that should track member contributions, but there's no trigger to update it when members complete habits.

**Impact:**
- Leaderboard shows 0 contributions for all members
- Guild ranking is meaningless
- No way to track individual member progress within the epic

**Evidence:**
The `total_contribution` column exists but:
```sql
-- From migration: 
total_contribution integer NOT NULL DEFAULT 0,
-- No trigger to increment this when habits are completed
```

**Note:** The `end_date` IS correctly calculated by the `set_epic_end_date` trigger on INSERT.

---

### 4. Duplicate/Conflicting Join Flows

**Location:** 
- `src/pages/SharedEpics.tsx` - Creates a COPY of the epic
- `src/pages/JoinEpic.tsx` and `src/components/JoinEpicDialog.tsx` - Joins the SAME epic

**Description:**
There are two fundamentally different "join" behaviors in the codebase:

1. **SharedEpics.tsx**: Creates a completely NEW epic for the user (copy)
2. **JoinEpic + JoinEpicDialog**: Adds user as member of the EXISTING epic

**Impact:**
- Confusing user experience
- SharedEpics creates orphaned epics not connected to the original
- Users from SharedEpics won't see other members, leaderboards, or shouts

**Evidence:**
```typescript
// SharedEpics.tsx - Creates a COPY
const { data: newEpic } = await supabase
  .from('epics')
  .insert({
    user_id: user.id,  // New epic owned by joining user
    title: originalEpic.title,
    is_public: false  // Not connected to original
  })
```

vs

```typescript
// JoinEpicDialog.tsx - Joins EXISTING epic
const { error: memberError } = await supabase
  .from('epic_members')
  .insert({
    epic_id: epic.id,  // Same epic
    user_id: user.user.id,
  });
```

---

## 🟠 HIGH PRIORITY BUGS

### 5. JoinEpic Page Missing Epic Limit Check

**Location:** `src/pages/JoinEpic.tsx`

**Description:**
The `JoinEpic` page (accessed via direct URL `/join/:code`) doesn't check if the user has reached the MAX_EPICS (2) limit before allowing them to join.

**Impact:**
- Users can potentially exceed the epic limit by using direct join URLs
- `JoinEpicDialog` correctly checks the limit, but the page route bypasses it

**Evidence:**
```typescript
// JoinEpicDialog.tsx has limit check (lines 58-79)
const totalActiveEpics = (ownedEpics?.length || 0) + (joinedEpics?.length || 0);
if (totalActiveEpics >= MAX_EPICS) {
  setEpicLimitReached(true);
  // ...blocks join
}

// JoinEpic.tsx - NO such check before joinEpic.mutate()
```

---

### 6. Guild Story Member Count Mismatch

**Location:** 
- `src/components/GuildStorySection.tsx` 
- `supabase/functions/generate-guild-story/index.ts`

**Description:**
The client and server have different member count thresholds and counting methods:

- **Client (GuildStorySection):** `memberCount >= 2` (from prop passed by parent)
- **Server (generate-guild-story):** Queries `epic_members` table, requires 2+ members

Since owner isn't in `epic_members`, the server always sees 1 fewer member than expected.

**Impact:**
- Guild with owner + 1 member: Client shows "2 members", server sees 1
- Guild stories may fail to generate even when UI shows enough members

---

### 7. Real-time Subscription Channel Name Conflicts

**Location:** Multiple components

**Description:**
Different components use inconsistent channel naming for the same tables:

```typescript
// EpicCard.tsx
.channel(`epic-members-${epic.id}`)

// GuildMembersSection.tsx
.channel(`members-${epicId}`)

// EpicActivityFeed.tsx
.channel('epic-activity-changes')

// GuildActivityFeed uses hook which uses:
.channel(`guild-activity-${epicId}`)
```

**Impact:**
- Potential duplicate subscriptions
- Inconsistent update behavior across components
- Memory leak potential if channels aren't properly cleaned up

---

### 8. `epic_members` RLS Policy Missing Self-View

**Location:** `supabase/migrations/20251124183456_*`

**Description:**
The RLS policy for viewing `epic_members` requires the epic to be public OR the viewer to be the epic owner. It doesn't account for members viewing their own membership record.

**Evidence:**
```sql
CREATE POLICY "Users can view members of epics they're in or public epics"
  ON public.epic_members FOR SELECT
  USING (
    epic_id IN (
      SELECT id FROM public.epics 
      WHERE is_public = true OR user_id = auth.uid()
    )
    -- Missing: OR user_id = auth.uid() for viewing own membership
  )
```

**Impact:**
- Members might not be able to see their own membership in private epics
- Depends on additional policies not shown

---

## 🟡 MEDIUM PRIORITY BUGS

### 9. Progress Calculation Logic Issue

**Location:** `supabase/migrations/20251129040000_fix_epic_progress_trigger.sql`

**Description:**
Progress is calculated as "days with at least 1 habit completed" / target_days × 100.

If an epic has 2 habits but user only completes 1 per day, they still get 100% progress for that day.

**Impact:**
- Users can game the system by completing minimum habits
- Progress doesn't reflect true completion of ALL linked habits

**Evidence:**
```sql
-- Line 36-42: Only checks if habits_completed > 0 for the day
SELECT COUNT(DISTINCT date) INTO days_completed
FROM public.epic_progress_log
WHERE epic_id = epic_record.id
  AND habits_completed > 0  -- Just needs to be > 0, not = habits_total
```

---

### 10. Template Habits Silently Truncated

**Location:** `src/components/CreateEpicDialog.tsx` line 102

**Description:**
When using a template with more than 2 habits, only the first 2 are used with no warning to the user.

**Evidence:**
```typescript
const templateHabits: NewHabit[] = template.habits.slice(0, 2).map(h => ({
  // Only first 2 habits are used
}));
```

**Impact:**
- Users may not realize they're missing habits from the template
- Template design intention is lost

---

### 11. Race Condition in Popularity Increment

**Location:** `src/hooks/useEpicTemplates.ts` line 44-69

**Description:**
The fallback for incrementing template popularity uses read-then-write pattern which has race conditions.

**Evidence:**
```typescript
// If RPC doesn't exist, falls back to:
const { data: template } = await supabase
  .from("epic_templates")
  .select("popularity_count")
  .single();

// Race condition window here - another user could increment

await supabase
  .from("epic_templates")
  .update({ popularity_count: (template.popularity_count || 0) + 1 })
```

---

### 12. SendShoutDrawer Closes Before Mutation Completes

**Location:** `src/components/SendShoutDrawer.tsx` line 49-50

**Description:**
The drawer closes immediately after calling `onSendShout`, not waiting for the mutation to complete.

**Evidence:**
```typescript
const handleSend = () => {
  if (!selectedMessage) return;
  onSendShout(selectedType, selectedMessage);
  setSelectedMessage(null);
  onOpenChange(false);  // ❌ Closes immediately, mutation might still be pending
};
```

**Impact:**
- User doesn't see error messages if shout fails
- Poor UX feedback loop

---

### 13. Missing Auth Check in Guild Activity

**Location:** `src/hooks/useGuildActivity.ts`

**Description:**
The hook uses `useAuth()` but never actually uses the `user` object for any validation.

**Evidence:**
```typescript
export const useGuildActivity = (epicId?: string) => {
  const { user } = useAuth();  // ❌ Declared but never used
  const queryClient = useQueryClient();
  // ...
```

---

### 14. GuildShoutsFeed useEffect Missing Stable Reference

**Location:** `src/components/GuildShoutsFeed.tsx` line 32-47

**Description:**
The `markAsRead` mutation is included in the useEffect dependency comment but the actual array only has specific properties.

**Evidence:**
```typescript
useEffect(() => {
  // ...
  markAsRead.mutate(unreadIds);  // Uses markAsRead
}, [shouts, unreadCount, user?.id, markAsRead]);  
// markAsRead is a mutation object, including it causes re-renders
```

---

## 🟢 LOW PRIORITY / IMPROVEMENTS

### 15. Inconsistent Table Names in GuildActivityFeed

**Location:** `src/components/GuildActivityFeed.tsx`

**Description:**
The `ACTIVITY_CONFIG` references activity types that don't match what's actually in `epic_activity_feed` table based on the trigger.

**Activity types in config:**
- `story_chapter`
- `shout_highlight`
- `postcard_earned`
- `member_joined`
- `streak_milestone`
- `companion_evolved`

**Activity types from trigger:**
- `habit_completed`
- `milestone_reached`
- `joined_epic`

---

### 16. Companion Postcard Generation on Mount

**Location:** `src/components/EpicCard.tsx` lines 101-151

**Description:**
On first render, the component checks from 0 to current progress for milestones. If the user refreshes the page multiple times, this logic runs each time (though server has duplicate prevention).

**Impact:**
- Unnecessary API calls on page load
- Relies on server-side deduplication

---

### 17. Missing Null Check for theme_color

**Location:** `src/components/EpicCard.tsx` line 96

**Description:**
If `theme_color` is null/undefined, casting fails gracefully but logs could show issues.

**Evidence:**
```typescript
const theme = (epic.theme_color || 'heroic') as EpicTheme;
// Works, but TypeScript doesn't guarantee the value is valid
```

---

### 18. Discord Webhook vs Bot Token Confusion

**Location:** 
- `create-discord-channel-for-guild` uses `DISCORD_BOT_TOKEN`
- `post-epic-discord-update` uses `DISCORD_WEBHOOK_URL`

**Description:**
Two different Discord integration patterns are used - one for creating channels (Bot), one for posting updates (Webhook).

**Impact:**
- Both environment variables must be configured
- If only one is set, partial functionality

---

### 19. GuildStorySection Member Count Prop Source

**Location:** `src/components/GuildStorySection.tsx`

**Description:**
The `GuildStorySection` component receives `memberCount` as a prop but it's not clear where this is sourced from or if it's consistently passed.

Looking at the component interface:
```typescript
interface GuildStorySectionProps {
  epicId: string;
  memberCount: number;
}
```

**Impact:**
- If `memberCount` prop isn't passed correctly, story generation might be incorrectly blocked
- Not used in `EpicCard` where other guild features are rendered

---

### 20. Epic Templates incrementPopularity Called Before Dialog Opens

**Location:** `src/components/StarPathsBrowser.tsx` line 37-39

**Description:**
Popularity is incremented when a template is selected, even if the user cancels the epic creation.

**Evidence:**
```typescript
const handleSelectTemplate = (template: EpicTemplate) => {
  incrementPopularity.mutate(template.id);  // ❌ Increments even if user cancels
  onSelectTemplate(template);
};
```

---

## Summary Table

| Bug # | Severity | Component | Type |
|-------|----------|-----------|------|
| 1 | 🔴 Critical | useEpics | Data Integrity |
| 2 | 🔴 Critical | DB Trigger | Logic Error |
| 3 | 🔴 Critical | DB Trigger | Missing Functionality |
| 4 | 🔴 Critical | SharedEpics | Design Flaw |
| 5 | 🟠 High | JoinEpic | Validation |
| 6 | 🟠 High | GuildStory | Count Mismatch |
| 7 | 🟠 High | Multiple | Memory Leak Risk |
| 8 | 🟠 High | RLS Policy | Security |
| 9 | 🟡 Medium | DB Trigger | Logic |
| 10 | 🟡 Medium | CreateEpic | UX |
| 11 | 🟡 Medium | EpicTemplates | Race Condition |
| 12 | 🟡 Medium | SendShoutDrawer | UX |
| 13 | 🟡 Medium | useGuildActivity | Dead Code |
| 14 | 🟡 Medium | GuildShoutsFeed | React Warning |
| 15 | 🟢 Low | GuildActivityFeed | Data Mismatch |
| 16 | 🟢 Low | EpicCard | Performance |
| 17 | 🟢 Low | EpicCard | Type Safety |
| 18 | 🟢 Low | Discord | Config |
| 19 | 🟢 Low | GuildStorySection | Prop Handling |
| 20 | 🟢 Low | StarPathsBrowser | UX |

---

## Recommended Fix Priority

1. **Bug #1** - Add owner to `epic_members` on epic creation (foundational fix)
2. **Bug #2** - Fix trigger to update progress for all members (not just owner)
3. **Bug #3** - Add trigger to increment `total_contribution` when members complete habits
4. **Bug #4** - Consolidate join flows or clearly differentiate SharedEpics vs JoinEpic
5. **Bug #5** - Add epic limit check to JoinEpic page
6. **Bug #6** - Ensure consistent member counting across client/server

---

*Report generated: December 3, 2025*
