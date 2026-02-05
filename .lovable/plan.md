

# Refined Living Companion Talk Popup System
## Clean Image + Quote with Production-Ready Architecture

---

## Summary of Refinements

Based on feedback, I'm incorporating these key improvements to make the system scalable and prevent staleness:

1. **Moment types** - Route reactions meaningfully (6 MVP types)
2. **Tone tags** - Prevent back-to-back similar tones
3. **Per-user cooldowns** - Based on hours since shown
4. **Soft delete for reactions** - `is_active` flag
5. **Adaptive auto-dismiss** - Based on quote length
6. **Smart integration triggers** - Not every action, only meaningful ones
7. **Rare pool** - Special lines that only appear every 7 days
8. **Companion name caching** - Performance optimization

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    LIVING COMPANION ENGINE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EVENT                 MOMENT TYPE              REACTION SELECTION   │
│  ─────────────         ───────────              ──────────────────   │
│  Quest complete    →   momentum_gain        →   Filter by:           │
│  Ritual complete   →   discipline_win           - moment_type        │
│  Resist victory    →   urge_defeated            - source_system      │
│  Pomodoro done     →   focus_proof (rare)       - cooldown (hours)   │
│  Comeback          →   comeback                 - tone_tag (no repeat│
│  Perfect day       →   breakthrough             - budget remaining   │
│                                                                      │
│  OUTPUT: Show popup with companion portrait + quote                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Refined)

### 1. New Table: `companion_reactions`

```sql
CREATE TABLE companion_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'micro',
  text TEXT NOT NULL,
  context_tags TEXT[] DEFAULT '{}',      -- ['late_night', 'after_lapse', 'rare']
  moment_types TEXT[] DEFAULT '{}',      -- ['urge_defeated', 'comeback']
  source_systems TEXT[] DEFAULT '{}',    -- ['quest', 'ritual', 'resist']
  tone_tag TEXT DEFAULT 'neutral',       -- 'hype', 'calm', 'proud', 'funny', 'soft'
  cooldown_hours INT DEFAULT 12,
  is_active BOOLEAN DEFAULT true,        -- Soft delete support
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE companion_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active reactions" ON companion_reactions 
  FOR SELECT USING (is_active = true);
```

### 2. New Table: `user_reaction_history`

```sql
CREATE TABLE user_reaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_id UUID REFERENCES companion_reactions(id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  moment_type TEXT NULL,                  -- For analytics
  reaction_text_snapshot TEXT NULL,       -- Preserve text if reaction changes
  tone_tag TEXT NULL,                     -- For anti-repeat logic
  shown_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_reaction_history_recent 
ON user_reaction_history(user_id, shown_at DESC);

-- RLS
ALTER TABLE user_reaction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own history" ON user_reaction_history 
  FOR ALL USING (auth.uid() = user_id);
```

### 3. New Table: `user_reaction_budget`

```sql
CREATE TABLE user_reaction_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quest_count INT DEFAULT 0,
  ritual_count INT DEFAULT 0,
  resist_count INT DEFAULT 0,
  pomodoro_count INT DEFAULT 0,
  mentor_count INT DEFAULT 0,
  total_count INT DEFAULT 0,             -- Source of truth for daily max
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, budget_date)
);

-- RLS
ALTER TABLE user_reaction_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own budget" ON user_reaction_budget 
  FOR ALL USING (auth.uid() = user_id);
```

### 4. New Column on `user_companion`

```sql
ALTER TABLE user_companion 
ADD COLUMN cached_creature_name TEXT NULL;
```

This caches the creature name from `companion_evolution_cards` to avoid querying every popup.

---

## Moment Types (6 MVP)

| Moment Type | Trigger Condition |
|-------------|-------------------|
| `momentum_gain` | First win today, first task after inactivity |
| `quiet_consistency` | Steady days, multiple rituals without drama |
| `discipline_win` | Rituals done on time, full ritual set completed |
| `urge_defeated` | Any resist victory |
| `comeback` | First action after 3+ day lapse |
| `breakthrough` | First perfect day, first perfect week, campaign milestone |

Default: `momentum_gain` when no specific condition matches.

---

