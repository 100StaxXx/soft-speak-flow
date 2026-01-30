
# Complete Testing Setup + Remaining Query Fixes

## Overview

This plan covers three interrelated tasks:
1. **Fix 4 remaining unsafe `.single()` queries** (immediate stability)
2. **Set up Vitest testing framework** (infrastructure)
3. **Create tests for core hooks** (verification + future safety)

---

## Part 1: Fix Remaining Unsafe Queries

### Files Requiring Changes

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `src/hooks/useEncounterTrigger.ts` | 41, 88 | Profile SELECT with `.single()` | `.maybeSingle()` + null guard |
| `src/hooks/useEncounterTrigger.ts` | 161 | Epic SELECT with `.single()` | `.maybeSingle()` + null guard |
| `src/hooks/useCommunity.ts` | 99 | Community SELECT by ID | `.maybeSingle()` + null guard |
| `src/hooks/useJourneyPathImage.ts` | 31 | Uses `.single()` with manual PGRST116 check | Convert to `.maybeSingle()` (cleaner) |
| `src/hooks/useCompanionPostcards.ts` | 205 | Milestone SELECT with `.single()` | `.maybeSingle()` + null guard |

### Implementation Details

**useEncounterTrigger.ts** - 3 fixes:
```typescript
// Line 41: Profile check
const { data: profile, error } = await supabase
  .from('profiles')
  .select('...')
  .eq('id', user.id)
  .maybeSingle();

if (error) { /* handle */ }
if (!profile) return false; // No profile yet

// Line 88: Activity count fetch
.maybeSingle();
if (error || !profile) { /* already handles correctly */ }

// Line 161: Epic category lookup
.maybeSingle();
const text = `${epic?.title || ''} ${epic?.description || ''}`.toLowerCase();
```

**useCommunity.ts** - 1 fix:
```typescript
// Line 99: Single community fetch
.maybeSingle();

if (error) throw error;
return data as Community | null; // Allow null return
```

**useJourneyPathImage.ts** - 1 fix (cleanup):
```typescript
// Line 25-37: Remove manual PGRST116 handling, use maybeSingle
const { data, error } = await supabase
  .from("epic_journey_paths")
  .select("*")
  .eq("epic_id", epicId)
  .order("milestone_index", { ascending: false })
  .limit(1)
  .maybeSingle();

if (error) {
  console.error("Error fetching journey path:", error);
  throw error;
}

return data as JourneyPath | null;
```

**useCompanionPostcards.ts** - 1 fix:
```typescript
// Line 205: Milestone lookup
.maybeSingle();

if (error) {
  console.error("Failed to fetch milestone:", error);
  return;
}
if (!milestone) {
  console.log("Milestone not found");
  return;
}
```

---

## Part 2: Vitest Testing Framework Setup

### New Dependencies

Add to `package.json` devDependencies:
```json
"@testing-library/jest-dom": "^6.6.0",
"@testing-library/react": "^16.0.0",
"jsdom": "^20.0.3",
"vitest": "^3.2.4"
```

### New Files

**vitest.config.ts** (project root):
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

**src/test/setup.ts**:
```typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
```

### TypeScript Configuration

Update `tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"],
    // ... existing options
  }
}
```

---

## Part 3: Core Unit Tests

### Test Structure

```text
src/
├── test/
│   ├── setup.ts                    # Test setup/mocks
│   └── mocks/
│       └── supabase.ts             # Supabase client mock
├── utils/
│   └── epicMilestones.test.ts      # Pure function tests
└── hooks/
    └── __tests__/
        └── useProfile.test.tsx     # Hook integration tests
```

### Test 1: Epic Milestones (Pure Functions)

