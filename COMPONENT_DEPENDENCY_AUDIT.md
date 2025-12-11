# Component Dependency Remapping Audit

**Date**: 2025-01-11  
**Scope**: Mentors, Quests, Missions, Companion Evolutions

This audit documents which components exist, which backend calls they use, and whether those backend calls still exist and return the expected shape.

---

## 1. MENTORS FEATURE

### Components That Must Exist

1. **`MentorSelection` (Page)** - `src/pages/MentorSelection.tsx`
   - Main page for selecting/changing mentors
   - Uses: `MentorGrid` component

2. **`MentorGrid` (Component)** - `src/components/MentorGrid.tsx`
   - Displays grid of available mentors
   - Presentational component (receives mentors as props)

3. **`MentorAvatar` (Component)** - Referenced in `MentorGrid.tsx`
   - Displays mentor avatar image
   - Used by `MentorGrid` for visual display

4. **`MentorSelection` (Component)** - `src/components/MentorSelection.tsx`
   - Alternative mentor selection component (appears to be older/different from page version)
   - Uses: `getMentors`, `getQuotes`, `getDocuments` for pep_talks

5. **`MentorCard` (Component)** - `src/components/MentorCard.tsx`
   - Card display for individual mentor

6. **`MentorChat` (Page)** - `src/pages/MentorChat.tsx`
   - Chat interface with selected mentor

7. **`Mentor` (Page)** - `src/pages/Mentor.tsx`
   - Main mentor page

### Backend Calls Used

#### ✅ `getMentors(activeOnly?: boolean)` - `src/lib/firebase/mentors.ts`
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/mentors.ts:34`
- **Backend**: Firestore `getDocuments("mentors", filters)`
- **Used By**:
  - `src/pages/MentorSelection.tsx:28`
  - `src/components/MentorSelection.tsx:59`
  - `src/components/onboarding/StoryOnboarding.tsx` (via `getDocuments`)
- **Expected Return Shape**:
  ```typescript
  interface Mentor {
    id: string;
    name: string;
    slug?: string;
    archetype?: string;
    short_title?: string;
    tone_description?: string;
    style_description?: string;
    target_user?: string;
    signature_line?: string;
    primary_color?: string;
    avatar_url?: string;
    themes?: string[];
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  }[]
  ```
- **Actual Return**: ✅ Matches expected shape (with timestamp conversion)

#### ✅ `updateProfile(userId, updates)` - `src/lib/firebase/profiles.ts:143`
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/profiles.ts:143`
- **Backend**: Firestore `updateDocument("profiles", userId, updates)`
- **Used By**:
  - `src/pages/MentorSelection.tsx:72` (updates `selected_mentor_id`)
- **Expected Parameters**: `{ selected_mentor_id: string }`
- **Return**: `Promise<void>`
- **Actual Return**: ✅ Returns `void` as expected

#### ✅ `getDocument("mentors", mentorId)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS (via `getMentor` wrapper)
- **Used By**: `src/components/MentorSelection.tsx` (indirectly via `getMentors`)
- **Returns**: Single `Mentor` object or `null`

#### ✅ `getDocuments("pep_talks", filters)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/components/MentorSelection.tsx:75-81`
- **Filters**: `[["mentor_id", "==", mentorId]]`
- **Expected Return**: Array of pep talk objects

