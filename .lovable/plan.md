
# Fix: Resist Button Not Triggering Astral Encounter

## Problem Diagnosis

The Resist button calls `checkEncounterTrigger` but no game appears. This is a **state isolation bug**:

| Component | Calls `useAstralEncounters()` | Has Modal? |
|-----------|------------------------------|------------|
| `AstralEncounterProvider` | ✅ Own instance | ✅ Renders modal |
| `ResistModePanel` | ✅ **Separate instance** | ❌ No modal |

When `ResistModePanel` triggers an encounter, it updates state in its **isolated hook instance**. The modal is rendered by `AstralEncounterProvider`, which has a completely **separate state** that never updates.

## Root Cause

The `useAstralEncounters` hook uses internal `useState`:
```typescript
// useAstralEncounters.ts lines 38-43
const [activeEncounter, setActiveEncounter] = useState<...>(null);
const [showEncounterModal, setShowEncounterModal] = useState(false);
```

Each component calling this hook gets its own copy of these state values.

---

## Solution: Create Shared Context

Wrap the encounter state in a React Context so all components share the same instance.

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/contexts/AstralEncounterContext.tsx` | **Create** - New context provider |
| `src/components/astral-encounters/AstralEncounterProvider.tsx` | **Modify** - Use context internally |
| `src/components/companion/ResistModePanel.tsx` | **Modify** - Use context instead of hook |
| `src/hooks/useAstralEncounters.ts` | **Keep** - Core logic remains, used by context |

---

## Implementation Details

### 1. Create `AstralEncounterContext.tsx`

New context that wraps the hook and exposes its values:

```typescript
// src/contexts/AstralEncounterContext.tsx
import { createContext, useContext } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';

// Create context with the return type of the hook
type AstralEncounterContextType = ReturnType<typeof useAstralEncounters>;

const AstralEncounterContext = createContext<AstralEncounterContextType | null>(null);

export const AstralEncounterContextProvider = ({ children }) => {
  const encounterState = useAstralEncounters();
  return (
    <AstralEncounterContext.Provider value={encounterState}>
      {children}
    </AstralEncounterContext.Provider>
  );
};

export const useAstralEncounterContext = () => {
  const context = useContext(AstralEncounterContext);
  if (!context) {
    throw new Error('useAstralEncounterContext must be used within AstralEncounterContextProvider');
  }
  return context;
};
```

### 2. Update `AstralEncounterProvider.tsx`

- Wrap children with the new context provider
- Use `useAstralEncounterContext()` instead of `useAstralEncounters()` for modal rendering

### 3. Update `ResistModePanel.tsx`

Change from:
```typescript
const { checkEncounterTrigger } = useAstralEncounters();
```

To:
```typescript
const { checkEncounterTrigger } = useAstralEncounterContext();
```

This ensures the `ResistModePanel` uses the **same state instance** as the provider that renders the modal.

---

## Data Flow After Fix

```text
User presses "Resist"
        ↓
ResistModePanel.handleResist()
        ↓
useAstralEncounterContext().checkEncounterTrigger()
        ↓
Shared context state updates:
  - activeEncounter = { adversary, encounter }
  - showEncounterModal = true (via effect in provider)
        ↓
AstralEncounterProvider re-renders
        ↓
AstralEncounterModal opens with game
```

---

## Expected Behavior After Fix

1. Press **Resist** button on any habit
2. Trigger overlay animation appears
3. Mini-game modal opens with randomly selected game
4. Complete game → rewards applied, habit stats updated
