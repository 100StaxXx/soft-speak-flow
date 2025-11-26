# Bug Report: Guild System, Epics System, and Discord Integration

**Date**: November 25, 2025  
**Analyzed Systems**: Guild/Epic Members, Epics, Discord Integration

---

## 🔴 CRITICAL BUGS

### 1. Epic Owner Not Auto-Added to epic_members Table

**Location**: `src/hooks/useEpics.ts` (createEpic mutation)  
**Severity**: Critical  
**Impact**: Guild features don't work for epic creators

**Issue**:
When a user creates a public epic, they are NOT automatically added to the `epic_members` table. This causes several problems:
- Discord unlock threshold doesn't count the owner
- Leaderboard doesn't show the owner
- Member count is incorrect
- Owner can't see their own contributions

**Current Code** (lines 72-86):
```typescript
// Create the epic
const { data: epic, error: epicError } = await supabase
  .from("epics")
  .insert({
    user_id: user.id,
    title: epicData.title,
    description: epicData.description,
    target_days: epicData.target_days,
    is_public: epicData.is_public || false,
    xp_reward: Math.floor(epicData.target_days * 10),
    invite_code: inviteCode,
  })
  .select()
  .single();

if (epicError) throw epicError;
// ❌ Missing: Add creator to epic_members if is_public is true
```

**Fix Required**:
After creating the epic, if `is_public` is true, insert the creator into `epic_members`:
```typescript
if (epicError) throw epicError;

// Add creator as first member for public epics
if (epicData.is_public) {
  const { error: memberError } = await supabase
    .from("epic_members")
    .insert({
      epic_id: epic.id,
      user_id: user.id,
    });
  
  if (memberError) {
    console.error('Failed to add creator as member:', memberError);
  }
}
```

---

### 2. Shared Epics Not Visible to Members

**Location**: `src/hooks/useEpics.ts` (epics query)  
**Severity**: Critical  
**Impact**: Users can't see epics they've joined

**Issue**:
The query only fetches epics where `user_id = current_user`, but members who joined a shared epic won't see it because they're not the owner.

**Current Code** (lines 18-28):
```typescript
const { data, error } = await supabase
  .from("epics")
  .select(`
    *,
    epic_habits(
      habit_id,
      habits(id, title, difficulty)
    )
  `)
  .eq("user_id", user.id)  // ❌ Only shows owned epics
  .order("created_at", { ascending: false });
```

**Fix Required**:
Use a more complex query to include both owned epics AND epics where the user is a member:
```typescript
// Fetch epic IDs where user is a member
const { data: memberEpics } = await supabase
  .from("epic_members")
  .select("epic_id")
  .eq("user_id", user.id);

const memberEpicIds = memberEpics?.map(m => m.epic_id) || [];

// Fetch all relevant epics
const { data, error } = await supabase
  .from("epics")
  .select(`
    *,
    epic_habits(
      habit_id,
      habits(id, title, difficulty)
    )
  `)
  .or(`user_id.eq.${user.id},id.in.(${memberEpicIds.join(',')})`)
  .order("created_at", { ascending: false });
```

---

### 3. Discord Invite URL Missing from Query

**Location**: `supabase/functions/create-discord-channel-for-guild/index.ts`  
**Severity**: High  
**Impact**: Error when trying to return already-created channel info

**Issue**:
Line 86 references `epic.discord_invite_url`, but this field is not included in the SELECT query on line 60.

**Current Code** (line 58-62):
```typescript
const { data: epic, error: epicError } = await supabase
  .from('epics')
  .select('id, title, invite_code, user_id, discord_channel_id, discord_ready')
  // ❌ Missing: discord_invite_url
  .eq('id', epicId)
  .single();
```

**Error on line 86**:
```typescript
return new Response(
  JSON.stringify({ 
    error: 'Discord channel already exists for this epic',
    channelId: epic.discord_channel_id,
    inviteUrl: epic.discord_invite_url  // ❌ undefined - not in query
  }),
```

**Fix Required**:
```typescript
.select('id, title, invite_code, user_id, discord_channel_id, discord_invite_url, discord_ready')
```