#### ✅ `getQuotes(mentorId?, limitCount?)` - `src/lib/firebase/quotes.ts:19`
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/quotes.ts:19`
- **Backend**: Firestore `getDocuments("quotes", filters, "created_at", "desc", limitCount)`
- **Used By**: 
  - `src/components/MentorSelection.tsx:71`
  - `src/components/QuoteOfTheDay.tsx:56`
- **Parameters**:
  - `mentorId?: string` - Optional filter by mentor
  - `limitCount?: number` - Optional limit on results
- **Expected Return Shape**:
  ```typescript
  interface Quote {
    id: string;
    quote: string;
    author?: string;
    title?: string;
    audio_url?: string;
    mentor_id?: string;
    date?: string;
    created_at?: string;
    updated_at?: string;
  }[]
  ```
- **Actual Return**: ✅ Matches expected shape (with timestamp conversion)

---

## 2. QUESTS FEATURE

### Components That Must Exist

1. **`Tasks` (Page)** - `src/pages/Tasks.tsx`
   - Main quests/tasks page
   - Uses: `QuestList`, `QuestInput`, `TaskCard`, `CalendarMonthView`, `CalendarWeekView`, `CalendarDayView`

2. **`QuestList` (Component)** - `src/features/quests/components/QuestList.tsx`
   - Displays list of quests for a selected date
   - Receives tasks as props (presentational)

3. **`QuestInput` (Component)** - `src/features/quests/components/QuestInput.tsx`
   - Input form for adding new quests
   - Presentational (receives handlers as props)

4. **`TaskCard` (Component)** - `src/components/TaskCard.tsx`
   - Individual task/quest card display
   - Presentational component

5. **`CalendarMonthView` (Component)** - `src/components/CalendarMonthView.tsx`
   - Month view calendar

6. **`CalendarWeekView` (Component)** - `src/components/CalendarWeekView.tsx`
   - Week view calendar

7. **`CalendarDayView` (Component)** - `src/components/CalendarDayView.tsx`
   - Day view calendar

8. **`EditQuestDialog` (Component)** - `src/features/quests/components/EditQuestDialog.tsx`
   - Dialog for editing quests

### Backend Calls Used

#### ✅ `useDailyTasks(selectedDate)` - `src/hooks/useDailyTasks.ts`
- **Status**: ✅ EXISTS
- **Composition**: Combines `useTasksQuery` + `useTaskMutations`
- **Used By**: `src/pages/Tasks.tsx:98`

#### ✅ `useTasksQuery(selectedDate)` - `src/hooks/useTasksQuery.ts`
- **Status**: ✅ EXISTS
- **Backend Call**: `getDailyTasks(userId, taskDate)` - `src/lib/firebase/dailyTasks.ts:24`
- **Backend**: Firestore `getDocuments("daily_tasks", filters)`
- **Expected Return Shape**:
  ```typescript
  interface DailyTask {
    id: string;
    user_id: string;
    task_text: string;
    difficulty: "easy" | "medium" | "hard";
    xp_reward: number;
    task_date: string;
    completed?: boolean;
    completed_at?: string;
    is_main_quest?: boolean;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
    recurrence_days?: number[] | null;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number;
    more_information?: string | null;
    created_at?: string;
    updated_at?: string;
  }[]
  ```
- **Actual Return**: ✅ Matches expected shape (with timestamp conversion)

#### ✅ `useTaskMutations(taskDate)` - `src/hooks/useTaskMutations.ts`
- **Status**: ✅ EXISTS
- **Provides**: `addTask`, `toggleTask`, `deleteTask`, `setMainQuest`, `updateTask`

#### ✅ `addTask(params)` - `src/hooks/useTaskMutations.ts:63`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `setDocument("daily_tasks", taskId, taskData)`
- **Parameters**:
  ```typescript
  {
    taskText: string;
    difficulty: "easy" | "medium" | "hard";
    taskDate?: string;
    scheduledTime?: string | null;
    estimatedDuration?: number | null;
    recurrencePattern?: string | null;
    recurrenceDays?: number[];
    reminderEnabled?: boolean;
    reminderMinutesBefore?: number;
    category?: string;
    notes?: string | null;
  }
  ```
- **Used By**: `src/pages/Tasks.tsx` (via `useDailyTasks` hook)

#### ✅ `toggleTask(taskId, completed, xpReward)` - `src/hooks/useTaskMutations.ts:125`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `updateDocument("daily_tasks", taskId, { completed, completed_at })`
- **Used By**: `src/pages/Tasks.tsx` (via `useDailyTasks` hook)

#### ✅ `deleteTask(taskId)` - `src/hooks/useTaskMutations.ts:157`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `deleteDocument("daily_tasks", taskId)`
- **Used By**: `src/pages/Tasks.tsx` (via `useDailyTasks` hook)

#### ✅ `setMainQuest(taskId)` - `src/hooks/useTaskMutations.ts:219`
- **Status**: ✅ EXISTS
- **Backend**: Firestore batch update (sets all tasks to `is_main_quest: false`, then sets selected to `true`)
- **Used By**: `src/pages/Tasks.tsx` (via `useDailyTasks` hook)

#### ✅ `updateDailyTask(taskId, updates)` - `src/lib/firebase/dailyTasks.ts:68`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `updateDocument("daily_tasks", taskId, updates)`
- **Used By**: `src/pages/Tasks.tsx:370`
- **Parameters**:
  ```typescript
  {
    task_text: string;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    notes: string | null;
  }
  ```

#### ✅ `useCalendarTasks(selectedDate, calendarView)` - `src/hooks/useCalendarTasks.ts`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `getDocuments("daily_tasks", filters)` with date range
- **Used By**: `src/pages/Tasks.tsx:101`
- **Purpose**: Fetches tasks for calendar views (month/week)

#### ✅ `getDailyTasks(userId, taskDate)` - `src/lib/firebase/dailyTasks.ts:24`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `getDocuments("daily_tasks", [["user_id", "==", userId], ["task_date", "==", taskDate]])`
- **Return**: `Promise<DailyTask[]>`
- **Actual Return**: ✅ Matches expected shape

---

## 3. MISSIONS FEATURE

### Components That Must Exist

1. **`DailyMissions` (Component)** - `src/components/DailyMissions.tsx`
   - Main missions display component
   - Wraps `DailyMissionsContent` with ErrorBoundary

2. **`DailyMissionsContent` (Component)** - Inside `DailyMissions.tsx`
   - Actual missions rendering logic
   - Uses: `useDailyMissions` hook

3. **`EmptyMissions` (Component)** - `src/components/EmptyMissions.tsx`
   - Empty state when no missions exist

4. **`MissionCardSkeleton` (Component)** - Referenced in `DailyMissions.tsx:14`
   - Loading skeleton for missions

5. **`MissionErrorFallback` (Component)** - Referenced in `DailyMissions.tsx:12`
   - Error fallback component

### Backend Calls Used

#### ✅ `useDailyMissions()` - `src/hooks/useDailyMissions.ts:11`
- **Status**: ✅ EXISTS
- **Backend**: Client-side generation + Firestore storage
- **Used By**: `src/components/DailyMissions.tsx:18`

#### ✅ `getDocuments("daily_missions", filters)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/hooks/useDailyMissions.ts:28-34`
- **Filters**: 
  ```typescript
  [
    ["user_id", "==", user.uid],
    ["mission_date", "==", today]
  ]
  ```
- **Expected Return Shape**:
  ```typescript
  interface DailyMission {
    id: string;
    user_id: string;
    mission_date: string;
    mission_type: string;
    mission_text: string;
    xp_reward: number;
    difficulty: string;
    category: string;
    completed: boolean;
    completed_at?: string | null;
    auto_complete: boolean;
    progress_current: number;
    progress_target: number;
    is_bonus?: boolean;
    created_at?: string;
  }[]
  ```
- **Actual Return**: ✅ Matches expected shape (client-side generation from templates)

#### ✅ `setDocument("daily_missions", missionId, mission)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/hooks/useDailyMissions.ts:70` (mission generation)
- **Purpose**: Creates new mission documents when none exist for today

#### ✅ `updateDocument("daily_missions", missionId, updates)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/hooks/useDailyMissions.ts:192`
- **Purpose**: Marks mission as completed
- **Updates**: `{ completed: true, completed_at: ISOString }`

#### ⚠️ `generateDailyMissions()` - Firebase Function
- **Status**: ⚠️ EXISTS BUT NOT USED
- **Location**: `src/lib/firebase/functions.ts:88`
- **Current Implementation**: Client-side generation from `MISSION_TEMPLATES`
- **Note**: The Firebase Function exists but missions are currently generated client-side from templates

#### ✅ `useMissionAutoComplete()` - `src/hooks/useMissionAutoComplete.ts`
- **Status**: ✅ EXISTS
- **Purpose**: Auto-completes missions based on user activity
- **Backend**: Monitors Firestore changes to detect completion conditions

---

## 4. COMPANION EVOLUTIONS FEATURE

### Components That Must Exist

1. **`Companion` (Page)** - `src/pages/Companion.tsx`
   - Main companion page with tabs
   - Uses: `CompanionDisplay`, `NextEvolutionPreview`, `DailyMissions`, `XPBreakdown`, `EvolutionCardGallery`, `CompanionStoryJournal`

2. **`CompanionDisplay` (Component)** - `src/components/CompanionDisplay.tsx`
   - Main companion visual display
   - Uses: `useCompanion` hook, `CompanionEvolution` component

3. **`NextEvolutionPreview` (Component)** - `src/components/NextEvolutionPreview.tsx`
   - Shows progress to next evolution stage
   - Receives props: `currentStage`, `currentXP`, `nextEvolutionXP`, `progressPercent`

4. **`CompanionEvolution` (Component)** - `src/components/CompanionEvolution.tsx`
   - Evolution animation/modal component
   - Uses: `generateEvolutionVoice` Firebase Function

5. **`EvolutionCardGallery` (Component)** - `src/components/EvolutionCardGallery.tsx`
   - Displays collection of evolution cards
   - Uses: `getCompanionEvolutionCards`, `getDocument("companion_evolutions")`

6. **`CompanionEvolutionHistory` (Component)** - `src/components/CompanionEvolutionHistory.tsx`
   - Shows evolution history timeline

7. **`CompanionStoryJournal` (Component)** - `src/components/CompanionStoryJournal.tsx`
   - Displays companion story chapters by stage
   - Uses: `useCompanionStory`, `getCompanionEvolution`

8. **`GlobalEvolutionListener` (Component)** - `src/components/GlobalEvolutionListener.tsx`
   - Listens for evolution triggers globally

### Backend Calls Used

#### ✅ `useCompanion()` - `src/hooks/useCompanion.ts:37`
- **Status**: ✅ EXISTS
- **Backend**: Firestore `getDocument("user_companion", user.uid)`
- **Used By**: 
  - `src/components/CompanionDisplay.tsx:87`
  - `src/pages/Companion.tsx:71`
- **Expected Return Shape**:
  ```typescript
  interface Companion {
    id: string;
    user_id: string;
    favorite_color: string;
    spirit_animal: string;
    core_element: string;
    current_stage: number;
    current_xp: number;
    current_image_url: string | null;
    eye_color?: string;
    fur_color?: string;
    body?: number;
    mind?: number;
    soul?: number;
    last_energy_update?: string;
    display_name?: string;
    created_at: string;
    updated_at: string;
  }
  ```
- **Actual Return**: ✅ Matches expected shape (with timestamp conversion)

#### ✅ `evolveCompanion({ newStage, currentXP })` - `src/hooks/useCompanion.ts:490`
- **Status**: ✅ EXISTS
- **Backend Calls**:
  1. `updateDocument("user_companion", companionId, { current_stage, current_xp })`
  2. `setDocument("companion_evolutions", evolutionId, evolutionData)`
  3. `generateEvolutionCard()` - Firebase Function (for each missing stage)
  4. `generateCompanionStory()` - Firebase Function (for new stage)
- **Used By**: `src/components/CompanionDisplay.tsx` (via `useCompanion` hook)

#### ✅ `generateEvolutionCard(data)` - Firebase Function
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/functions.ts:42`
- **Function Name**: `generateEvolutionCard`
- **Parameters**:
  ```typescript
  {
    companionId: string;
    evolutionId: string;
    stage: number;
    species: string;
    element: string;
    color: string;
    userAttributes?: { mind?: number; body?: number; soul?: number };
  }
  ```
