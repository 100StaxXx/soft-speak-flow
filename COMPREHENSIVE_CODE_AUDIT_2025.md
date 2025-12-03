# Comprehensive Code Audit Report - Cosmiq App
**Date**: December 3, 2025  
**Auditor**: Senior Full-Stack Engineer  
**Status**: Production Readiness Review

---

## Executive Summary

**Cosmiq** is a gamified self-improvement app with a complex, feature-rich architecture. The codebase demonstrates solid engineering practices in many areas but has opportunities for optimization, refactoring, and stability improvements before production launch.

**Overall Assessment**: 7.5/10 - Good foundation with clear areas for improvement

**Strengths**:
- Well-structured domain separation (hooks, contexts, components)
- Comprehensive XP/companion evolution system
- Good error handling and retry logic in critical paths
- Race condition prevention in key mutations
- Type-safe configuration files

**Critical Issues Found**: 4  
**High Priority Issues**: 12  
**Medium Priority**: 18  
**Nice-to-Have**: 15

---

## 1. Project Overview & Architecture

### Tech Stack
- **Frontend**: React 18.3, TypeScript 5.8, Vite 5.4
- **State Management**: TanStack Query (React Query) v5, Context API
- **UI**: Radix UI, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Edge Functions, Storage, Auth)
- **Mobile**: Capacitor 7.4 (iOS + Android support)
- **Build**: Vite with SWC, PWA support

### Main Folders & Their Purpose

```
/src
├── pages/              # Route components (30 pages)
├── components/         # Reusable UI components (220+ files)
├── hooks/              # Custom React hooks (40+ hooks)
├── contexts/           # Global state (XP, Evolution, Theme)
├── config/             # Static configs (XP rewards, categories, etc.)
├── utils/              # Helper functions (30+ utilities)
├── integrations/       # Supabase client & types
└── types/              # TypeScript type definitions

/supabase
├── functions/          # Edge functions (70+ serverless functions)
├── migrations/         # Database schema (116 migrations, 88+ tables)
└── config.toml         # Supabase configuration
```

### Key Domains

#### 1. **Companion / Evolution System**
- Core gamification mechanic: users grow a companion creature
- 21 evolution stages (0-20)
- XP-based progression with thresholds
- Dynamic image generation via AI
- Story generation at each evolution stage
- Evolution cards (collectible memories)
- Attributes: body, mind, soul (affected by user activities)

**Implementation**: `useCompanion`, `useEvolution`, `CompanionEvolution.tsx`, edge functions `generate-companion-*`

#### 2. **Quests & Habits / Epics System**
- **Daily Quests**: One-time tasks with difficulty-based XP (easy/medium/hard)
- **Habits**: Recurring activities with frequency patterns (daily, weekly, custom)
- **Epics**: Multi-day goals combining multiple habits (guilds/social features)
- Calendar view with scheduling conflicts detection
- Streak tracking and milestone rewards
- Diminishing returns on quest XP (prevents farming)

**Implementation**: `useDailyTasks`, `useEpics`, `Tasks.tsx`, `Epics.tsx`

#### 3. **Mentor & Astrology System**
- 9 AI mentors with distinct personalities
- Zodiac-based cosmic profiles (sun, moon, rising, venus, mars, mercury signs)
- Daily horoscopes and cosmic insights
- Pep talks (motivational audio content)
- Mentor chat (AI conversations)
- Birth chart calculations

**Implementation**: `useMentorPersonality`, `Horoscope.tsx`, `MentorChat.tsx`, edge functions `generate-daily-horoscope`, `calculate-cosmic-profile`

#### 4. **Auth & Onboarding**
- Supabase Auth (email + OAuth: Apple, Google)
- Native sign-in on iOS (Apple Sign-In)
- Multi-step onboarding flow
- Profile creation with astrology data collection
- Mentor selection process

**Implementation**: `useAuth`, `Auth.tsx`, `Onboarding.tsx`, edge functions `apple-native-auth`, `google-native-auth`

#### 5. **Subscriptions / IAP / Billing**
- 7-day free trial system
- Apple In-App Purchases (monthly $9.99, yearly $59.99)
- Trial status tracking
- Subscription gate at evolution stage 1
- Webhook handling for Apple receipts
- Referral system with rewards

**Implementation**: `useSubscription`, `useTrialStatus`, `useAppleSubscription`, edge functions `check-apple-subscription`, `verify-apple-receipt`, `apple-webhook`

#### 6. **Notifications**
- Native push notifications (iOS APNS)
- Web push (PWA)
- Scheduled notifications (daily pep talks, quotes, reminders)
- Adaptive notifications based on user behavior
- Task reminders

**Implementation**: `useNotificationScheduler`, edge functions `dispatch-daily-pushes-native`, `deliver-scheduled-notifications`

---

## 2. Code Quality & Architecture Review

### Major Code Smells & Anti-Patterns

#### **CRITICAL #1: Huge Page Components**
**Files**: 
- `Admin.tsx` - **1,430 lines** 
- `Tasks.tsx` - **1,241 lines**
- `Horoscope.tsx` - 803 lines
- `Onboarding.tsx` - 723 lines

**Problem**: Massive components doing too much - state management, data fetching, rendering, business logic all mixed.

**Impact**: 
- Hard to test
- Difficult to maintain
- Performance issues (unnecessary re-renders)
- Can't reuse logic

**Fix**:
```
Admin.tsx → Split into:
- AdminLayout.tsx (shell/navigation)
- AdminPepTalks.tsx (pep talk CRUD)
- AdminPayouts.tsx (already separate ✓)
- AdminReferrals.tsx (already separate ✓)
- AdminEvolutionCards.tsx (card management)
- useAdminPepTalks.ts (hook for data/mutations)

Tasks.tsx → Split into:
- TasksLayout.tsx (tabs, navigation)
- QuestsView.tsx (daily tasks list)
- HabitsView.tsx (habits management)
- EpicsView.tsx (epics list - OR move to Epics.tsx)
- CalendarView.tsx (calendar integration)
- useQuestsData.ts (consolidated data hook)
```

---

#### **CRITICAL #2: Type Safety Issues - `as any` Casts**

**Found 13 instances** of `as any` bypassing TypeScript:

```typescript
// src/pages/Admin.tsx:240
const { error } = await supabase.from("pep_talks").insert([pepTalkData as any]);

// src/components/CompanionDisplay.tsx:137
: (evolveCompanion.data as any)?.current_image_url || "";

// src/utils/appleIAP.ts:59
return (result as any) || [];
```

**Problem**: These are runtime bugs waiting to happen. TypeScript can't protect you.