---

## ⚠️ MEDIUM SEVERITY BUGS

### 4. Epic Auto-Completion May Be Unwanted

**Location**: `supabase/migrations/20251124171727_781056fe-2991-4776-b46b-4b1eeedbe055.sql`  
**Severity**: Medium  
**Impact**: User experience issue

**Issue**:
The `update_epic_progress()` trigger automatically marks epics as "completed" when progress reaches 100%. This may not align with user intent - they might want to manually complete the epic with ceremony.

**Current Code** (lines 158-161):
```sql
status = CASE 
  WHEN new_progress >= 100 THEN 'completed'
  ELSE 'active'
END,
```

**Recommendation**:
Consider removing auto-completion or adding a flag `auto_complete_enabled` to epics table to let users choose.

---

### 5. Discord Ready Flag Logic Inconsistency

**Location**: `src/components/JoinEpicDialog.tsx`  
**Severity**: Medium  
**Impact**: Discord unlock threshold may be incorrect

**Issue**:
The logic checks if member count >= 3 to unlock Discord, but:
1. It's unclear if this count includes the owner (since bug #1 means owner might not be in epic_members)
2. The check happens AFTER inserting the new member, so timing could be off
3. There's no transaction to prevent race conditions

**Current Code** (lines 80-101):
```typescript
// Check if this brings the epic to 3+ members (Discord unlock threshold)
const { count: totalMembers } = await supabase
  .from('epic_members')
  .select('*', { count: 'exact', head: true })
  .eq('epic_id', epic.id);

// If we just hit the threshold, mark as discord_ready
if (totalMembers && totalMembers >= 3) {
  const { data: currentEpic } = await supabase
    .from('epics')
    .select('discord_ready')
    .eq('id', epic.id)
    .single();
  
  // ❌ Race condition: Two users joining simultaneously could both update
  if (currentEpic && !currentEpic.discord_ready) {
    await supabase
      .from('epics')
      .update({ discord_ready: true })
      .eq('id', epic.id);
    
    console.log('Epic reached 3 members - Discord channel unlocked!');
  }
}
```

**Recommendations**:
1. Use a database function/trigger to auto-update `discord_ready` when epic_members count changes
2. Add a constraint or use transactions to prevent race conditions
3. Clearly document whether owner counts toward the threshold

---

### 6. Habit Duplication on Epic Join

**Location**: `src/components/JoinEpicDialog.tsx`  
**Severity**: Medium  
**Impact**: Could create habits with invalid data

**Issue**:
When joining an epic, habits are duplicated to the new user's account. The code copies `frequency` and `custom_days`, but doesn't validate that the combination is valid.

**Current Code** (lines 104-111):
```typescript
const habitsToCreate = epic.epic_habits.map((eh: any) => ({
  user_id: user.user.id,
  title: eh.habits.title,
  difficulty: eh.habits.difficulty,
  frequency: eh.habits.frequency,  // ❌ What if this is undefined?
  custom_days: eh.habits.custom_days,  // ❌ Could be null when frequency is 'daily'
}));
```

**Potential Issues**:
- If original habit has `frequency: 'daily'` but `custom_days` is null, this could cause issues
- No validation of the habit data before insertion
- Type safety is lost with `any` type

**Fix Required**:
```typescript
const habitsToCreate = epic.epic_habits.map((eh: any) => ({
  user_id: user.user.id,
  title: eh.habits.title,
  difficulty: eh.habits.difficulty,
  frequency: eh.habits.frequency || 'daily',
  custom_days: eh.habits.frequency === 'custom' ? eh.habits.custom_days : null,
}));
```

---

## 🟡 LOW SEVERITY / IMPROVEMENTS

### 7. Missing Error Handling for Failed Habit Links

**Location**: `src/components/JoinEpicDialog.tsx`  
**Severity**: Low  
**Impact**: Silent failure of habit linking

**Issue**:
After creating new habits for a joined epic, the code links them back to the epic. If this fails, there's no cleanup of the created habits.