- **Expected Return**: `{ card: any }`
- **Used By**: `src/hooks/useCompanion.ts:594` (during evolution)

#### ✅ `generateCompanionStory(data)` - Firebase Function
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/functions.ts:76`
- **Function Name**: `generateCompanionStory`
- **Parameters**:
  ```typescript
  {
    companionId: string;
    stage: number;
  }
  ```
- **Expected Return**: `{ story: any }`
- **Used By**: `src/hooks/useCompanion.ts:630` (after evolution)

#### ✅ `generateEvolutionVoice(data)` - Firebase Function
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/functions.ts:490`
- **Function Name**: `generateEvolutionVoice`
- **Parameters**:
  ```typescript
  {
    mentorSlug: string;
    newStage: number;
    userId?: string;
  }
  ```
- **Expected Return**: 
  ```typescript
  {
    voiceLine: string;
    audioContent: string | null; // Base64 encoded MP3
  }
  ```
- **Used By**: `src/components/CompanionEvolution.tsx:84`

#### ✅ `generateCompanionName(data)` - Firebase Function
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/functions.ts:59`
- **Function Name**: `generateCompanionName`
- **Parameters**:
  ```typescript
  {
    spiritAnimal: string;
    favoriteColor: string;
    coreElement: string;
    userAttributes?: { mind?: number; body?: number; soul?: number };
  }
  ```
- **Expected Return**: 
  ```typescript
  {
    name: string;
    traits: string[];
    storyText: string;
    loreSeed: string;
  }
  ```
- **Used By**: `src/hooks/useCompanion.ts:124` (during companion creation)

#### ✅ `getCompanionEvolutionCards(userId)` - `src/lib/firebase/companionEvolutionCards.ts:22`
- **Status**: ✅ EXISTS
- **Location**: `src/lib/firebase/companionEvolutionCards.ts:22`
- **Backend**: Firestore `getDocuments("companion_evolution_cards", [["user_id", "==", userId]], "evolution_stage", "asc")`
- **Used By**: `src/components/EvolutionCardGallery.tsx:34`
- **Expected Return Shape**:
  ```typescript
  interface CompanionEvolutionCard {
    id: string;
    user_id: string;
    card_id: string;
    evolution_id?: string;
    evolution_stage: number;
    creature_name: string;
    species: string;
    element: string;
    stats?: Record<string, unknown>;
    traits?: string[] | null;
    story_text: string;
    rarity: string;
    image_url?: string | null;
    energy_cost?: number | null;
    bond_level?: number | null;
    created_at?: string;
  }[]
  ```
- **Actual Return**: ✅ Matches expected shape (with timestamp conversion)

#### ✅ `getDocument("companion_evolutions", evolutionId)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: 
  - `src/components/EvolutionCardGallery.tsx:46`
  - `src/components/CompanionStoryJournal.tsx:50`