**Fix**:
1. Define proper interfaces for all data structures
2. Use type guards for runtime validation
3. Generate types from Supabase schema (you have `types.ts` but not using it everywhere)

**Action Items**:
- [ ] Define `PepTalkInsert` type matching database schema
- [ ] Add type guard `isEvolutionResult(data)` for evolution responses
- [ ] Type Apple IAP responses properly
- [ ] Run `supabase gen types typescript` and update imports

---

#### **HIGH #3: Console.log Pollution**

**Found 17+ instances** of `console.log` and `console.warn` in production code.

**Files**: `TodaysPepTalk.tsx`, `CompanionEvolution.tsx`, `Auth.tsx`, `Horoscope.tsx`

**Problem**: 
- Clutters production logs
- May leak sensitive data
- Poor debugging experience

**Fix**: Use your `logger` utility consistently (you have one at `@/utils/logger`!).

```typescript
// ❌ Bad
console.log('Audio loaded successfully');
console.warn('Evolution modal timeout reached');

// ✅ Good
import { logger } from '@/utils/logger';
logger.info('Audio loaded successfully');
logger.warn('Evolution modal timeout reached');
```

**Action Item**: Global find/replace + enforce with ESLint rule

---

#### **HIGH #4: Duplicate Logic Across Hooks**

**Pattern**: Similar data fetching/mutation patterns repeated in multiple hooks.

**Example**: XP award logic appears in:
- `useCompanion.ts` (awardXP mutation)
- `useDailyTasks.ts` (XP calculation)
- `useXPRewards.ts` (custom XP awards)

**Fix**: Create unified XP service:

```typescript
// src/services/xpService.ts
export class XPService {
  static async awardXP(params: AwardXPParams): Promise<XPAwardResult> {
    // Unified XP logic here
    // - Calculate XP with multipliers
    // - Check for evolution triggers
    // - Update companion
    // - Log XP event
  }
  
  static calculateEffectiveXP(base: number, multipliers: XPMultipliers): number {
    // Centralized calculation
  }
}
```

Then use in hooks:
```typescript
const awardXP = useMutation({
  mutationFn: (params) => XPService.awardXP(params)
});
```

---

#### **MEDIUM #5: Over-Complicated State Management**

**Issue**: Multiple sources of truth for some data.

**Example**: Companion state lives in:
1. React Query cache (`useCompanion`)
2. Evolution context (`isEvolvingLoading`)
3. Local component state in `CompanionDisplay`

**Problem**: Can get out of sync, leading to UI bugs.

**Fix**: Single source of truth via React Query + selective context for cross-cutting concerns only.

```typescript
// ✅ Good - React Query as source of truth
const { companion } = useCompanion();

// ✅ Good - Context only for global UI state
const { isEvolvingLoading } = useEvolution();

// ❌ Bad - Don't duplicate companion data in local state
const [companionStage, setCompanionStage] = useState(companion?.current_stage);
```

---

#### **MEDIUM #6: Magic Numbers & Hardcoded Values**

**Found in**: Multiple files

```typescript
// ❌ src/hooks/useCompanion.ts:63
staleTime: 30000, // What's this magic number?

// ❌ src/hooks/useProfile.ts:89
staleTime: 60 * 1000, // At least clear but should be constant

// ❌ src/hooks/useDailyTasks.ts:32
const taskDate = format(new Date(), 'yyyy-MM-dd'); // Timezone issues!
```

**Fix**: Extract to constants file:

```typescript
// src/lib/constants.ts
export const CACHE_TIMES = {
  COMPANION: 30 * 1000,      // 30 seconds
  PROFILE: 60 * 1000,        // 1 minute
  TASKS: 2 * 60 * 1000,      // 2 minutes
  EPICS: 3 * 60 * 1000,      // 3 minutes
} as const;

export const DATE_FORMATS = {
  TASK_DATE: 'yyyy-MM-dd',
  DISPLAY_DATE: 'MMM d, yyyy',
} as const;
```

---

### Dead Code / Unused Files

**Potential candidates** (need manual verification):

1. Check if all 220+ components are actually used
2. Some edge functions may be orphaned (70+ functions!)
3. Many `.md` documentation files (180+) - are these all needed?

**Action**: Run dead code analysis:
```bash
npx ts-prune | grep -v "used in module"
```

---

### Refactoring Checklist (Ordered by Impact vs Effort)

#### **HIGH IMPACT, LOW EFFORT**

✅ **#R1**: Replace all `console.log/warn` with `logger` utility  
**Effort**: 2 hours | **Impact**: Better debugging, cleaner logs  
**Files**: 17 files

✅ **#R2**: Extract magic numbers to `constants.ts`  
**Effort**: 1 hour | **Impact**: Maintainability, clarity

✅ **#R3**: Fix `as any` type casts  
**Effort**: 4 hours | **Impact**: Type safety, prevent runtime bugs  
**Files**: 13 instances

✅ **#R4**: Remove TODO/FIXME comments or address them  
**Effort**: 2 hours | **Impact**: Code clarity  
**Found**: 35 instances

#### **HIGH IMPACT, MEDIUM EFFORT**

✅ **#R5**: Split `Admin.tsx` into sub-components  
**Effort**: 6 hours | **Impact**: Maintainability, performance

✅ **#R6**: Split `Tasks.tsx` into sub-components  
**Effort**: 8 hours | **Impact**: Maintainability, performance

✅ **#R7**: Create unified `XPService` class  
**Effort**: 6 hours | **Impact**: Reduce duplication, consistency

✅ **#R8**: Consolidate error handling patterns  
**Effort**: 4 hours | **Impact**: Better UX, consistent error messages

#### **HIGH IMPACT, HIGH EFFORT**

✅ **#R9**: Database query optimization (see section 6)  
**Effort**: 12 hours | **Impact**: Performance, scalability

✅ **#R10**: Implement proper timezone handling  
**Effort**: 8 hours | **Impact**: Fix critical date bugs

---

## 3. Bugs, Edge Cases & Stability Issues

### **CRITICAL BUG #1: Timezone Issues in Daily Tasks**

**Location**: `src/hooks/useDailyTasks.ts:32`

```typescript
// ❌ CRITICAL: Uses device local time
const taskDate = format(new Date(), 'yyyy-MM-dd');
```

**Problem**: 
- User in Tokyo creates task at 11 PM → stored as "2025-12-04"
- User travels to NYC → app shows tasks for "2025-12-03"
- Tasks appear/disappear when crossing date line
- Daily reset happens at different times for different users

**Impact**: Data integrity issues, user confusion