**src/utils/epicMilestones.test.ts**:
```typescript
import { describe, it, expect } from "vitest";
import {
  calculateTotalChapters,
  calculateChapterMilestones,
  getCurrentChapter,
  getNextMilestone,
  isChapterReached,
  getChapterProgress,
  shouldTriggerBossBattle,
} from "./epicMilestones";

describe("calculateTotalChapters", () => {
  it("returns base chapters for short epics", () => {
    expect(calculateTotalChapters(14, 3)).toBe(3);
    expect(calculateTotalChapters(29, 5)).toBe(5);
  });

  it("adds bonus chapter for 30+ day epics", () => {
    expect(calculateTotalChapters(30, 3)).toBe(4);
    expect(calculateTotalChapters(60, 5)).toBe(6);
  });
});

describe("calculateChapterMilestones", () => {
  it("distributes milestones evenly", () => {
    expect(calculateChapterMilestones(4)).toEqual([25, 50, 75, 100]);
    expect(calculateChapterMilestones(5)).toEqual([20, 40, 60, 80, 100]);
  });

  it("always ends at 100", () => {
    const result = calculateChapterMilestones(7);
    expect(result[result.length - 1]).toBe(100);
  });
});

describe("getCurrentChapter", () => {
  it("returns 0 for 0% progress", () => {
    expect(getCurrentChapter(0, 4)).toBe(0);
  });

  it("returns correct chapter for mid-progress", () => {
    expect(getCurrentChapter(30, 4)).toBe(1); // Past 25%, working toward 50%
    expect(getCurrentChapter(50, 4)).toBe(2); // At 50%, working toward 75%
  });

  it("returns totalChapters when complete", () => {
    expect(getCurrentChapter(100, 4)).toBe(4);
  });
});

describe("getNextMilestone", () => {
  it("returns first milestone for 0% progress", () => {
    expect(getNextMilestone(0, 4)).toBe(25);
  });

  it("returns null when all milestones reached", () => {
    expect(getNextMilestone(100, 4)).toBeNull();
  });
});

describe("shouldTriggerBossBattle", () => {
  it("triggers at 100% when finale not completed", () => {
    expect(shouldTriggerBossBattle(100, false)).toBe(true);
  });

  it("does not trigger when finale already completed", () => {
    expect(shouldTriggerBossBattle(100, true)).toBe(false);
  });

  it("does not trigger below 100%", () => {
    expect(shouldTriggerBossBattle(99, false)).toBe(false);
  });
});

describe("getChapterProgress", () => {
  it("calculates progress within first chapter", () => {
    const result = getChapterProgress(12, 4); // 12% of 25%
    expect(result.currentChapter).toBe(1);
    expect(result.progressInChapter).toBe(48); // 12/25 = 48%
  });

  it("calculates progress in middle chapters", () => {
    const result = getChapterProgress(37, 4); // Between 25% and 50%
    expect(result.currentChapter).toBe(2);
    expect(result.progressInChapter).toBe(48); // (37-25)/25 = 48%
  });
});
```

### Test 2: Supabase Mock Setup

**src/test/mocks/supabase.ts**:
```typescript
import { vi } from "vitest";

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(),
      })),
    })),
  })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signOut: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));
```

### Test 3: Profile Hook Test

**src/hooks/__tests__/useProfile.test.tsx**:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProfile } from "../useProfile";

// Mock useAuth
vi.mock("../useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "test@example.com" },
    session: { access_token: "token" },
    loading: false,
  }),
}));

// Mock supabase
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "test-user-123" }, error: null })),
        })),
      })),
    })),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile when user exists", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "test-user-123",
        email: "test@example.com",
        is_premium: false,
        onboarding_completed: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeTruthy();
    expect(result.current.profile?.id).toBe("test-user-123");
  });

  it("creates profile when none exists (new user)", async () => {
    // First call returns null (no profile)
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Profile should be created via upsert
    expect(result.current.profile).toBeTruthy();
  });

  it("handles loading state correctly", () => {
    mockMaybeSingle.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();
  });
});
```

---

## Summary of Changes

| Category | File | Change |
|----------|------|--------|
| **Query Fixes** | `useEncounterTrigger.ts` | 3x `.single()` → `.maybeSingle()` |
| **Query Fixes** | `useCommunity.ts` | 1x `.single()` → `.maybeSingle()` |
| **Query Fixes** | `useJourneyPathImage.ts` | Clean up PGRST116 handling |
| **Query Fixes** | `useCompanionPostcards.ts` | 1x `.single()` → `.maybeSingle()` |
| **New Files** | `vitest.config.ts` | Test framework config |
| **New Files** | `src/test/setup.ts` | Test environment setup |
| **New Files** | `src/test/mocks/supabase.ts` | Supabase mock helpers |
| **New Files** | `src/utils/epicMilestones.test.ts` | Pure function tests |
| **New Files** | `src/hooks/__tests__/useProfile.test.tsx` | Hook tests |
| **Modified** | `package.json` | Add test dependencies |
| **Modified** | `tsconfig.app.json` | Add vitest/globals type |

---

## Technical Notes

### Why Pure Function Tests First?
The `epicMilestones.ts` utilities are pure functions with no side effects - perfect for testing. They cover core game mechanics (chapter progression, boss battles) that must work correctly.

### Why Mock Supabase?
Hook tests need to mock the Supabase client to:
- Run without network
- Test specific scenarios (new user, existing user, errors)
- Run quickly and deterministically

### Running Tests
After implementation, tests run via:
```bash
npx vitest        # Watch mode
npx vitest run    # Single run (CI)
```

---

## Estimated Impact

- **Fixes 6 remaining crash scenarios** (new users, missing data)
- **Establishes testing infrastructure** for future development
- **Verifies core user flows** work for new users
- **Documents expected behavior** in executable form
