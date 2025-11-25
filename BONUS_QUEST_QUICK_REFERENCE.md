# Bonus Quest Slot - Quick Reference

## 🎯 How It Works

### Unlock Conditions (OR logic)
```
Bonus Slot Unlocked = (All 4 Quests Completed Today) OR (7+ Day Streak)
```

### Visual Indicators

**When Active:**
```
5 quests available ✨ Bonus Slot!
```

**When Locked (4/4 tasks exist):**
```
🌟 Unlock Bonus Quest Slot: Complete all 4 quests today OR maintain a 7+ day streak!
```

## 🔧 Technical Implementation

### Hook Return Values
```typescript
const {
  tasks,           // Array of tasks
  canAddMore,      // Boolean: can add more tasks?
  maxQuests,       // Number: 4 or 5
  hasBonusSlot,    // Boolean: is bonus slot unlocked?
  completedCount,  // Number: completed tasks
  totalCount,      // Number: total tasks
  ...
} = useDailyTasks(selectedDate);
```

### Logic Flow
```typescript
// Check if all 4 completed
const allFourCompleted = tasks.length === 4 && completedCount === 4;

// Check if 7+ day streak
const hasStreakBonus = profile.current_habit_streak >= 7;

// Unlock bonus slot
const hasBonusSlot = allFourCompleted || hasStreakBonus;

// Set max quests
const maxQuests = hasBonusSlot ? 5 : 4;

// Allow adding more
const canAddMore = tasks.length < maxQuests;
```

## 📝 Key Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `src/hooks/useDailyTasks.ts` | Added bonus slot logic | ~50 |
| `src/pages/Tasks.tsx` | Updated UI with indicators | ~15 |
| `supabase/.../add_daily_task_helpers.sql` | Increased limit to 5 | ~3 |

## 🎨 UI/UX Features

1. **Dynamic Quest Counter**: Shows "4 quests" or "5 quests ✨ Bonus Slot!"
2. **Unlock Banner**: Appears when user has 4 tasks but bonus not unlocked
3. **Celebration Toast**: "🎉 Bonus Quest Slot Unlocked!" when completing 4th quest
4. **Visual Sparkle**: ✨ emoji indicator when bonus is active

## ⚡ Performance

- **Zero extra database queries** - uses existing profile data
- **Memoized calculations** - `useMemo` prevents unnecessary recalculations
- **Instant updates** - React hooks automatically refresh UI

## 🔒 Security Features

- ✅ Client-side validation (bonus slot conditions)
- ✅ Server-side validation (max 5 tasks hard limit)
- ✅ Cannot uncheck completed tasks (XP farming prevention)
- ✅ Race condition protection (progress refs)

## 🧪 Test Scenarios

### Scenario 1: Complete All 4 Quests
```
1. User adds 4 quests
2. User completes quest 1 → No bonus
3. User completes quest 2 → No bonus
4. User completes quest 3 → No bonus
5. User completes quest 4 → ✨ BONUS UNLOCKED!
6. User can now add 5th quest
```

### Scenario 2: 7+ Day Streak
```
1. User has 7-day streak
2. User opens Tasks page
3. UI shows "5 quests available ✨ Bonus Slot!"
4. User can add up to 5 quests immediately
```

### Scenario 3: Both Conditions Met
```
1. User has 7-day streak
2. User completes all 4 quests
3. Both unlock conditions met
4. UI shows bonus slot (doesn't double-unlock)
```

## 🐛 Edge Cases Handled

| Edge Case | Behavior |
|-----------|----------|
| Add 5th quest without bonus | ❌ Error: "Maximum 4 tasks per day" |
| Uncheck completed task | ❌ Error: "Cannot uncheck completed tasks" |
| Rapid-click add button | ✅ Only adds once (race protection) |
| Complete 4th quest on 7-day streak | ✅ Works (both conditions met) |
| Switch days in calendar | ✅ Recalculates for new date |
| Lose streak while having 5 tasks | ✅ Can keep existing 5, can't add more |

## 📊 Before vs After

### Before
```typescript
const canAddMore = tasks.length < 4; // ❌ Hardcoded
const maxQuests = 4; // ❌ Static
```

### After
```typescript
const hasBonusSlot = useMemo(() => {
  const allFourCompleted = tasks.length === 4 && completedCount === 4;
  const hasStreakBonus = profile.current_habit_streak >= 7;
  return allFourCompleted || hasStreakBonus;
}, [tasks.length, completedCount, profile?.current_habit_streak]);

const maxQuests = hasBonusSlot ? 5 : 4; // ✅ Dynamic
const canAddMore = tasks.length < maxQuests; // ✅ Dynamic
```

## 🎯 Future Enhancements (Optional)

1. **Progress Indicator**: "3/4 quests - 1 more for bonus!"
2. **Bonus XP Multiplier**: 5th quest gives 1.2x XP
3. **Achievement**: "Overachiever - Complete 5 quests in one day"
4. **Analytics**: Track bonus slot usage rate
5. **Streak Visualization**: Show progress to 7-day milestone

---
*Quick Reference - 2025-11-25*