**Fix**: 
```typescript
// Option 1: Use UTC consistently
const taskDate = format(new Date(), 'yyyy-MM-dd', { timeZone: 'UTC' });

// Option 2: Store user timezone in profile and use it
const userTimezone = profile?.timezone || 'UTC';
const taskDate = formatInTimeZone(new Date(), userTimezone, 'yyyy-MM-dd');

// Option 3: Store timestamps, compute "today" on server
// Best for multi-timezone support
```

**Affected files**: 
- `useDailyTasks.ts`
- `useCalendarTasks.ts`
- Any component using date-based queries

---

### **CRITICAL BUG #2: Race Condition in Task Completion**

**Location**: `src/hooks/useDailyTasks.ts:227-304`

**Found**: Good race condition prevention with `toggleInProgress.current` ✅

**However**: Still has a potential issue:

```typescript
// Line 237-246: Check if already completed
const { data: existingTask } = await supabase
  .from('daily_tasks')
  .select('completed_at')
  .eq('id', taskId);

const wasAlreadyCompleted = existingTask?.completed_at !== null;

// Line 274-283: Update with atomic check
const { data: updateResult } = await supabase
  .from('daily_tasks')
  .update({ completed: true })
  .eq('id', taskId)
  .eq('completed', false);  // ✅ Good: Atomic check
```

**Issue**: Two separate queries. Between lines 237-246 and 274-283, another request could complete the task.

**Better Fix**: Use database function for atomicity:

```sql
-- Migration: atomic_complete_task.sql
CREATE OR REPLACE FUNCTION complete_task_atomic(
  p_task_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE daily_tasks
  SET completed = true, 
      completed_at = NOW()
  WHERE id = p_task_id
    AND user_id = p_user_id
    AND completed = false
  RETURNING 
    jsonb_build_object(
      'success', true,
      'xp_reward', xp_reward,
      'task_id', id
    ) INTO v_result;
  
  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_completed');
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then in hook:
```typescript
const result = await supabase.rpc('complete_task_atomic', {
  p_task_id: taskId,
  p_user_id: user.id
});

if (!result.data.success) {
  throw new Error('Task already completed');
}

await awardCustomXP(result.data.xp_reward, ...);
```

---

### **HIGH BUG #3: Missing Error Boundaries**

**Found**: Only one error boundary at app root (`App.tsx:206`)

**Problem**: If any component throws, entire app crashes.

**Missing boundaries for**:
- Each page route
- Complex features (companion evolution, task management)
- Third-party integrations (payment, auth)

**Fix**: Add strategic error boundaries:

```typescript
// src/components/ErrorBoundary.tsx (enhance existing)
export const FeatureErrorBoundary = ({ 
  children, 
  featureName 
}: { 
  children: ReactNode; 
  featureName: string;
}) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-center">
          <p>Something went wrong with {featureName}</p>
          <Button onClick={() => window.location.reload()}>
            Reload App
          </Button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

// Use in routes:
<Route 
  path="/tasks" 
  element={
    <FeatureErrorBoundary featureName="Tasks">
      <Tasks />
    </FeatureErrorBoundary>
  } 
/>
```

---

### **HIGH BUG #4: Subscription Status Race Condition**

**Location**: `src/hooks/useSubscription.ts:28-46`

**Issue**: 
```typescript
const { data: subscriptionData } = useQuery({
  queryKey: ["subscription", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase.functions.invoke("check-apple-subscription");
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Problems**:
1. Edge function call is slow (200-1000ms)
2. No optimistic updates when user subscribes
3. 5-minute stale time means subscription changes take 5min to reflect

**Scenario**:
- User completes purchase
- App still shows "Subscribe" button for 5 minutes
- User confused, tries to purchase again
- Apple rejects duplicate purchase
- Bad UX

**Fix**: Invalidate on purchase completion + add webhook listener:

```typescript
// In purchase success handler:
const handlePurchaseSuccess = async () => {
  // Immediately refetch subscription status
  await queryClient.invalidateQueries({ 
    queryKey: ["subscription"] 
  });
  
  // Optimistic update
  queryClient.setQueryData(
    ["subscription", user?.id],
    (old) => ({ ...old, subscribed: true })
  );
  
  navigate("/premium/success");
};

// Add realtime listener for subscription changes
useEffect(() => {
  const channel = supabase
    .channel('subscription-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${user?.id}`
    }, () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    })
    .subscribe();
    
  return () => supabase.removeChannel(channel);
}, [user?.id]);
```

---

### **MEDIUM BUG #5: Companion Creation Can Fail Silently**

**Location**: `src/hooks/useCompanion.ts:68-322`

**Issue**: Complex multi-step process with background operations:
1. Generate image (AI call - can fail)
2. Create companion record
3. Create evolution record
4. Generate evolution card (background)
5. Generate story (background)

**Problem**: Steps 4-5 fire-and-forget. If they fail, user never knows.

```typescript
// Line 228-258: Fire and forget
generateStageZeroCard(); // No error handling visible to user
```

**Impact**: User creates companion, but:
- No story appears (empty story tab)
- No evolution card (empty gallery)
- User thinks feature is broken

**Fix**: Queue system + retry + user notification:

```typescript
// Create background job table
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  error TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// In companion creation:
const { data: companion } = await createCompanion(...);

// Queue background jobs
await supabase.from('background_jobs').insert([
  { user_id, job_type: 'generate_evolution_card', payload: {...} },
  { user_id, job_type: 'generate_story', payload: {...} }
]);

// Periodic worker processes jobs with retry
// Show progress in UI: "Your companion story is being written..."
```

---

### Edge Cases Checklist

#### **Auth & Session**

- [x] Session expiry during action - ✅ handled by Supabase client
- [ ] User switches accounts mid-session - **NOT HANDLED**
- [ ] OAuth redirect failure (user cancels) - ✅ handled
- [ ] Network error during sign-in - ✅ retry logic exists
- [ ] Sign-out during active mutation - **RISKY**: mutations may complete but UI stale

**Fix**: Add mutation cancellation on sign-out:

```typescript
const { signOut } = useAuth();

