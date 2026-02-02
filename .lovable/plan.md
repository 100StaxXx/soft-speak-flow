
# Realtime Subscriptions for Habits & Epics

## Overview

Add instant cross-device synchronization for habits and epics, matching the existing pattern used by guild activities, shouts, and boss encounters. This ensures changes made on one device (phone, tablet, desktop) appear immediately on others without requiring a manual refresh.

---

## Current State

| Table | Realtime Enabled | Subscription Hook |
|-------|------------------|-------------------|
| `habits` | ❌ No | None |
| `epics` | ❌ No | None |
| `habit_completions` | ❌ No | None |
| `daily_tasks` | ❌ No | None |
| `epic_activity_feed` | ✅ Yes | `useGuildActivity` |
| `guild_shouts` | ✅ Yes | `useGuildShouts` |
| `guild_boss_encounters` | ✅ Yes | `useGuildBoss` |

---

## Implementation Plan

### 1. Database Migration: Enable Realtime

Create a migration to add the required tables to the Supabase realtime publication.

```sql
-- Enable realtime for habits and epics cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.habits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.epics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.habit_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_tasks;
```

---

### 2. New Hook: `useHabitsRealtime.ts`

Create a dedicated realtime hook for habit synchronization that can be used alongside the existing `useHabits` hook.

**Location:** `src/hooks/useHabitsRealtime.ts`

**Pattern:** Follow the existing `useGuildActivity` and `useCompanionMood` patterns:
- Subscribe to postgres_changes on `habits` and `habit_completions` tables
- Filter by `user_id=eq.${user.id}`
- Invalidate relevant query keys on changes
- Handle connection errors with logging
- Proper cleanup on unmount

**Query keys to invalidate:**
- `['habits', user?.id]`
- `['habit-completions', user?.id]`
- `['habit-surfacing', user?.id, taskDate]`
- `['quest-autocomplete-habits', user?.id]`

---

### 3. New Hook: `useEpicsRealtime.ts`

Create a dedicated realtime hook for epic synchronization.

**Location:** `src/hooks/useEpicsRealtime.ts`

**Subscribe to:**
- `epics` table changes (INSERT, UPDATE, DELETE)
- Filter by `user_id=eq.${user.id}`

**Query keys to invalidate:**
- `['epics', user?.id]`
- `['epic-progress']`
- `['habit-surfacing']` (epics affect which habits surface)

---

### 4. New Hook: `useDailyTasksRealtime.ts`

Create a realtime hook for daily tasks to sync task completion across devices.

**Location:** `src/hooks/useDailyTasksRealtime.ts`

**Subscribe to:**
- `daily_tasks` table changes
- Filter by `user_id=eq.${user.id}`

**Query keys to invalidate:**
- `['daily-tasks']`
- `['tasks']`
- `['calendar-tasks']`
- `['habit-surfacing']` (task creation affects surfacing)

---

### 5. Integration Point: `GlobalEvolutionListener.tsx` or New Provider

Add the realtime hooks to a component that's always mounted when the user is authenticated. Options:

**Option A:** Create a `RealtimeSyncProvider` component that wraps the app and activates all realtime subscriptions when the user is logged in.

**Option B:** Add the hooks directly to an existing always-mounted component like `GlobalEvolutionListener`.

**Recommended:** Option A for better separation of concerns.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/[timestamp]_enable_habits_epics_realtime.sql` | Create | Enable realtime on tables |
| `src/hooks/useHabitsRealtime.ts` | Create | Realtime sync for habits |
| `src/hooks/useEpicsRealtime.ts` | Create | Realtime sync for epics |
| `src/hooks/useDailyTasksRealtime.ts` | Create | Realtime sync for daily tasks |
| `src/components/RealtimeSyncProvider.tsx` | Create | Central provider for all realtime subscriptions |
| `src/App.tsx` | Modify | Add RealtimeSyncProvider to the component tree |

---

## Technical Details

### Hook Structure (Template)

```typescript
// src/hooks/useHabitsRealtime.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { logger } from "@/utils/logger";

export const useHabitsRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`habits-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['habits', user.id] });
          queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
          queryClient.invalidateQueries({ queryKey: ['epics'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_completions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['habit-completions', user.id] });
          queryClient.invalidateQueries({ queryKey: ['habits'] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Habits realtime subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
```

### Provider Structure

```typescript
// src/components/RealtimeSyncProvider.tsx
import { useHabitsRealtime } from "@/hooks/useHabitsRealtime";
import { useEpicsRealtime } from "@/hooks/useEpicsRealtime";
import { useDailyTasksRealtime } from "@/hooks/useDailyTasksRealtime";
import { useAuth } from "@/hooks/useAuth";

export const RealtimeSyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  // Only activate realtime when user is authenticated
  useHabitsRealtime();
  useEpicsRealtime();
  useDailyTasksRealtime();

  return <>{children}</>;
};
```

---

## Expected Results

After implementation:

1. **Habit updates** (create, edit, delete) sync instantly across devices
2. **Habit completions** appear in real-time on other devices
3. **Epic changes** (progress, status) sync without refresh
4. **Daily tasks** (complete, create, update) sync immediately
5. **Quests tab** updates when rituals are completed on another device
6. **Campaigns view** reflects changes made elsewhere instantly

---

## Performance Considerations

- Realtime subscriptions are lightweight and use WebSocket connections
- Subscriptions are scoped to user's own data (`user_id=eq.${user.id}`)
- Connection errors are logged but don't block the app
- Cleanup on unmount prevents memory leaks
- The existing `staleTime` settings on queries prevent unnecessary refetches

---

## Compatibility

This implementation:
- Works alongside the existing `useAppResumeRefresh` hook (provides backup sync)
- Follows the same patterns as existing guild realtime hooks
- Uses the established `logger` utility for consistent logging
- Doesn't modify existing query functions—only adds realtime invalidation