## Tone Tags (Anti-Repetition)

| Tone Tag | Description | Example Lines |
|----------|-------------|---------------|
| `hype` | Excited, energetic | "Wait, did you just... YES!" |
| `calm` | Peaceful, steady | "One step at a time." |
| `proud` | Warm approval | "You stood your ground." |
| `funny` | Playful, light | "Productivity level: legendary." |
| `soft` | Gentle, tender | "You came back. That's everything." |
| `neutral` | Default, simple | "Noted." |

**Selection rule**: Exclude the last shown `tone_tag` from eligible pool (unless pool would be empty).

---

## Per-Core Budget Limits

| Feature | Max/Day | Trigger Conditions |
|---------|---------|-------------------|
| Quest | 1 | First quest today OR quest after pomodoro (15min window) |
| Ritual | 2 | First ritual OR completes daily ritual set |
| Resist | 3 | Any victory (emotional core - always eligible) |
| Pomodoro | 1 | Only if session ≥ 15 minutes |
| Mentor | 1 | Only after check-in submit or pep talk view |
| **Total** | **5** | Global daily cap |

---

## Cooldown Logic

Selection query filters by **per-user** cooldown:
```sql
SELECT * FROM companion_reactions r
WHERE r.is_active = true
  AND r.id NOT IN (
    SELECT reaction_id FROM user_reaction_history h
    WHERE h.user_id = :userId
      AND h.shown_at > NOW() - (r.cooldown_hours || ' hours')::INTERVAL
  )
```

---

## Adaptive Auto-Dismiss

Based on quote length for natural reading:
- **< 60 characters**: 3.2 seconds
- **60-100 characters**: 4.0 seconds
- **> 100 characters**: 5.0 seconds

Formula: `Math.min(5, Math.max(3.2, 3 + (message.length / 50)))`

---

## Rare Pool (Screenshot Lines)

Special reactions with `context_tags` including `'rare'`:
- Only eligible if user hasn't seen a rare line in 7 days
- Examples:
  - "I almost faded there. But you came back."
  - "We're still here. That means something."
  - "You didn't just complete a task. You chose a direction."

Query addition:
```sql
-- For rare lines, check 7-day cooldown
AND NOT (
  'rare' = ANY(r.context_tags) 
  AND EXISTS (
    SELECT 1 FROM user_reaction_history h
    WHERE h.user_id = :userId
      AND h.shown_at > NOW() - INTERVAL '7 days'
      AND EXISTS (
        SELECT 1 FROM companion_reactions r2 
        WHERE r2.id = h.reaction_id 
        AND 'rare' = ANY(r2.context_tags)
      )
  )
)
```

---

## Companion Name Display

**Fallback chain**:
1. `user_companion.cached_creature_name` (fastest)
2. Query `companion_evolution_cards.creature_name` at current stage
3. Capitalize `companion.spirit_animal`
4. Default: "Companion"

**Cache update**: When companion evolves, update `cached_creature_name`:
```sql
UPDATE user_companion 
SET cached_creature_name = (
  SELECT creature_name FROM companion_evolution_cards 
  WHERE companion_id = user_companion.id 
  AND evolution_stage = user_companion.current_stage
)
WHERE id = :companionId;
```

---

## Visual Design

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────┐   "Another one bites the dust!"                 │
│   │          │                                                 │
│   │  [YOUR   │                           — Aerion ✨     [X]   │
│   │COMPANION]│                                                 │
│   │          │                                                 │
│   └──────────┘                                                 │
│                                                                 │
│   ████████████████████░░░░░░░░  (auto-dismiss progress bar)    │
└─────────────────────────────────────────────────────────────────┘
```

**Features**:
- Tap anywhere to dismiss (also small X button for clarity)
- Portrait uses `companion.current_image_url`
- Positioned above nav bar with safe area padding
- Max width 680px desktop, full width minus padding on mobile
- Bottom anchor: `navHeight + safeAreaBottom + 12px`

---

## Files to Create

### Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useTalkPopup.ts` | State management for popup visibility and queue |
| `src/hooks/useReactionBudget.ts` | Track per-core and daily limits with upsert |
| `src/hooks/useReactionSelector.ts` | Select reaction based on moment type, cooldowns, tone |
| `src/hooks/useLivingCompanion.ts` | Central orchestration, moment interpretation |