const handleSignOut = async () => {
  queryClient.cancelQueries(); // Cancel all in-flight requests
  await signOut();
  queryClient.clear(); // Clear cache
};
```

---

#### **Companion Evolution**

- [x] Double evolution trigger (spam click) - ✅ prevented with `evolutionInProgress` ref
- [x] Evolution during companion creation - ✅ prevented
- [ ] User closes app mid-evolution - **ISSUE**: Evolution state lost
- [ ] AI image generation fails - ✅ retried with backoff
- [x] Evolution XP threshold edge case - ✅ handled with `shouldEvolve` logic

**Fix for mid-evolution crash**:
```typescript
// Store evolution state in DB
CREATE TABLE evolution_sessions (
  id UUID PRIMARY KEY,
  companion_id UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

// On app resume, check for incomplete evolution
useEffect(() => {
  const checkIncompleteEvolution = async () => {
    const { data } = await supabase
      .from('evolution_sessions')
      .select('*')
      .is('completed_at', null)
      .eq('companion_id', companion?.id)
      .single();
      
    if (data) {
      // Resume or complete evolution
      await completeEvolution(data.id);
    }
  };
  
  checkIncompleteEvolution();
}, [companion?.id]);
```

---

#### **Tasks & Habits**

- [x] Completing task twice (double click) - ✅ prevented with atomic update
- [ ] Deleting task while completing it - **RACE**: May award XP for deleted task
- [ ] Habit frequency edge cases (custom days) - **NEEDS TESTING**
- [ ] Epic with 0 habits - ✅ prevented in validation
- [x] Task scheduled for past date - **ALLOWED** (intentional?)

**Fix for delete race**:
```typescript
// In toggleTask mutation:
onSuccess: () => {
  // Cancel any pending delete mutations for this task
  queryClient.cancelMutations({ 
    mutationKey: ['deleteTask', taskId] 
  });
}
```

---

#### **Payments & Subscriptions**

- [ ] Purchase success but webhook fails - **CRITICAL**: User charged but no access
- [ ] Webhook arrives before purchase completes client-side - **TIMING ISSUE**
- [ ] User purchases on different device - ✅ handled by `check-apple-subscription`
- [ ] Refund processing - **NEEDS WEBHOOK HANDLER**
- [ ] Family sharing - **NOT SUPPORTED?**

**Fix**: Implement idempotent webhook + reconciliation:

```typescript
// Edge function: apple-webhook
// Ensure idempotency with transaction_id
const { data: existing } = await supabase
  .from('apple_transactions')
  .select('id')
  .eq('transaction_id', webhookData.transaction_id)
  .single();
  
if (existing) {
  return new Response('Already processed', { status: 200 });
}

// Process webhook in transaction
await supabase.rpc('process_apple_purchase', {
  transaction_id: webhookData.transaction_id,
  user_id: webhookData.user_id,
  product_id: webhookData.product_id,
  // ...
});
```

---

## 4. Performance & Developer Experience

### Performance Issues

#### **PERF #1: Large Component Re-renders**

**Problem**: `Admin.tsx` (1430 lines) and `Tasks.tsx` (1241 lines) re-render entirely on any state change.

**Impact**: Laggy UI when adding tasks, editing pep talks, etc.

**Fix**: 
1. Split components (see Refactoring section)
2. Add memoization:

```typescript
// ❌ Before
export const TaskCard = ({ task, onToggle, onDelete }) => {
  return <div>...</div>;
};

// ✅ After
export const TaskCard = memo(({ task, onToggle, onDelete }) => {
  return <div>...</div>;
}, (prev, next) => {
  // Only re-render if task changes
  return prev.task.id === next.task.id &&
         prev.task.completed === next.task.completed;
});
```

---

#### **PERF #2: Expensive Calculations on Every Render**

**Example**: `useCompanion.ts:733-741`

```typescript
const nextEvolutionXP = useMemo(() => {
  if (!companion) return null;
  return getThreshold(companion.current_stage + 1);
}, [companion, getThreshold]); // ❌ getThreshold function changes on every render!
```

**Fix**: Wrap helper functions in `useCallback`:

```typescript
const getThreshold = useCallback((stage: number) => {
  return EVOLUTION_THRESHOLDS[stage] || null;
}, []); // ✅ Stable reference
```

Or better, move pure functions outside component:

```typescript
// utils/evolutionCalculations.ts
export function getEvolutionThreshold(stage: number): number | null {
  return EVOLUTION_THRESHOLDS[stage] || null;
}

// In component:
const nextEvolutionXP = useMemo(() => {
  if (!companion) return null;
  return getEvolutionThreshold(companion.current_stage + 1);
}, [companion]); // ✅ Only depends on companion
```

---

#### **PERF #3: N+1 Query Pattern in Epic Details**

**Location**: Epics with many habits

```typescript
// useEpics.ts fetches epics
const { data: epics } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("epics")
      .select(`
        *,
        epic_habits(
          habit_id,
          habits(id, title, difficulty)  // ⚠️ Joined, but...
        )
      `)
  }
});

// Then for each epic, we fetch completions
epics.forEach(epic => {
  // Component fetches completion data separately
  const { data: completions } = useQuery({
    queryFn: () => supabase
      .from('habit_completions')
      .select('*')
      .in('habit_id', epic.habits.map(h => h.id))  // N queries!
  });
});
```

**Fix**: Single query with all data:

```typescript
const { data: epics } = useQuery({
  queryFn: async () => {
    const { data } = await supabase
      .from("epics")
      .select(`
        *,
        epic_habits(
          habit_id,
          habits(
            id, 
            title, 
            difficulty,
            habit_completions(count)  // ✅ Aggregate in initial query
          )
        )
      `)
  }
});
```

---

#### **PERF #4: Unbounded List Rendering**

**Location**: Activity feed, story journal, pep talks list

**Issue**: No pagination or virtualization.

```typescript
// ActivityTimeline.tsx
{activities.map(activity => (
  <ActivityCard key={activity.id} activity={activity} />
))}
```

If user has 1000+ activities → 1000 DOM nodes → slow scroll.

**Fix Option 1**: Pagination:
```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['activities'],
  queryFn: async ({ pageParam = 0 }) => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .range(pageParam, pageParam + 19)  // 20 per page
      .order('created_at', { ascending: false });
    return data;
  },
  getNextPageParam: (lastPage, pages) => {
    return lastPage.length === 20 ? pages.length * 20 : undefined;
  }
});
```

**Fix Option 2**: Virtual scrolling (better UX):
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: activities.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100, // Estimated item height
});

{virtualizer.getVirtualItems().map(virtualRow => (
  <ActivityCard 
    key={virtualRow.key}
    activity={activities[virtualRow.index]}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: `${virtualRow.size}px`,
      transform: `translateY(${virtualRow.start}px)`
    }}
  />
))}
```

---

### Developer Experience Issues

#### **DX #1: No TypeScript Strict Mode in Some Areas**

**Found**: `tsconfig.node.json` has strict, but main `tsconfig.json` missing.