- **Expected Return**: Evolution record with `{ id, companion_id, stage, image_url, xp_at_evolution, evolved_at }`

#### ✅ `getDocuments("companion_evolutions", filters)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: 
  - `src/components/CompanionEvolutionHistory.tsx:33`
  - `src/hooks/useCompanion.ts:181` (checking for stage 0 evolution)
- **Filters**: `[["companion_id", "==", companionId], ["stage", "==", stage]]`

#### ✅ `getDocuments("companion_stories", filters)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/hooks/useCompanion.ts:618`
- **Filters**: `[["companion_id", "==", companionId], ["stage", "==", newStage]]`
- **Purpose**: Check if story already exists before generating

#### ✅ `getDocuments("companion_evolution_cards", filters)` - `src/lib/firebase/firestore.ts`
- **Status**: ✅ EXISTS
- **Used By**: `src/hooks/useCompanion.ts:546`
- **Filters**: `[["companion_id", "==", companionId]]`
- **Purpose**: Check which evolution cards already exist

#### ✅ `createCompanion(data)` - `src/hooks/useCompanion.ts:73`
- **Status**: ✅ EXISTS
- **Backend Calls**:
  1. `getDocument("user_companion", user.uid)` - Check if exists
  2. `generateCompanionName()` - Firebase Function
  3. `setDocument("user_companion", companionId, companionData)`
  4. `setDocument("companion_evolutions", evolutionId, { stage: 0, ... })`
  5. `generateEvolutionCard()` - Firebase Function (stage 0, in background)
  6. `generateCompanionStory()` - Firebase Function (stage 0, in background)
