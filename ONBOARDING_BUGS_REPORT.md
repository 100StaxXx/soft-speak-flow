# Onboarding Comprehensive Bug Report

**Date:** November 29, 2025  
**Auditor:** AI Code Review  
**Scope:** Complete onboarding flow from authentication to companion creation

---

## Executive Summary

The onboarding system has been audited for bugs, edge cases, and potential issues. While the core flow is functional, **13 bugs and issues** were identified ranging from **CRITICAL** to **LOW** severity. These include race conditions, state management issues, error handling gaps, and user experience problems.

---

## Critical Bugs (Must Fix)

### 🔴 BUG #1: Legal Acceptance Stage Skip Race Condition
**Severity:** CRITICAL  
**Location:** `src/pages/Onboarding.tsx` lines 115-121  
**Impact:** Users can skip the legal acceptance stage unintentionally

**Problem:**
Two useEffects can race against each other:
1. Effect on line 65-113 restores onboarding progress from database
2. Effect on line 115-121 checks localStorage for legal acceptance

If localStorage has `legal_accepted_at` but the database shows an earlier stage, the user might skip stages.

```tsx
// Effect 1: Restores from database (line 65-113)
useEffect(() => {
  const loadProgress = async () => {
    // ... loads from database and may set stage to 'questionnaire' or 'referral-code'
  };
  loadProgress();
}, [user, navigate]);

// Effect 2: Checks localStorage (line 115-121)
useEffect(() => {
  const legalAccepted = safeLocalStorage.getItem('legal_accepted_at');
  if (legalAccepted && stage === 'legal') {
    setStage('name');  // ⚠️ This can fire before Effect 1 completes!
  }
}, [stage]);
```

**Scenario:**
1. User accepts legal terms (saved to localStorage)
2. User completes name, referral code, zodiac selection (saved to database as `onboarding_step: 'zodiac-select'`)
3. User refreshes page or returns later
4. Effect 2 fires first, sees localStorage, sets stage to 'name'
5. Effect 1 fires later, loads database, sets stage to 'zodiac-select'
6. User experiences UI flash/jump between stages

**Fix:**
```tsx
useEffect(() => {
  const loadProgress = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step, onboarding_data, onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    
    // If onboarding is already completed, redirect to tasks
    if (profile?.onboarding_completed) {
      navigate("/tasks", { replace: true });
      return;
    }
    
    // Restore from database if exists, otherwise check localStorage
    if (profile?.onboarding_step && profile.onboarding_step !== 'complete') {
      // Database takes precedence - restore from DB
      // ... existing restoration logic ...
    } else {
      // Only check localStorage if no database state exists
      const legalAccepted = safeLocalStorage.getItem('legal_accepted_at');
      if (legalAccepted) {
        setStage('name');
      }
    }
  };
  loadProgress();
}, [user, navigate]);

// Remove the separate localStorage check effect
```

---

### 🔴 BUG #2: Missing Error Handling in handleNameSubmit
**Severity:** CRITICAL  
**Location:** `src/pages/Onboarding.tsx` lines 147-191  
**Impact:** If name submission fails, user is stuck with spinner

**Problem:**
The `setSelecting(false)` is only in the `finally` block, but if the Promise chain fails silently (network timeout without error), the loading state persists forever.

```tsx
const handleNameSubmit = async (name: string) => {
  if (!user) return;

  try {
    setSelecting(true);
    
    // ... database operations ...
    
    setStage('referral-code');  // ⚠️ If this fails silently, setSelecting(false) never runs
  } catch (error: unknown) {
    // ... error handling ...
  } finally {
    setSelecting(false);  // ✅ This should always run, but doesn't if entire function crashes
  }
};
```

**Fix:**
Add timeout protection and explicit state reset:
```tsx
const handleNameSubmit = async (name: string) => {
  if (!user) return;

  const timeoutId = setTimeout(() => {
    setSelecting(false);
    toast({
      title: "Request Timeout",
      description: "Taking too long. Please check your connection and try again.",
      variant: "destructive",
    });
  }, 30000); // 30 second timeout

  try {
    setSelecting(true);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("id", user.id)
      .maybeSingle();

    const existingData = (profile?.onboarding_data as OnboardingData) || {};

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_step: 'referral-code',
        onboarding_data: {
          ...existingData,
          userName: name,
        },
      })
      .eq("id", user.id);

    if (error) throw error;

    clearTimeout(timeoutId);

    toast({
      title: "Welcome!",
      description: `Nice to meet you, ${name}!`,
    });

    setStage('referral-code');
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    console.error("Error saving name:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save name";
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  } finally {
    setSelecting(false);
  }
};
```