**Fix**: Create/update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,  // ✅ Add this
    "noUnusedLocals": true,  // ✅ Catch unused vars
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,  // ✅ All code paths return
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

---

#### **DX #2: Missing ESLint Rules**

**Current**: Basic ESLint config, missing important rules.

**Add to `eslint.config.js`**:

```javascript
export default [
  {
    rules: {
      // Catch console statements
      'no-console': ['warn', { allow: ['error'] }],
      
      // Catch React performance issues
      'react-hooks/exhaustive-deps': 'error',
      'react/jsx-no-bind': 'warn',
      
      // Catch type issues
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      
      // Catch common bugs
      'no-await-in-loop': 'warn',
      'require-atomic-updates': 'error',
    }
  }
];
```

---

#### **DX #3: No Database Type Generation Script**

**Found**: Manual types in `types.ts`, but Supabase can generate.

**Add script to `package.json`**:

```json
{
  "scripts": {
    "types": "supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts",
    "dev": "vite",
    "build": "npm run types && vite build"  // ✅ Auto-generate on build
  }
}
```

---

#### **DX #4: Missing Storybook or Component Documentation**

**Issue**: 220+ components, no visual documentation or playground.

**Fix**: Add Storybook (optional but helpful):

```bash
npx storybook@latest init
```

Or at minimum, create a component catalog page:

```typescript
// src/pages/ComponentCatalog.tsx (admin-only)
export const ComponentCatalog = () => {
  return (
    <div>
      <h1>Component Library</h1>
      
      <Section title="Buttons">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
      </Section>
      
      <Section title="Cards">
        <TaskCard task={mockTask} />
        <EpicCard epic={mockEpic} />
      </Section>
    </div>
  );
};
```

---

## 5. Domain-Specific System Reviews

### Quests & Habits System ✅ (Generally Good)

**Strengths**:
- Difficulty-based XP system well-designed (`xpRewards.ts`)
- Diminishing returns prevents farming
- Guild bonus (10%) is balanced
- Atomic task completion with `eq('completed', false)`

**Issues Found**:

#### **Quest #1: Timezone Bug** (See Critical Bug #1 above)

#### **Quest #2: XP Farming via Task Deletion**

**Scenario**:
1. User completes 3 hard tasks (28 XP each = 84 XP)
2. Immediately deletes them
3. Creates 3 new hard tasks
4. Completes them again (84 more XP)
5. Repeat infinitely

**Current**: Deletion allowed even after completion.

**Fix Option 1**: Prevent deletion of completed tasks:
```typescript
const deleteTask = useMutation({
  mutationFn: async (taskId: string) => {
    const { data: task } = await supabase
      .from('daily_tasks')
      .select('completed')
      .eq('id', taskId)
      .single();
      
    if (task.completed) {
      throw new Error('Cannot delete completed tasks');
    }
    
    await supabase.from('daily_tasks').delete().eq('id', taskId);
  }
});
```

**Fix Option 2**: Allow deletion but don't refund XP + log audit trail.

---

#### **Quest #3: Habit Frequency Logic Not Fully Validated**

**Code**: `useCalendarTasks.ts` and `HabitCard.tsx`

**Issue**: Custom recurrence patterns (`recurrence_days: [1,3,5]`) not validated.

**Test cases needed**:
- [ ] Habit set for Monday (1) on a Tuesday - should not show
- [ ] Habit set for all 7 days - should show daily
- [ ] Habit set for empty array - should break (validation needed)
- [ ] Leap year edge case (Feb 29)

**Fix**: Add validation + tests:

```typescript
// Schema validation
const habitSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'custom']),
  recurrence_days: z.array(z.number().min(0).max(6))
    .refine(days => {
      if (frequency === 'custom') return days.length > 0;
      return true;
    }, "Custom frequency requires at least one day")
});

// Runtime check
function shouldShowHabitToday(habit: Habit, date: Date): boolean {
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'custom') {
    const dayOfWeek = date.getDay();
    return habit.recurrence_days?.includes(dayOfWeek) ?? false;
  }
  // Add weekly logic
  return false;
}
```

---

#### **Quest #4: Epic Progress Calculation Inefficient**

**Location**: `useEpics.ts` - epic progress calculated client-side

**Current**:
```typescript
const progress = useMemo(() => {
  // For each epic, count completed habits
  const completed = epic.habits.filter(h => h.completions?.length > 0).length;
  const total = epic.habits.length;
  return (completed / total) * 100;
}, [epic]);
```

**Problem**: If epic has 50 habits, fetches completion data for all 50.

**Fix**: Calculated column in database:

```sql
ALTER TABLE epics ADD COLUMN progress_percentage NUMERIC;

CREATE OR REPLACE FUNCTION update_epic_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE epics
  SET progress_percentage = (
    SELECT (COUNT(*) FILTER (WHERE hc.completed_at IS NOT NULL)::FLOAT / 
            COUNT(*)::FLOAT) * 100
    FROM epic_habits eh
    LEFT JOIN habit_completions hc ON hc.habit_id = eh.habit_id
    WHERE eh.epic_id = NEW.epic_id
  )
  WHERE id = NEW.epic_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_epic_progress_trigger
AFTER INSERT OR UPDATE ON habit_completions
FOR EACH ROW
EXECUTE FUNCTION update_epic_progress();
```

Then just read `epic.progress_percentage` directly.

---

### Companion Evolution System ✅ (Well-Engineered)

**Strengths**:
- Excellent race condition prevention
- Retry logic for AI calls
- Staged evolution with validation
- Referral system integration at Stage 3

**Issues Found**:

#### **Companion #1: Image Generation Failure Recovery**

**Current**: Retries 3 times, then fails entire companion creation.

**Problem**: User loses all progress if AI service is down.

**Better approach**: 
1. Create companion with placeholder image
2. Queue image generation as background job
3. Show "Your companion is being brought to life..." message
4. Update image when ready

```typescript
const createCompanion = async (data) => {
  // Create companion immediately with placeholder
  const { data: companion } = await supabase
    .from('user_companion')
    .insert({
      ...data,
      current_image_url: '/images/companion-placeholder.png',
      image_generation_status: 'pending'
    })
    .single();
    
  // Queue image generation
  await supabase.from('background_jobs').insert({
    job_type: 'generate_companion_image',
    companion_id: companion.id,
    payload: data
  });
  
  return companion;
};
```

---

#### **Companion #2: Evolution Stage Skip Validation**

**Found**: `useCompanion.ts:573-577` handles skipping stages (e.g., 2 → 4).