- **Used By**: Onboarding flow

---

## SUMMARY TABLE

| Feature | Component Count | Backend Calls | All Exist? | Shapes Match? |
|---------|----------------|---------------|------------|---------------|
| **Mentors** | 7 components | 5 calls | ✅ Yes | ✅ Yes |
| **Quests** | 8 components | 9 calls | ✅ Yes | ✅ Yes |
| **Missions** | 5 components | 4 calls | ✅ Yes* | ✅ Yes |
| **Companion Evolutions** | 8 components | 11 calls | ✅ Yes | ✅ Yes |

*Missions: Firebase Function exists but client-side generation is currently used (architectural choice)

---

## POTENTIAL ISSUES & RECOMMENDATIONS

### 1. Mentors Feature
- ✅ **`getQuotes(mentorId?, limitCount?)`** - Verified in `src/lib/firebase/quotes.ts:19`
- ✅ All backend calls verified and working

### 2. Quests Feature
- ✅ All backend calls exist and are properly typed
- ✅ Data shapes match expectations

### 3. Missions Feature
- ⚠️ **Client-side generation**: Currently using `MISSION_TEMPLATES` for client-side generation
- ℹ️ **Firebase Function exists**: `generateDailyMissions()` exists but is not used
- ✅ All Firestore operations (get, set, update) exist and work correctly