---

### 🔴 BUG #3: handleReferralCodeSubmit Doesn't Reset Loading on Error
**Severity:** HIGH  
**Location:** `src/pages/Onboarding.tsx` lines 193-214  
**Impact:** Button stays disabled after failed referral code submission

**Problem:**
```tsx
const handleReferralCodeSubmit = async (code: string) => {
  if (!user) return;

  try {
    setSelecting(true);
    await applyReferralCode.mutateAsync(code);
    
    await supabase
      .from("profiles")
      .update({ onboarding_step: 'zodiac-select' })
      .eq("id", user.id);

    setStage('zodiac-select');
  } catch (error: unknown) {
    console.error("Error applying referral code:", error);
    // Error toast is handled by the mutation
    throw error;  // ⚠️ This throws but setSelecting(false) never runs!
  } finally {
    setSelecting(false);  // ⚠️ "throw error" prevents finally from running
  }
};
```

**Fix:**
```tsx
const handleReferralCodeSubmit = async (code: string) => {
  if (!user) return;

  try {
    setSelecting(true);
    await applyReferralCode.mutateAsync(code);
    
    await supabase
      .from("profiles")
      .update({ onboarding_step: 'zodiac-select' })
      .eq("id", user.id);

    setStage('zodiac-select');
  } catch (error: unknown) {
    console.error("Error applying referral code:", error);
    // Error toast is handled by the mutation
    // Don't re-throw, just log and reset state
  } finally {
    setSelecting(false);
  }
};
```

---

## High Severity Bugs

### 🟠 BUG #4: Zodiac Sign Not Persisted in userName Flow
**Severity:** HIGH  
**Location:** `src/pages/Onboarding.tsx` lines 236-277  
**Impact:** Zodiac sign selection can be lost if name input fails

**Problem:**
The zodiac sign is saved to `onboarding_data` but if the previous `userName` save failed, the onboarding data might be inconsistent.

```tsx
const handleZodiacSelect = async (selectedZodiac: ZodiacSign) => {
  // ...
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_data")
    .eq("id", user.id)
    .maybeSingle();

  const existingData = (profile?.onboarding_data as OnboardingData) || {};
  // ⚠️ If userName wasn't saved earlier, existingData might be empty
  
  const { error } = await supabase
    .from("profiles")
    .update({
      zodiac_sign: selectedZodiac,
      onboarding_step: 'questionnaire',
      onboarding_data: {
        ...existingData,  // Might not have userName!
        zodiacSign: selectedZodiac,
      },
    })
    .eq("id", user.id);
};
```

**Fix:**
Add validation to ensure previous data exists:
```tsx
const handleZodiacSelect = async (selectedZodiac: ZodiacSign) => {
  if (!user) return;

  try {
    setSelecting(true);
    setZodiacSign(selectedZodiac);

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("id", user.id)
      .maybeSingle();

    const existingData = (profile?.onboarding_data as OnboardingData) || {};
    
    // ✅ Validate that userName exists
    if (!existingData.userName) {
      toast({
        title: "Missing Information",
        description: "Please go back and enter your name first.",
        variant: "destructive",
      });
      setStage('name');
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        zodiac_sign: selectedZodiac,
        onboarding_step: 'questionnaire',
        onboarding_data: {
          ...existingData,
          zodiacSign: selectedZodiac,
        },
      })
      .eq("id", user.id);

    if (error) throw error;

    setStage('questionnaire');
  } catch (error: unknown) {
    console.error("Error saving zodiac sign:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save zodiac sign";
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    });
  } finally {
    setSelecting(false);
  }
};
```

---

### 🟠 BUG #5: Companion Creation Can Be Triggered Multiple Times
**Severity:** HIGH  
**Location:** `src/pages/Onboarding.tsx` lines 473-574  
**Impact:** User could click "Begin Your Journey" multiple times, creating duplicate companion creation requests

**Problem:**
While the `useCompanion` hook has a `companionCreationInProgress` flag, the button doesn't use `createCompanion.isPending` directly - it uses a custom `isLoading` prop.