```typescript
// FIX Bug #9: Check if we CROSSED Stage 3 (not just landed on it)
if (oldStage < 3 && newStage >= 3) {
  await validateReferralAtStage3();
}
```

**Issue**: What if user skips from 0 → 5 somehow (corrupted data)?

**Add defensive check**:
```typescript
if (newStage - oldStage > 2) {
  logger.error('Suspicious stage skip detected', { oldStage, newStage, companionId });
  // Alert admin or force stage-by-stage evolution
}
```

---

#### **Companion #3: Story Generation Timeout**

**Code**: Story generation in background with 3-retry limit.

**Problem**: Story generation can take 30-60 seconds. If user closes app, story may never generate.

**Fix**: Same as image generation - background job queue + progress indicator.

---

### Mentor & Astrology System ⚠️ (Needs Polish)

**Issues Found**:

#### **Mentor #1: Birth Chart Calculation - No Validation**

**Location**: `useProfile.ts` stores astrology data, but no validation of birth time/location.

**Problem**:
- User can enter invalid birth time (e.g., "25:00")
- Location is free text - no geocoding validation
- Rising sign calculation requires exact time + location
- Incorrect data → wrong horoscopes/personality

**Fix**: Add validation + geocoding:

```typescript
// In Onboarding.tsx:
const validateBirthData = async (data: BirthData) => {
  // Validate time format
  if (!isValid(parse(data.birth_time, 'HH:mm', new Date()))) {
    throw new Error('Invalid birth time format');
  }
  
  // Geocode location
  const coordinates = await geocodeLocation(data.birth_location);
  if (!coordinates) {
    throw new Error('Location not found. Please enter a valid city/country.');
  }
  
  return {
    ...data,
    birth_lat: coordinates.lat,
    birth_lng: coordinates.lng,
  };
};
```

---

#### **Mentor #2: Horoscope Caching Issues**

**Location**: `Horoscope.tsx` fetches daily horoscope on every mount.

**Problem**: No cache key includes date.

```typescript
const { data: horoscope } = useQuery({
  queryKey: ['horoscope', zodiacSign],  // ❌ Missing date!
  queryFn: async () => {
    const { data } = await supabase
      .from('daily_horoscopes')
      .select('*')
      .eq('zodiac_sign', zodiacSign)
      .gte('created_at', startOfDay(new Date()).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  }
});
```

**Issue**: If user checks horoscope at 11:59 PM, cache persists into next day. User sees yesterday's horoscope.

**Fix**:
```typescript
const today = format(new Date(), 'yyyy-MM-dd');
const { data: horoscope } = useQuery({
  queryKey: ['horoscope', zodiacSign, today],  // ✅ Include date
  staleTime: 24 * 60 * 60 * 1000,  // 24 hours
  // ...
});
```

---

#### **Mentor #3: Pep Talk Audio Autoplay Issues**

**Location**: `TodaysPepTalk.tsx:330-503`

**Problem**: Autoplay doesn't work on iOS without user interaction.

```typescript
useEffect(() => {
  if (audioRef.current) {
    audioRef.current.play();  // ❌ Fails on iOS
  }
}, [pepTalk]);
```

**Fix**: Require explicit user tap:
```typescript
const [hasInteracted, setHasInteracted] = useState(false);

const handlePlay = () => {
  setHasInteracted(true);
  audioRef.current?.play();
};

return (
  <div>
    {!hasInteracted && (
      <Button onClick={handlePlay}>
        Tap to Play
      </Button>
    )}
    <audio ref={audioRef} />
  </div>
);
```

---

### Auth & Subscriptions System ⚠️ (Security + UX Issues)

#### **Auth #1: OAuth Redirect Validation Missing**

**Location**: `Auth.tsx:281-316`

**Code**:
```typescript
const provider = type === 'apple' ? 'apple' : 'google';
const { data, error } = await supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: getRedirectUrl(),  // ⚠️ Potential open redirect
  }
});
```

**Security Risk**: `getRedirectUrl()` might be manipulated.

**Fix**: Whitelist redirect URLs:

```typescript
// utils/redirectUrl.ts
const ALLOWED_REDIRECTS = [
  'https://cosmiq.app',
  'https://staging.cosmiq.app',
  'capacitor://localhost',
  'http://localhost:3000',  // dev only
];

export function getRedirectUrl(): string {
  const paramRedirect = new URLSearchParams(window.location.search).get('redirect');
  
  if (paramRedirect && ALLOWED_REDIRECTS.includes(paramRedirect)) {
    return paramRedirect;
  }
  
  return import.meta.env.VITE_APP_URL || 'https://cosmiq.app';
}
```

---

#### **Auth #2: Session Refresh Not Visible to User**

**Problem**: Supabase auto-refreshes tokens, but if refresh fails (network issue), user is silently logged out.

**Better UX**:
```typescript
useEffect(() => {
  const { data: authListener } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        logger.info('Session refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT') {
        toast.warning('Your session expired. Please log in again.');
        navigate('/auth');
      }
    }
  );
  
  return () => authListener.subscription.unsubscribe();
}, []);
```

---

#### **Subscription #3: Apple IAP Verification Timing**

**Edge function**: `verify-apple-receipt`

**Issue**: Receipt verification happens AFTER purchase completes client-side. If verification fails (network), user paid but gets no access.

**Current flow**:
1. User taps "Subscribe" → StoreKit purchase
2. Purchase succeeds → app calls `verify-apple-receipt`
3. If network error → verification never happens
4. User charged, no premium access

**Fix**: Server-side verification via webhook (already exists at `apple-webhook`), but need fallback:

```typescript
// In useAppleSubscription:
const handlePurchase = async (transactionId: string) => {
  // Optimistically grant access
  queryClient.setQueryData(['subscription'], { subscribed: true });
  
  try {
    // Verify with retry
    await retryWithBackoff(() => 
      supabase.functions.invoke('verify-apple-receipt', {
        body: { transactionId }
      }),
      { maxAttempts: 5, initialDelay: 2000 }
    );
  } catch (error) {
    // Verification failed - queue for later processing
    await supabase.from('pending_verifications').insert({
      transaction_id: transactionId,
      user_id: user.id,
      created_at: new Date().toISOString()
    });
    
    // Keep optimistic access - webhook will verify eventually
  }
};
```

---

## 6. Supabase / Database Layer Review

### Schema Health: ✅ Generally Well-Designed

**Strengths**:
- 116 migrations properly versioned
- 88+ tables with clear naming
- Row-Level Security (RLS) policies enabled
- Proper foreign keys and constraints
- Realtime subscriptions for guild features

**Issues Found**:

#### **DB #1: Missing Indexes on Common Queries**