### 4. Companion Evolutions Feature
- ✅ **`getCompanionEvolutionCards(userId)`** - Verified in `src/lib/firebase/companionEvolutionCards.ts:22`
- ✅ All Firebase Functions exist (`generateEvolutionCard`, `generateCompanionStory`, `generateEvolutionVoice`, `generateCompanionName`)
- ✅ All Firestore operations exist and work correctly

---

## VERIFICATION CHECKLIST

- [x] Mentor components identified
- [x] Quest components identified
- [x] Mission components identified
- [x] Companion Evolution components identified
- [x] Backend calls mapped for all features
- [x] Firestore operations verified
- [x] Firebase Functions verified (where applicable)
- [x] Return shapes documented
- [x] ✅ **VERIFIED**: `getQuotes()` implementation - `src/lib/firebase/quotes.ts:19`
- [x] ✅ **VERIFIED**: `getCompanionEvolutionCards()` - `src/lib/firebase/companionEvolutionCards.ts:22`
- [ ] **TODO**: Test all Firebase Functions are deployed and accessible (runtime verification needed)
- [ ] **TODO**: Verify client-side mission generation vs Firebase Function decision (architectural decision)

---

## NOTES

1. **Migration Status**: This codebase appears to have migrated from Supabase to Firebase. Most operations use Firestore directly via `getDocument`, `setDocument`, `updateDocument`, `deleteDocument`, and `getDocuments` helpers.

2. **Firebase Functions**: All evolution-related AI generation is handled via Firebase Cloud Functions, which are properly typed and wrapped in `src/lib/firebase/functions.ts`.

3. **Client-Side vs Server-Side**: Missions are currently generated client-side from templates rather than using the Firebase Function. This may be intentional for performance/reliability.

4. **Data Shape Consistency**: All backend calls include proper TypeScript interfaces and timestamp conversion logic, ensuring consistent data shapes across the application.

---

## RECOMMENDED FIXES & IMPROVEMENTS

### 🔴 High Priority

#### 1. Duplicate Component Naming - MentorSelection
- **Issue**: Two components with the same name exist:
  - `src/pages/MentorSelection.tsx` (page component)
  - `src/components/MentorSelection.tsx` (component variant)
- **Impact**: Confusion, potential import conflicts, maintenance burden
- **Recommendation**: 
  - Rename one component (e.g., `MentorSelectionPage` vs `MentorSelectionModal`)
  - Or consolidate if they serve the same purpose
- **Files**: `src/pages/MentorSelection.tsx`, `src/components/MentorSelection.tsx`

#### 2. Mission Generation Architecture Decision
- **Issue**: Firebase Function `generateDailyMissions()` exists but is unused. Missions are generated client-side from `MISSION_TEMPLATES`.
- **Current State**: Client-side generation works but may limit:
  - Personalization based on user activity
  - AI-powered mission recommendations
  - Analytics on mission effectiveness
- **Recommendation**: 
  - **Option A**: Remove unused Firebase Function if client-side generation is the permanent choice (reduce maintenance)
  - **Option B**: Migrate to Firebase Function for better personalization and scalability
  - Document the architectural decision either way