```tsx
{stage === "companion" && (
  <CompanionPersonalization
    onComplete={handleCompanionCreated}
    isLoading={createCompanion.isPending}  // ✅ This is correct
  />
)}

// But in handleCompanionCreated:
const handleCompanionCreated = async (data: {...}) => {
  // ⚠️ No early return if already creating!
  try {
    console.log("Starting companion creation:", data);
    
    await createCompanion.mutateAsync(data);  // Already has protection, but...
    // ... rest of code can still run multiple times
  }
}
```

**Fix:**
```tsx
const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);

const handleCompanionCreated = async (data: {
  favoriteColor: string;
  spiritAnimal: string;
  coreElement: string;
  storyTone: string;
}) => {
  if (!user?.id) {
    toast({
      title: "Error",
      description: "You must be logged in to create a companion.",
      variant: "destructive",
    });
    return;
  }
  
  // ✅ Prevent duplicate submissions
  if (isCompletingOnboarding) {
    console.log("Onboarding already in progress, ignoring duplicate click");
    return;
  }
  
  setIsCompletingOnboarding(true);
  
  try {
    console.log("Starting companion creation:", data);
    
    await createCompanion.mutateAsync(data);
    // ... rest of onboarding completion logic
  } catch (error: unknown) {
    // ... error handling
  } finally {
    setIsCompletingOnboarding(false);
  }
};
```

---

### 🟠 BUG #6: Onboarding Completion Race Condition with Profile Update
**Severity:** HIGH  
**Location:** `src/pages/Onboarding.tsx` lines 495-523  
**Impact:** Onboarding might not be marked complete if profile update fails

**Problem:**
```tsx
// Use standard update with atomic read-modify-write
const { data: currentProfile } = await supabase
  .from('profiles')
  .select('onboarding_data')
  .eq('id', user.id)
  .maybeSingle();

const currentOnboardingData = (currentProfile?.onboarding_data as OnboardingData) || {};

const { data: updatedProfile, error: completeError } = await supabase
  .from('profiles')
  .update({
    onboarding_completed: true,  // ⚠️ What if another process is updating profile?
    onboarding_step: 'complete',
    onboarding_data: currentOnboardingData as any
  })
  .eq('id', user.id)
  .select()
  .single();
```

This is a "read-modify-write" pattern that's vulnerable to race conditions. If two tabs/processes run simultaneously:
- Tab 1 reads onboarding_data
- Tab 2 reads onboarding_data
- Tab 1 writes update
- Tab 2 writes update (overwriting Tab 1's changes)

**Fix:**
Use a database function for atomic completion:
```sql
-- Create atomic completion function
CREATE OR REPLACE FUNCTION complete_onboarding_atomic(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if not already completed (idempotent)
  UPDATE profiles
  SET 
    onboarding_completed = true,
    onboarding_step = 'complete',
    updated_at = now()
  WHERE id = p_user_id
    AND (onboarding_completed IS NULL OR onboarding_completed = false);
  
  RETURN FOUND;
END;
$$;
```

```tsx
// In handleCompanionCreated:
const { data: completed, error: completeError } = await supabase
  .rpc('complete_onboarding_atomic', { p_user_id: user.id });

if (completeError) {
  console.error("Error completing onboarding:", completeError);
  throw new Error("Failed to complete onboarding. Please try again.");
}

if (!completed) {
  console.warn("Onboarding already completed (idempotent call)");
}
```

---

## Medium Severity Bugs

### 🟡 BUG #7: Missing Validation for Empty Referral Code
**Severity:** MEDIUM  
**Location:** `src/components/ReferralCodeInput.tsx` lines 17-33  
**Impact:** User can submit empty/whitespace referral code

**Problem:**
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!code.trim()) {
    onSkip();  // ⚠️ Empty code triggers skip, but what if they accidentally hit submit?
    return;
  }
  // ...
};
```

**Fix:**
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const trimmedCode = code.trim();
  
  if (!trimmedCode) {
    // If code is empty, show message instead of silently skipping
    setError("Please enter a referral code or click 'Skip for now'");
    return;
  }

  setIsSubmitting(true);
  setError("");
  
  try {
    await onSubmit(trimmedCode.toUpperCase());
  } catch (err) {
    setError("Invalid referral code. Please check and try again.");
    setIsSubmitting(false);
  }
};
```