**Critical missing indexes**:

```sql
-- 1. Daily tasks by user + date (queried on EVERY task page load)
CREATE INDEX idx_daily_tasks_user_date 
ON daily_tasks(user_id, task_date);

-- 2. Companion by user (queried frequently)
CREATE INDEX idx_user_companion_user_id 
ON user_companion(user_id);

-- 3. Pep talks by category (library browsing)
CREATE INDEX idx_pep_talks_category 
ON pep_talks(category);

-- 4. Epic members by user (guild queries)
CREATE INDEX idx_epic_members_user 
ON epic_members(user_id);

-- 5. Evolution history by companion
CREATE INDEX idx_companion_evolutions_companion 
ON companion_evolutions(companion_id, stage);

-- 6. Activity feed by user + created_at (timeline)
CREATE INDEX idx_activities_user_created 
ON activities(user_id, created_at DESC);
```

**Add migration**: `20251204_add_performance_indexes.sql`

---

#### **DB #2: Large JSONB Columns Without GIN Indexes**

**Found**: Several tables use JSONB for flexible storage:
- `profiles.preferences` - user settings
- `profiles.onboarding_data` - form responses
- `daily_tasks.recurrence_days` - array stored as JSONB

**Problem**: Querying JSONB without index is slow.

**Fix**: Add GIN indexes for queried fields:

```sql
-- If you query preferences by specific keys
CREATE INDEX idx_profiles_preferences_gin 
ON profiles USING GIN (preferences);

-- If you filter by epic templates' habits
CREATE INDEX idx_epic_templates_habits_gin 
ON epic_templates USING GIN (habits);
```

---

#### **DB #3: No Soft Deletes on Critical Tables**

**Issue**: Deleting tasks, companions, or epics is permanent. No audit trail, no recovery.

**Affected tables**:
- `daily_tasks` - user accidentally deletes main quest
- `user_companion` - admin accidentally resets user's companion
- `epics` - epic creator accidentally deletes shared epic

**Fix**: Add soft delete pattern:

```sql
-- Migration: add_soft_deletes.sql
ALTER TABLE daily_tasks ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE epics ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE user_companion ADD COLUMN deleted_at TIMESTAMPTZ;

-- Update queries to filter out deleted
CREATE VIEW daily_tasks_active AS
SELECT * FROM daily_tasks WHERE deleted_at IS NULL;

-- Update RLS policies
CREATE POLICY "Users can view active tasks"
ON daily_tasks FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);
```

---

#### **DB #4: Potential Data Race in `update_epic_progress` Function**

**Location**: `20251129040000_fix_epic_progress_trigger.sql`

**Function**: Calculates epic progress on habit completion

**Issue**: If 2 users complete habits in same epic simultaneously, trigger fires twice concurrently.

**Potential fix**: Use advisory locks:

```sql
CREATE OR REPLACE FUNCTION update_epic_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Acquire lock for this epic
  PERFORM pg_advisory_xact_lock(hashtext(NEW.epic_id::text));
  
  UPDATE epics
  SET progress_percentage = (
    -- calculation here
  )
  WHERE id = NEW.epic_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

#### **DB #5: Unused Tables or Columns**

**Potential candidates** (need verification):

```sql
-- Check for tables with 0 rows in production
SELECT 
  schemaname, 
  tablename, 
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE n_live_tup = 0
ORDER BY tablename;

-- Check for columns never queried (manual review needed)
-- Candidates: profiles.onboarding_data might be duplicated in other tables
```

**Action**: Run analysis and create cleanup migration.

---

### Edge Function Issues

#### **Edge #1: No Rate Limiting on Expensive Functions**

**Found**: `rateLimiter.ts` exists with limits defined, but not applied to all functions.

**Missing rate limits on**:
- `generate-companion-evolution` - VERY expensive (AI + image gen)
- `generate-guild-story` - expensive LLM call
- `mentor-chat` - has limit (50/day) but could be stricter

**Fix**: Apply rate limiting consistently:

```typescript
// In each edge function:
import { checkRateLimit, RATE_LIMITS } from '../_shared/rateLimiter.ts';

const result = await checkRateLimit(
  supabase, 
  userId, 
  'companion-evolution', 
  RATE_LIMITS['companion-evolution']
);

if (!result.allowed) {
  return createRateLimitResponse(result, corsHeaders);
}
```

---

#### **Edge #2: Error Responses Not Consistent**

**Found**: Some functions return `{ error: 'message' }`, others throw, others return `{ success: false }`.

**Fix**: Standardize error format:

```typescript
// _shared/errorResponse.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number = 500
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, corsHeaders: Record<string, string>) {
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
        }
      }),
      { status: error.status, headers: corsHeaders }
    );
  }
  
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }),
    { status: 500, headers: corsHeaders }
  );
}