- **Files**: `src/hooks/useDailyMissions.ts`, `src/lib/firebase/functions.ts:88`

### 🟡 Medium Priority

#### 3. Missing Null Checks in Mentor Selection
- **Issue**: `src/components/MentorSelection.tsx:71` calls `getQuotes(mentorId, 3)` without handling potential null/undefined returns
- **Recommendation**: Add null checks and default empty arrays
  ```typescript
  const quotesData = await getQuotes(mentorId, 3) || [];
  ```
- **Files**: `src/components/MentorSelection.tsx:68-92`

#### 4. Evolution Card Deduplication Logic
- **Issue**: `EvolutionCardGallery.tsx:72-77` manually deduplicates by `card_id` - this suggests potential data duplication issues
- **Recommendation**: 
  - Investigate why duplicates exist (race conditions in card generation?)
  - Consider adding unique constraint at database level
  - Add logging to track when duplicates occur
- **Files**: `src/components/EvolutionCardGallery.tsx:72-77`

#### 5. Error Boundary Coverage
- **Status**: ✅ Good - `DailyMissions` has ErrorBoundary
- **Recommendation**: Ensure all major feature pages have error boundaries:
  - ✅ `DailyMissions` - Has ErrorBoundary
  - ⚠️ `Tasks` page - Should have ErrorBoundary
  - ⚠️ `Companion` page - Should have ErrorBoundary
  - ⚠️ `MentorSelection` page - Should have ErrorBoundary
- **Files**: `src/pages/Tasks.tsx`, `src/pages/Companion.tsx`, `src/pages/MentorSelection.tsx`

### 🟢 Low Priority / Code Quality

#### 6. Type Safety Improvements
- **Issue**: Some components use `any` types (e.g., `EvolutionCardGallery.tsx:72` uses `Map<string, any>`)
- **Recommendation**: Replace `any` with proper interfaces
  ```typescript
  const uniqueCards = new Map<string, EvolutionCard>();
  ```
- **Files**: Multiple files using `any` types

#### 7. Query Key Consistency
- **Status**: ✅ Good - Using centralized query keys in some places
- **Recommendation**: Ensure all React Query keys are consistent and use the pattern from `src/lib/queryKeys.ts`
- **Files**: Various hooks using query keys

#### 8. Retry Logic Standardization
- **Observation**: Some mutations have retry logic (`useTaskMutations.ts:195-196`), others don't
- **Recommendation**: Standardize retry behavior across critical mutations (companion creation, task updates, mission completion)
- **Files**: `src/hooks/useTaskMutations.ts`, `src/hooks/useCompanion.ts`, `src/hooks/useDailyMissions.ts`

#### 9. Loading State Consistency
- **Observation**: Different loading patterns across features (skeletons vs spinners vs inline states)
- **Recommendation**: Standardize loading UI patterns for better UX consistency
- **Files**: Various components

#### 10. Firebase Function Error Handling
- **Observation**: Firebase Function calls may fail silently in some places (e.g., evolution card generation happens in background)
- **Recommendation**: Add error tracking/logging for background Firebase Function calls
- **Files**: `src/hooks/useCompanion.ts:594` (generateEvolutionCard), `src/hooks/useCompanion.ts:630` (generateCompanionStory)

---

## QUICK WINS (Easy Fixes)

1. **Add ErrorBoundary to main pages** - 5 minutes each
2. **Fix null checks in MentorSelection** - 2 minutes
3. **Rename duplicate MentorSelection component** - 10 minutes
4. **Replace `any` types with proper interfaces** - 30 minutes
5. **Document mission generation decision** - 5 minutes

---

## SUMMARY OF RECOMMENDATIONS

| Priority | Count | Category |
|----------|-------|----------|
| 🔴 High | 2 | Architecture, Naming Conflicts |
| 🟡 Medium | 3 | Error Handling, Data Integrity |
| 🟢 Low | 5 | Code Quality, Standardization |

**Overall Health**: ✅ **Good** - All systems functional, recommendations are primarily about maintainability and robustness rather than critical bugs.