---

### 🟡 BUG #8: Questionnaire Back Button Doesn't Save Progress
**Severity:** MEDIUM  
**Location:** `src/components/EnhancedQuestionnaire.tsx` lines 41-47  
**Impact:** User loses questionnaire progress if they go back

**Problem:**
```tsx
const handleBack = () => {
  if (typeof currentStep === 'number' && currentStep > 0) {
    setCurrentStep(currentStep - 1);  // ⚠️ Answers are kept in local state only
  } else {
    setCurrentStep('welcome');
  }
};
```

Answers are stored in component state (`answers`) but never persisted to the database until completion. If user refreshes or navigates away, all progress is lost.

**Fix:**
Add debounced save to database:
```tsx
import { useDebounce } from '@/hooks/useDebounce';

const EnhancedQuestionnaire = ({ onComplete, onBack }: EnhancedQuestionnaireProps) => {
  const [currentStep, setCurrentStep] = useState<'welcome' | number>('welcome');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { user } = useAuth();
  
  // Debounced save to database
  const debouncedAnswers = useDebounce(answers, 1000);
  
  useEffect(() => {
    if (!user || Object.keys(debouncedAnswers).length === 0) return;
    
    // Save progress to database
    supabase
      .from("profiles")
      .update({
        onboarding_data: {
          questionnaireAnswers: debouncedAnswers,
          questionnaireStep: currentStep
        }
      })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.error("Failed to save questionnaire progress:", error);
      });
  }, [debouncedAnswers, user]);
  
  // ... rest of component
};
```

---

### 🟡 BUG #9: Legal Acceptance Version Not Checked
**Severity:** MEDIUM  
**Location:** `src/pages/Onboarding.tsx` lines 117-121, `src/components/LegalAcceptance.tsx` lines 24-25  
**Impact:** Users who accepted old terms are not prompted to accept new ones

**Problem:**
```tsx
// Onboarding.tsx
const legalAccepted = safeLocalStorage.getItem('legal_accepted_at');
if (legalAccepted && stage === 'legal') {
  setStage('name');  // ⚠️ No version check!
}

// LegalAcceptance.tsx
safeLocalStorage.setItem('legal_accepted_at', new Date().toISOString());
safeLocalStorage.setItem('legal_accepted_version', '2025-11-21');  // Saved but never checked!
```

**Fix:**
```tsx
// Onboarding.tsx
const CURRENT_LEGAL_VERSION = '2025-11-21';

const legalAccepted = safeLocalStorage.getItem('legal_accepted_at');
const legalVersion = safeLocalStorage.getItem('legal_accepted_version');

if (legalAccepted && legalVersion === CURRENT_LEGAL_VERSION && stage === 'legal') {
  setStage('name');
} else if (legalAccepted && legalVersion !== CURRENT_LEGAL_VERSION) {
  // Clear old acceptance, show terms again
  safeLocalStorage.removeItem('legal_accepted_at');
  safeLocalStorage.removeItem('legal_accepted_version');
  setStage('legal');
}
```

---

### 🟡 BUG #10: Missing Validation in CompanionPersonalization
**Severity:** MEDIUM  
**Location:** `src/components/CompanionPersonalization.tsx` lines 61-66  
**Impact:** User might submit invalid color values

**Problem:**
```tsx
const [selectedColor, setSelectedColor] = useState<string>("#9333EA");
// ...
<input
  type="color"
  value={selectedColor}
  onChange={(e) => setSelectedColor(e.target.value)}  // ⚠️ No validation!
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
/>
```

HTML5 color input should always return valid hex, but edge cases exist (browser bugs, programmatic changes).

**Fix:**
```tsx
const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color);
};

const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const color = e.target.value;
  if (isValidHexColor(color)) {
    setSelectedColor(color);
  } else {
    console.warn("Invalid color selected:", color);
    // Fallback to default
    setSelectedColor("#9333EA");
  }
};

<input
  type="color"
  value={selectedColor}
  onChange={handleColorChange}
  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
/>
```

---

## Low Severity Issues

### 🟢 BUG #11: Inconsistent Loading State in handleConfirmMentor
**Severity:** LOW  
**Location:** `src/pages/Onboarding.tsx` lines 381-455  
**Impact:** Minor UX issue - loading state might not show immediately