### Components

| File | Purpose |
|------|---------|
| `src/components/companion/CompanionTalkPopup.tsx` | Main popup with portrait and quote |

### Config

| File | Purpose |
|------|---------|
| `src/config/reactionPools.ts` | Initial 60 reaction lines with tone tags |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `<CompanionTalkPopup />` to global layout |
| `src/hooks/useXPRewards.ts` | Add `triggerReaction()` calls with smart conditions |
| `src/components/EpicCheckInDrawer.tsx` | Trigger on ritual completion (first or completes set) |
| `src/hooks/useAstralEncounters.ts` | Trigger on resist victory (in `completeEncounter.onSuccess`) |
| `src/features/tasks/hooks/useFocusSession.ts` | Trigger on pomodoro ≥ 15min completion |
| `src/hooks/useCompanion.ts` | Update `cached_creature_name` on evolution |

---

## Integration Trigger Logic

### Quests (in `useXPRewards.ts`)
```typescript
// Only trigger if:
// 1. First quest today, OR
// 2. Quest completed within 15 min of pomodoro
const shouldTrigger = isFirstQuestToday || wasRecentPomodoro;
if (shouldTrigger) {
  triggerReaction('quest', { momentType: 'momentum_gain' });
}
```

### Rituals (in `EpicCheckInDrawer.tsx`)
```typescript
// Trigger when:
// 1. First ritual today (momentType: 'discipline_win'), OR
// 2. Completes daily ritual set (momentType: 'breakthrough')
if (isFirstRitualToday || completedAllRituals) {
  triggerReaction('ritual', { momentType });
}
```

### Resist (in `useAstralEncounters.ts`)
```typescript
// Always trigger on victory (subject to budget)
// Add late_night context if between 11pm-4am
const isLateNight = hour >= 23 || hour < 4;
triggerReaction('resist', { 
  momentType: 'urge_defeated',
  contextTags: isLateNight ? ['late_night'] : []
});
```

### Pomodoro (in `useFocusSession.ts`)
```typescript
// Only trigger if session was ≥ 15 minutes
if (session.planned_duration >= 15) {
  triggerReaction('pomodoro', { momentType: 'focus_proof' });
}
```

### Mentor (in check-in/pep talk handlers)
```typescript
// Only after check-in submit or pep talk view, not every chat
if (eventType === 'check_in' || eventType === 'pep_talk_view') {
  triggerReaction('mentor', { momentType: 'momentum_gain' });
}
```

---

## Initial Content (60 Lines)

### Quest Complete (10 lines)
| Text | Tone |
|------|------|
| "Another one bites the dust!" | hype |
| "Wait, did you just... YES!" | hype |
| "Productivity level: legendary." | funny |
| "Noted. Filed under 'awesome.'" | funny |
| "Look at you being all responsible!" | proud |
| "One more off the list." | calm |
| "You're on a roll today." | proud |
| "Task destroyed. Moving on." | neutral |
| "That's how it's done." | proud |
| "Progress. Love to see it." | calm |

### Ritual Complete (10 lines)
| Text | Tone |
|------|------|
| "The sacred ritual is complete!" | hype |
| "Day after day, you show up. That's everything." | soft |
| "You kept the promise." | proud |
| "Consistency looks good on you." | proud |
| "Another day, another step forward." | calm |
| "The routine holds strong." | calm |
| "Discipline is a beautiful thing." | proud |
| "Ritual complete. We're building something here." | soft |
| "This is how legends are made. Quietly." | soft |
| "You showed up. That's half the battle." | proud |