// Usage:
try {
  // ... function logic
} catch (error) {
  return errorResponse(error, corsHeaders);
}
```

---

## 7. Prioritized Action Plan

### 🔴 **CRITICAL - Must Fix Before Production Launch**

| Priority | Task | File(s) | Effort | Impact |
|----------|------|---------|--------|--------|
| 🔴 **#1** | **Fix timezone handling in daily tasks** | `useDailyTasks.ts`, `useCalendarTasks.ts` | 8h | Data integrity |
| 🔴 **#2** | **Add error boundaries to all major routes** | `App.tsx`, all pages | 4h | Stability |
| 🔴 **#3** | **Fix subscription status refresh after purchase** | `useSubscription.ts`, `useAppleSubscription.ts` | 4h | Revenue loss |
| 🔴 **#4** | **Implement webhook idempotency for Apple IAP** | `apple-webhook/index.ts` | 6h | Payment integrity |

**Total Critical**: 22 hours (~3 days)

---

### 🟠 **HIGH PRIORITY - Launch Blockers**

| Priority | Task | File(s) | Effort | Impact |
|----------|------|---------|--------|--------|
| 🟠 **#5** | **Remove all console.log/warn, use logger** | 17 files | 2h | Production cleanliness |
| 🟠 **#6** | **Fix all `as any` type casts** | 13 files | 4h | Type safety |
| 🟠 **#7** | **Add database indexes** | New migration | 2h | Performance |
| 🟠 **#8** | **Split Admin.tsx into smaller components** | `Admin.tsx` | 6h | Maintainability |
| 🟠 **#9** | **Split Tasks.tsx into smaller components** | `Tasks.tsx` | 8h | Maintainability |
| 🟠 **#10** | **Add soft deletes to critical tables** | New migration | 3h | Data safety |
| 🟠 **#11** | **Validate birth chart input data** | `Onboarding.tsx`, `Horoscope.tsx` | 4h | Accuracy |
| 🟠 **#12** | **Fix horoscope cache key to include date** | `Horoscope.tsx` | 1h | Correctness |
| 🟠 **#13** | **Add OAuth redirect whitelist** | `Auth.tsx`, `redirectUrl.ts` | 2h | Security |
| 🟠 **#14** | **Prevent completed task deletion** | `useDailyTasks.ts` | 2h | XP farming |
| 🟠 **#15** | **Apply rate limiting to all AI functions** | Edge functions | 4h | Cost control |
| 🟠 **#16** | **Standardize edge function error responses** | `_shared/`, all functions | 6h | DX + reliability |

**Total High Priority**: 44 hours (~5.5 days)

---

### 🟡 **MEDIUM PRIORITY - Performance & DX**

| Priority | Task | File(s) | Effort | Impact |
|----------|------|---------|--------|--------|
| 🟡 **#17** | **Extract magic numbers to constants** | Multiple | 1h | Maintainability |
| 🟡 **#18** | **Create unified XPService class** | New file + 3 hooks | 6h | Code reuse |
| 🟡 **#19** | **Memoize TaskCard and other list items** | Components | 3h | Performance |
| 🟡 **#20** | **Fix getThreshold in useMemo deps** | `useCompanion.ts` | 1h | Performance |
| 🟡 **#21** | **Add pagination to activity feed** | `ActivityTimeline.tsx` | 4h | Performance |
| 🟡 **#22** | **Add pagination to pep talks library** | `Library.tsx` | 4h | Performance |
| 🟡 **#23** | **Optimize epic progress calculation** | New migration + hook | 4h | Performance |
| 🟡 **#24** | **Add TypeScript strict mode** | `tsconfig.json` | 2h | Type safety |
| 🟡 **#25** | **Add ESLint rules** | `eslint.config.js` | 1h | Code quality |
| 🟡 **#26** | **Add type generation script** | `package.json` | 1h | DX |
| 🟡 **#27** | **Background job queue for AI operations** | New infrastructure | 12h | Reliability |
| 🟡 **#28** | **Add session refresh error handling** | `App.tsx` | 2h | UX |
| 🟡 **#29** | **Fix iOS audio autoplay** | `TodaysPepTalk.tsx` | 2h | UX |
| 🟡 **#30** | **Add habit frequency validation tests** | `useCalendarTasks.ts` + tests | 4h | Correctness |
| 🟡 **#31** | **Fix evolution mid-crash recovery** | `useCompanion.ts` + migration | 6h | Stability |
| 🟡 **#32** | **Add advisory locks to epic progress** | Migration | 2h | Data integrity |
| 🟡 **#33** | **Clean up unused tables/columns** | New migration | 4h | Performance |
| 🟡 **#34** | **Add deletion race condition fix** | `useDailyTasks.ts` | 1h | Correctness |

**Total Medium Priority**: 60 hours (~7.5 days)

---

### 🟢 **NICE TO HAVE - Polish & Future**

| Priority | Task | File(s) | Effort | Impact |
|----------|------|---------|--------|--------|
| 🟢 **#35** | **Add component documentation / Storybook** | New | 16h | DX |
| 🟢 **#36** | **Dead code analysis and removal** | Multiple | 8h | Bundle size |
| 🟢 **#37** | **Virtual scrolling for long lists** | `ActivityTimeline.tsx` etc. | 8h | Performance |
| 🟢 **#38** | **Add Sentry or error tracking service** | New | 4h | Observability |
| 🟢 **#39** | **Add analytics event tracking** | Multiple | 6h | Product insights |
| 🟢 **#40** | **Add E2E tests for critical flows** | New | 20h | Confidence |
| 🟢 **#41** | **Add unit tests for utility functions** | New | 12h | Confidence |
| 🟢 **#42** | **Refactor context to Zustand** | Contexts | 8h | Performance |
| 🟢 **#43** | **Add loading skeleton screens** | Pages | 6h | UX |
| 🟢 **#44** | **Add offline mode support** | Multiple | 16h | UX |
| 🟢 **#45** | **Migrate to Supabase Realtime v2** | Multiple | 8h | Performance |
| 🟢 **#46** | **Add companion image caching** | `useCompanion.ts` | 4h | Performance |
| 🟢 **#47** | **Add bundle size analysis** | `package.json` | 2h | Performance |
| 🟢 **#48** | **Add database query logging** | Supabase | 4h | Debugging |
| 🟢 **#49** | **Refund webhook handler** | New edge function | 6h | Completeness |

**Total Nice to Have**: 128 hours (~16 days)

---

## Summary & Recommendations

### Top 10 Issues to Address First

1. ⚠️ **Timezone handling bug** - Critical data issue
2. ⚠️ **Error boundaries missing** - App crashes entirely on errors
3. ⚠️ **Subscription refresh race** - Revenue loss potential
4. ⚠️ **Apple IAP webhook** - Payment processing issue
5. ⚠️ **Remove console.log** - Production cleanliness
6. ⚠️ **Fix type casts** - Runtime bugs waiting to happen
7. ⚠️ **Database indexes** - Performance bottleneck
8. ⚠️ **Split large components** - Maintenance nightmare
9. ⚠️ **Soft deletes** - Data loss prevention
10. ⚠️ **Rate limiting** - Cost control

### Estimated Timeline for Production Readiness

- **Critical fixes**: 3 days
- **High priority**: 5.5 days
- **Medium priority** (recommended): 7.5 days

**Total recommended before launch**: ~16 days of focused development

### Architecture Score Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Code Organization | 8/10 | Good structure, but huge files |
| Type Safety | 6/10 | Too many `as any`, need strict mode |
| Error Handling | 7/10 | Good in places, inconsistent overall |
| Performance | 6/10 | Major issues with large lists, renders |
| Database Design | 8/10 | Well-designed, needs indexes |
| Security | 7/10 | Good RLS, minor OAuth issue |
| Testing | 2/10 | No tests found! |
| Documentation | 5/10 | Many READMEs, but code docs sparse |

**Overall**: 7.5/10 - Good foundation, needs polish for production

---

## Next Steps

I can help you implement any of these fixes. Would you like me to:

1. **Start with Critical fixes** (#1-4) immediately?
2. **Create detailed implementation plans** for specific issues?
3. **Generate the migration files** for database changes?
4. **Refactor a specific large component** (Admin or Tasks)?
5. **Set up testing infrastructure** for critical flows?

Let me know which area you'd like to prioritize, and I'll begin implementation.