**Problem:**
```tsx
const handleConfirmMentor = async () => {
  // ... validation ...
  
  try {
    setSelecting(true);  // ⚠️ Set AFTER validation, should be earlier
    
    console.log("Selecting mentor:", {...});
    // ... rest of function
  }
}
```

**Fix:**
```tsx
const handleConfirmMentor = async () => {
  if (!user || !recommendedMentor) {
    toast({
      title: "Error",
      description: "User or mentor information is missing",
      variant: "destructive",
    });
    return;
  }

  setSelecting(true);  // ✅ Set immediately to show loading state

  try {
    console.log("Selecting mentor:", {
      userId: user.id,
      mentorId: recommendedMentor.id,
      mentorName: recommendedMentor.name
    });
    // ... rest of function
  } catch (error: unknown) {
    // ...
  } finally {
    setSelecting(false);
  }
};
```

---

### 🟢 BUG #12: waitForProfileUpdate is a No-Op
**Severity:** LOW  
**Location:** `src/pages/Onboarding.tsx` lines 129-133  
**Impact:** Misleading function name, doesn't actually wait for anything

**Problem:**
```tsx
const waitForProfileUpdate = async () => {
  // Small delay to ensure UI state updates
  await new Promise((r) => setTimeout(r, 100));
  return true;  // ⚠️ Doesn't actually check if profile updated
};
```

This function is called after mentor selection (line 428) but doesn't actually verify the update succeeded.

**Fix:**
Either implement actual verification or remove it:
```tsx
// Option 1: Remove it entirely (100ms delay is negligible)
// Just remove the function and the calls to it

// Option 2: Actually verify profile update
const waitForProfileUpdate = async () => {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const { data } = await supabase
      .from("profiles")
      .select("selected_mentor_id")
      .eq("id", user.id)
      .maybeSingle();
    
    if (data?.selected_mentor_id === recommendedMentor.id) {
      return true;
    }
    
    await new Promise((r) => setTimeout(r, 100));
    attempts++;
  }
  
  console.warn("Profile update verification timed out");
  return false;
};
```

---

### 🟢 BUG #13: Missing Loading State for MentorGrid
**Severity:** LOW  
**Location:** `src/pages/Onboarding.tsx` lines 676-698  
**Impact:** Minor UX issue - grid shows immediately even if mentor selection is processing

**Problem:**
```tsx
{stage === "browse" && mentors.length > 0 && (
  <div className="min-h-screen bg-obsidian py-16 px-4 md:px-8">
    {/* ... */}
    <MentorGrid
      mentors={mentors}
      onSelectMentor={handleMentorSelected}
      currentMentorId={recommendedMentor?.id}
      recommendedMentorId={recommendedMentor?.id}
      isSelecting={selecting}  // ⚠️ Individual buttons disabled, but grid is still interactive
    />
  </div>
)}
```

**Fix:**
```tsx
{stage === "browse" && mentors.length > 0 && (
  <div className={cn(
    "min-h-screen bg-obsidian py-16 px-4 md:px-8",
    selecting && "pointer-events-none opacity-60"  // ✅ Disable entire grid
  )}>
    <div className="max-w-7xl mx-auto space-y-16">
      {/* ... */}
      {selecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Selecting mentor...</p>
          </div>
        </div>
      )}
      <MentorGrid
        mentors={mentors}
        onSelectMentor={handleMentorSelected}
        currentMentorId={recommendedMentor?.id}
        recommendedMentorId={recommendedMentor?.id}
        isSelecting={selecting}
      />
    </div>
  </div>
)}
```

---

## Edge Cases & Potential Issues

### ⚪ EDGE CASE #1: User Closes Tab During Companion Creation
**Location:** `src/pages/Onboarding.tsx` lines 488-493  
**Impact:** Companion might be half-created

**Scenario:**
1. User clicks "Begin Your Journey"
2. Companion image generates successfully (line 491-493)
3. User closes tab before database record is created
4. Next time user logs in, they have no companion but onboarding might be marked complete

**Mitigation:**
Already handled by `create_companion_if_not_exists` function - it's idempotent and will create the companion if missing. However, the image URL might be lost.