**Current Code** (lines 120-130):
```typescript
// Link new habits back to the epic
const habitLinks = newHabits.map((habit: any) => ({
  epic_id: epic.id,
  habit_id: habit.id,
}));

const { error: linkError } = await supabase
  .from('epic_habits')
  .insert(habitLinks);

if (linkError) throw linkError;  // ❌ Leaves orphaned habits
```

**Recommendation**:
Use database transactions or add cleanup logic to delete orphaned habits if linking fails.

---

### 8. Inconsistent Member Count Display

**Location**: Multiple components  
**Severity**: Low  
**Impact**: Confusing UX

**Issue**:
Different components calculate member count differently:
- `EpicCard.tsx` queries `epic_members` table directly
- `EpicDiscordSection.tsx` uses the passed `memberCount` prop
- `JoinEpicDialog.tsx` counts members for Discord threshold

If the epic owner is not in `epic_members` (due to bug #1), the count will be inconsistent across the UI.

**Recommendation**:
Create a database view or function that returns the "true" member count including the owner:
```sql
CREATE OR REPLACE FUNCTION get_epic_member_count(epic_id_param UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM (
    -- Get the owner
    SELECT user_id FROM epics WHERE id = epic_id_param
    UNION
    -- Get all members
    SELECT user_id FROM epic_members WHERE epic_id = epic_id_param
  ) AS all_members;
$$ LANGUAGE SQL STABLE;
```

---

### 9. RLS Policy for epic_discord_events May Be Too Restrictive

**Location**: `supabase/migrations/20251124183456_586c5fa7-091b-41de-908c-0ab003759a64.sql`  
**Severity**: Low  
**Impact**: Epic owners/members can't see Discord event logs

**Issue**:
The policy only allows admins to view discord events:

**Current Code** (lines 57-60):
```sql
CREATE POLICY "Admins can view discord events"
  ON public.epic_discord_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
```

**Recommendation**:
Consider allowing epic owners to view events for debugging:
```sql
CREATE POLICY "Epic owners and admins can view discord events"
  ON public.epic_discord_events FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid())
  );
```

---

### 10. Missing Cleanup for Abandoned/Deleted Epics

**Location**: Multiple files  
**Severity**: Low  
**Impact**: Orphaned Discord channels

**Issue**:
When an epic is abandoned or deleted, there's no cleanup of:
- Discord channels (they remain in the server)
- Epic members (handled by CASCADE, but no notification)
- Epic habits (handled by CASCADE)

**Recommendation**:
Add a database trigger or function to:
1. Post a "Epic Abandoned" message to Discord channel
2. Optionally archive or delete the Discord channel
3. Notify members that the epic has ended

---

## 📊 Summary

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 3 | #1, #2, #3 |
| ⚠️ Medium | 3 | #4, #5, #6 |
| 🟡 Low | 4 | #7, #8, #9, #10 |
| **Total** | **10** | |

---

## 🎯 Recommended Fix Priority

1. **Fix #1 (Epic owner not added to members)** - This breaks the entire guild system
2. **Fix #2 (Shared epics not visible)** - Critical for multi-user functionality
3. **Fix #3 (Discord invite URL missing)** - Causes errors in Discord integration
4. **Fix #5 (Discord ready logic)** - Important for correct feature unlocking
5. **Fix #6 (Habit duplication validation)** - Prevents data corruption
6. **Address remaining issues** - UX and cleanup improvements

---

## 🧪 Testing Recommendations

After fixes are applied, test these scenarios:

1. **Guild Creation Flow**:
   - Create a public epic
   - Verify creator appears in epic_members
   - Verify member count shows 1

2. **Join Guild Flow**:
   - Join a public epic with invite code
   - Verify epic appears in your epics list
   - Verify habits are copied correctly
   - Verify member count updates

3. **Discord Unlock Flow**:
   - Create public epic (1 member)
   - Have 2 more users join (should unlock at 3)
   - Verify owner can create Discord channel
   - Verify all members can see "Open Chat" button
   - Verify discord_invite_url is returned

4. **Multi-Member Scenarios**:
   - Test race condition: have 2 users join simultaneously
   - Verify no duplicate Discord ready updates
   - Test member count consistency across all components

---

**End of Report**