### Resist Victory (20 lines)
| Text | Tone |
|------|------|
| "That pull didn't win. WE did." | proud |
| "I felt that choice." | soft |
| "Not today, urge. Not. Today." | proud |
| "You stood your ground." | proud |
| "The darkness retreats." | calm |
| "Victory. Quiet and fierce." | calm |
| "You chose wisely." | proud |
| "That took strength. I saw it." | soft |
| "We held the line." | proud |
| "Another battle won." | neutral |
| "Your willpower is showing." | proud |
| "Urge defeated. You're getting stronger." | proud |
| "They'll try again. And we'll win again." | proud |
| "That was for both of us." | soft |
| "Proud of you. Really." | soft |
| "At this hour? Impressive." (late_night) | proud |
| "The night tried to win. It lost." (late_night) | proud |
| "Midnight discipline. Rare and powerful." (late_night) | proud |
| "When it's hardest is when it matters most." (late_night) | soft |
| "Late night victories hit different." (late_night) | proud |

### Comeback (5 lines)
| Text | Tone |
|------|------|
| "You came back. That's the only thing I needed." | soft |
| "I knew you would." | soft |
| "Look who's here. I missed you." | soft |
| "Welcome back. Let's go." | proud |
| "The return. I like it." | calm |

### Rare Pool (5 lines)
| Text | Tone |
|------|------|
| "I almost faded there. But you came back." | soft |
| "We're still here. That means something." | soft |
| "You didn't just complete a task. You chose a direction." | soft |
| "Each morning you return, I understand trust differently." | soft |
| "When you choose me over the urge, something quiet changes." | soft |

### Pomodoro/General (10 lines)
| Text | Tone |
|------|------|
| "Good focus. Quiet power." | calm |
| "Deep work complete." | calm |
| "That was solid concentration." | proud |
| "Focus achieved." | neutral |
| "Well done. Rest your mind." | soft |
| "Nice to be here." | calm |
| "Good vibes." | calm |
| "All is well." | calm |
| "Carrying on." | neutral |
| "Still here." | neutral |

---

## Implementation Phases

### Phase 1: Foundation (3-4 days)
- Database migrations (tables + seed data)
- `useTalkPopup` hook with visibility state
- `CompanionTalkPopup` component (portrait + quote + adaptive dismiss)
- Add popup to `App.tsx`

### Phase 2: Selection Logic (2-3 days)
- `useReactionBudget` hook with upsert
- `useReactionSelector` hook (cooldowns, tone anti-repeat, rare pool)
- `useLivingCompanion` orchestration hook
- Companion name fallback chain + caching

### Phase 3: Integration (2-3 days)
- Add smart triggers to `useXPRewards.ts`
- Add triggers to `EpicCheckInDrawer.tsx`
- Add triggers to `useAstralEncounters.ts`
- Add triggers to `useFocusSession.ts`
- Update `useCompanion.ts` for name caching on evolution

---

## Technical Notes

### Upsert for Budget
```typescript
await supabase
  .from('user_reaction_budget')
  .upsert({
    user_id: userId,
    budget_date: today,
    [sourceField]: existingCount + 1,
    total_count: existingTotal + 1,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,budget_date',
  });
```

### Reaction Selection Algorithm
1. Filter by `is_active = true`
2. Filter by `source_systems` containing current source
3. Filter by `moment_types` containing current moment (or empty)
4. Exclude reactions shown within their `cooldown_hours`
5. Exclude last shown `tone_tag` (unless pool would be empty)
6. For rare lines, check 7-day cooldown
7. Pick random from remaining pool
8. Record to history with `reaction_text_snapshot`

### Accessibility
- `prefers-reduced-motion`: Skip fade animation
- ARIA labels on dismiss button and popup region
- Focus trap not needed (tap anywhere dismisses)

### Mobile Positioning
```typescript
const bottomOffset = useMemo(() => {
  const navHeight = 64; // px
  const safeArea = parseInt(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--sab') || '0'
  );
  return navHeight + safeArea + 12;
}, []);
```

---

## What This Achieves

| Design Choice | Benefit |
|---------------|---------|
| Moment types | Reactions feel meaningful, not random |
| Tone tags | No back-to-back similar energy |
| Per-core budgets | Features don't compete for attention |
| Rare pool | Screenshot-worthy lines stay special |
| Adaptive dismiss | Reading feels natural |
| Smart triggers | Quality over quantity |
| Name caching | Fast, reliable display |
| Soft delete | Safe content updates |

The companion will feel like a consistent character who notices specific achievements and never becomes annoying or repetitive.