**Recommendation:**
Save the generated image URL to localStorage as a backup:
```tsx
const imageData = await retryWithBackoff(/* ... */);

// ✅ Save to localStorage as backup
safeLocalStorage.setItem('companion_initial_image', imageData.imageUrl);

// Later, when creating companion:
const backupImage = safeLocalStorage.getItem('companion_initial_image');
const imageUrl = imageData?.imageUrl || backupImage || DEFAULT_COMPANION_IMAGE;
```

---

### ⚪ EDGE CASE #2: User Navigates Back in Browser During Onboarding
**Impact:** Might get stuck or skip stages

**Scenario:**
User is on questionnaire stage and hits browser back button.

**Current Behavior:**
Router navigates back to previous route (likely `/auth`), losing onboarding progress.

**Recommendation:**
Add browser back button handling:
```tsx
useEffect(() => {
  const handlePopState = (e: PopStateEvent) => {
    e.preventDefault();
    
    // Show confirmation dialog
    const shouldExit = window.confirm(
      "Are you sure you want to exit onboarding? Your progress is saved and you can continue later."
    );
    
    if (!shouldExit) {
      // Stay on page
      window.history.pushState(null, '', window.location.pathname);
    } else {
      // Allow navigation
      navigate('/auth');
    }
  };
  
  // Prevent back navigation
  window.history.pushState(null, '', window.location.pathname);
  window.addEventListener('popstate', handlePopState);
  
  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}, [navigate]);
```

---

### ⚪ EDGE CASE #3: Multiple Tabs Completing Onboarding Simultaneously
**Impact:** Could create duplicate companions or inconsistent state

**Scenario:**
1. User opens app in two tabs
2. Both tabs are at companion creation stage
3. User clicks "Begin Your Journey" in both tabs

**Current Protection:**
- `companionCreationInProgress` flag (in useCompanion hook)
- `create_companion_if_not_exists` database function

**Limitation:**
The `companionCreationInProgress` flag is in-memory, not shared across tabs.

**Recommendation:**
Use `BroadcastChannel` API to synchronize state across tabs:
```tsx
const broadcastChannel = new BroadcastChannel('onboarding_channel');

useEffect(() => {
  broadcastChannel.onmessage = (event) => {
    if (event.data.type === 'ONBOARDING_COMPLETED') {
      // Another tab completed onboarding
      navigate('/tasks', { replace: true });
    }
  };
  
  return () => broadcastChannel.close();
}, [navigate]);

// When completing onboarding:
broadcastChannel.postMessage({ type: 'ONBOARDING_COMPLETED', userId: user.id });
```

---

## Summary & Recommendations

### Bug Count by Severity
- 🔴 **Critical:** 3 bugs
- 🟠 **High:** 3 bugs  
- 🟡 **Medium:** 4 bugs
- 🟢 **Low:** 3 bugs
- ⚪ **Edge Cases:** 3 issues

**Total: 16 issues identified**

### Priority Fix Order
1. **BUG #1** - Legal acceptance race condition (can skip stages)
2. **BUG #2** - Missing error handling in name submit (infinite spinner)
3. **BUG #3** - Referral code submit loading state bug
4. **BUG #6** - Onboarding completion race condition
5. **BUG #5** - Duplicate companion creation prevention
6. **BUG #4** - Zodiac data persistence
7. **BUG #9** - Legal version checking
8. **BUG #7-13** - Lower priority UX improvements

### Testing Checklist
After fixes, test these scenarios:

- [ ] Complete full onboarding flow (happy path)
- [ ] Refresh page at each onboarding stage
- [ ] Close and reopen browser during onboarding
- [ ] Network interruption during companion creation
- [ ] Invalid referral code submission
- [ ] Browser back button during onboarding
- [ ] Concurrent onboarding in multiple tabs
- [ ] User already has companion but tries to restart onboarding
- [ ] Legal terms updated - old users must re-accept
- [ ] Mobile device with slow connection

### Code Quality Recommendations

1. **Add TypeScript strict mode** for better type safety
2. **Implement comprehensive error boundaries** for each onboarding stage
3. **Add Sentry or similar** for production error tracking
4. **Add analytics events** for funnel tracking
5. **Implement state machine** for onboarding flow (XState or similar)
6. **Add E2E tests** for critical onboarding path (Playwright/Cypress)

---

**Report Generated:** November 29, 2025  
**Status:** Ready for Review & Prioritization
