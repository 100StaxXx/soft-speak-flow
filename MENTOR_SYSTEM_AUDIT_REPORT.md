# Mentor System Audit Report
*Generated: 2025-11-25*

## Executive Summary

This report documents a comprehensive audit of the mentor system, covering edge functions, frontend components, database queries, and system architecture. The audit identified **15 issues** across critical, high, medium, and low severity levels.

### Issue Breakdown
- **Critical**: 3 issues
- **High**: 5 issues  
- **Medium**: 4 issues
- **Low**: 3 issues

---

## Critical Issues

### 1. Race Condition in Daily Message Count (AskMentorChat.tsx)
**Severity**: Critical  
**Location**: `src/components/AskMentorChat.tsx` (lines 83-167)

**Issue**: The daily message count check has a race condition between client-side validation and server-side validation.

```typescript
// Client checks count
if (dailyMessageCount >= DAILY_MESSAGE_LIMIT) {
  // Show error
  return;
}

// But then sends message...
// Meanwhile, server also checks count
```

**Problem**: Two rapid messages sent simultaneously could both pass the client check before either increments the counter, allowing users to exceed the daily limit.

**Impact**: Users could send more than 10 messages per day by exploiting timing.

**Recommendation**: 
- Remove client-side limit check or make it advisory only
- Rely solely on server-side enforcement in `mentor-chat` function (which already exists)
- Add optimistic UI updates with rollback on server rejection

---

### 2. Missing Mentor ID Validation in Edge Functions
**Severity**: Critical  
**Location**: Multiple edge functions

**Issue**: Several functions accept `mentorSlug` but don't validate that the mentor exists or is active before expensive operations:

- `generate-complete-pep-talk/index.ts` (lines 52-59) - Generates content first, then checks mentor
- `generate-mentor-script/index.ts` (lines 41-49) - Same issue

**Problem**: 
- Could generate expensive AI content for non-existent mentors
- No validation of `is_active` status
- Potential for abuse through invalid mentor slugs

**Impact**: Wasted AI API credits, potential DoS vector.

**Recommendation**:
```typescript
// Move mentor validation BEFORE AI generation
const { data: mentor, error: mentorError } = await supabase
  .from("mentors")
  .select("*")
  .eq("slug", mentorSlug)
  .eq("is_active", true)  // Add this check
  .single();

if (mentorError || !mentor) {
  return new Response(
    JSON.stringify({ error: "Invalid or inactive mentor" }),
    { status: 400, headers: corsHeaders }
  );
}

// THEN proceed with AI generation
```

---

### 3. Unsafe Dependency Array in useEffect Hook
**Severity**: Critical  
**Location**: `src/components/AskMentorChat.tsx` (lines 212-220)

**Issue**: The `useEffect` hook that processes initial messages includes `sendMessage` in its dependency array, which is recreated on every render due to its own dependencies.

```typescript
useEffect(() => {
  const initialMessage = location.state?.initialMessage;
  if (initialMessage && !hasProcessedInitialMessage.current) {
    hasProcessedInitialMessage.current = true;
    setShowSuggestions(false);
    sendMessage(initialMessage);  // This function changes every render
  }
}, [location.state, sendMessage]);  // sendMessage causes infinite loops
```

**Problem**: This can cause infinite re-renders or duplicate message sends.

**Impact**: Duplicate messages sent, poor UX, potential rate limit exhaustion.

**Recommendation**:
```typescript
// Remove sendMessage from dependency array
}, [location.state]);

// OR wrap sendMessage in useCallback with stable dependencies
const sendMessage = useCallback(async (text: string) => {
  // ... implementation
}, []); // Empty deps or only stable values
```

---

## High Severity Issues

### 4. Inconsistent Mentor Lookup (Slug vs ID)
**Severity**: High  
**Location**: Multiple files

**Issue**: The system uses both `mentor_id` and `mentor_slug` inconsistently:

- `MentorChat.tsx` queries by `profile.selected_mentor_id` (UUID)
- `generate-complete-pep-talk` expects `mentorSlug` (string)
- `generate-daily-mentor-pep-talks` uses `mentorSlug`
- Database stores `mentor_id` in some tables, `mentor_slug` in others

**Problem**: This creates confusion and requires extra lookups. For example:
1. User profile stores `selected_mentor_id` (UUID)
2. To generate pep talk, need to fetch mentor to get slug
3. Then pass slug to function, which fetches mentor again by slug

**Impact**: Extra database queries, increased latency, potential for mismatches.

**Recommendation**: Standardize on one approach:
- **Option A**: Always use UUID (`mentor_id`) 
- **Option B**: Always use slug, add unique index to `mentors.slug`
- Update all functions and tables to use consistent identifier

---

### 5. No Timeout on AI Gateway Calls
**Severity**: High  
**Location**: All edge functions making AI calls

**Issue**: Fetch calls to AI gateway have no timeout:

```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
  // No timeout specified!
});
```

**Problem**: If the AI gateway hangs, the edge function waits indefinitely until Deno's default timeout (which could be minutes).

**Impact**: Poor user experience, resource exhaustion, cascading failures.

**Recommendation**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

try {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { ... },
    body: JSON.stringify({ ... }),
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // ... handle response
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    return new Response(
      JSON.stringify({ error: "Request timeout" }),
      { status: 408, headers: corsHeaders }
    );
  }
  throw error;
}
```

---

### 6. Mentor Matching Algorithm Doesn't Handle Ties Well
**Severity**: High  
**Location**: `src/utils/mentorScoring.ts` (lines 59-112)

**Issue**: The tie-breaking logic is overly complex and has fallback to alphabetical sorting:

```typescript
function breakTie(tiedMentors: string[], selectedAnswers, mentors) {
  // 1. Use Q1
  // 2. Use Q3 intensity
  // 3. Use theme overlap
  // 4. Default to alphabetical order  ← Problem!
  return tiedMentors.sort()[0];
}
```

**Problem**: Alphabetical sorting as final tie-breaker means:
- Users with identical answers might get "atlas" just because it's first alphabetically
- Not a great user experience
- Predictable and not personalized

**Impact**: Poor matching quality, users may get wrong mentor.

**Recommendation**:
```typescript
// 4. Use deterministic but user-specific fallback
const userId = getUserId(); // Pass from caller
const userSeed = userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1);
const index = userSeed % tiedMentors.length;
return tiedMentors[index];

// OR use a weighted random selection
// OR default to most popular mentor (requires analytics)
```

---

### 7. Missing Error Boundaries in Mentor Components
**Severity**: High  
**Location**: `src/pages/MentorChat.tsx`, `src/components/MentorReveal.tsx`

**Issue**: No error boundaries wrapping mentor components.

**Problem**: If `MentorReveal` or `MentorChat` crashes (e.g., null mentor, missing avatar_url), the entire app could crash without recovery.

**Impact**: Poor user experience, app crashes.

**Recommendation**:
```typescript
// Create MentorErrorBoundary component
class MentorErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    console.error('Mentor component error:', error, info);
    // Log to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <MentorErrorFallback />;
    }
    return this.props.children;
  }
}

// Wrap mentor pages
<MentorErrorBoundary>
  <MentorChat />
</MentorErrorBoundary>
```

---

### 8. Potential SQL Injection in Daily Count Query
**Severity**: High  
**Location**: `src/components/AskMentorChat.tsx` (lines 174-186)

**Issue**: While using Supabase's query builder (which is safe), the date range calculation could have edge cases:

```typescript
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
```

**Problem**: 
- Timezone issues - uses local time, not UTC
- Server in `mentor-chat` function uses UTC (line 84-86)
- Could allow extra messages near midnight UTC/local boundary

**Impact**: Users could send extra messages by exploiting timezone differences.

**Recommendation**:
```typescript
// Use UTC consistently everywhere
const now = new Date();
const startOfDay = new Date();
startOfDay.setUTCHours(0, 0, 0, 0);

const { count } = await supabase
  .from('mentor_chats')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('role', 'user')
  .gte('created_at', startOfDay.toISOString());
```

---

## Medium Severity Issues

### 9. Inefficient Database Queries in MentorChat
**Severity**: Medium  
**Location**: `src/pages/MentorChat.tsx` (lines 17-29)

**Issue**: Query runs on every render when `profile?.selected_mentor_id` changes:

```typescript
const { data: mentor } = useQuery({
  queryKey: ['mentor', profile?.selected_mentor_id],
  queryFn: async () => {
    if (!profile?.selected_mentor_id) return null;
    const { data } = await supabase
      .from('mentors')
      .select('*')
      .eq('id', profile.selected_mentor_id)
      .maybeSingle();
    return data;
  },
  enabled: !!profile?.selected_mentor_id,
});
```

**Problem**: 
- Selects all columns with `*`
- No caching configuration
- Refetches on every profile change even if mentor_id is the same

**Impact**: Unnecessary database load, slower page loads.

**Recommendation**:
```typescript
const { data: mentor } = useQuery({
  queryKey: ['mentor', profile?.selected_mentor_id],
  queryFn: async () => {
    if (!profile?.selected_mentor_id) return null;
    const { data } = await supabase
      .from('mentors')
      .select('id, name, slug, tone_description, avatar_url, primary_color')  // Only needed fields
      .eq('id', profile.selected_mentor_id)
      .maybeSingle();
    return data;
  },
  enabled: !!profile?.selected_mentor_id,
  staleTime: 1000 * 60 * 5, // 5 minutes
  cacheTime: 1000 * 60 * 30, // 30 minutes
});
```

---

### 10. Memory Leak in MentorReveal Component
**Severity**: Medium  
**Location**: `src/components/MentorReveal.tsx` (lines 26-35)

**Issue**: Multiple timeouts created but cleanup happens on unmount only:

```typescript
useEffect(() => {
  const timers = [
    setTimeout(() => setStage(1), 300),
    setTimeout(() => setStage(2), 1000),
    setTimeout(() => setStage(3), 1800),
    setTimeout(() => setStage(4), 2600),
  ];

  return () => timers.forEach(clearTimeout);
}, []);
```

**Problem**: If component unmounts before all timers fire (user navigates away), the timers are cleaned up correctly. However, if the mentor prop changes, the effect doesn't re-run but old timers might still be in memory.

**Impact**: Minor memory leak, potential stale state updates.

**Recommendation**:
```typescript
useEffect(() => {
  const timers = [
    setTimeout(() => setStage(1), 300),
    setTimeout(() => setStage(2), 1000),
    setTimeout(() => setStage(3), 1800),
    setTimeout(() => setStage(4), 2600),
  ];

  return () => timers.forEach(clearTimeout);
}, [mentor.id]); // Add mentor.id to deps
```

---

### 11. No Validation of AI Response Format
**Severity**: Medium  
**Location**: `supabase/functions/generate-complete-pep-talk/index.ts` (lines 242-260)

**Issue**: Minimal validation of AI response structure:

```typescript
try {
  const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    pepTalkData = JSON.parse(jsonMatch[0]);
  } else {
    pepTalkData = JSON.parse(generatedContent);
  }
} catch (parseError) {
  console.error("Failed to parse AI response:", generatedContent);
  throw new Error("Failed to parse AI response as JSON");
}

// Validate required fields
if (!pepTalkData.title || !pepTalkData.quote || !pepTalkData.description || !pepTalkData.script) {
  throw new Error("AI response missing required fields");
}
```

**Problem**:
- No validation of field lengths (title could be 500 chars)
- No validation of field content quality
- No check for injection attempts or malicious content
- No validation against OutputValidator despite importing it

**Impact**: Poor quality content could be stored, potential XSS if content not sanitized on display.

**Recommendation**:
```typescript
// After parsing, validate thoroughly
const validator = new OutputValidator({
  title: { maxLength: 60, required: true },
  quote: { maxLength: 150, required: true },
  description: { maxLength: 300, required: true },
  script: { minLength: 50, maxLength: 2000, required: true }
}, {});

const validationResult = validator.validate(pepTalkData);
if (!validationResult.isValid) {
  console.error('Validation failed:', validationResult.errors);
  throw new Error('AI response validation failed');
}

// Sanitize HTML entities
pepTalkData.title = sanitizeHtml(pepTalkData.title);
pepTalkData.quote = sanitizeHtml(pepTalkData.quote);
// ... etc
```

---

### 12. generate-daily-mentor-pep-talks Error Handling
**Severity**: Medium  
**Location**: `supabase/functions/generate-daily-mentor-pep-talks/index.ts` (lines 70-218)

**Issue**: The function continues processing all mentors even if some fail, but doesn't retry or alert:

```typescript
for (const mentorSlug of MENTOR_SLUGS) {
  try {
    // ... generate pep talk
  } catch (error: any) {
    console.error(`Error processing ${mentorSlug}:`, error);
    errors.push({ mentor: mentorSlug, error: error.message });
    // Just continues to next mentor
  }
}
```

**Problem**:
- No retry logic for transient failures
- No alerting when multiple mentors fail
- Could silently fail to generate content for days
- Returns 200 even with errors

**Impact**: Missing daily content, poor monitoring.

**Recommendation**:
```typescript
const MAX_RETRIES = 2;

for (const mentorSlug of MENTOR_SLUGS) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ... generate pep talk
      break; // Success
    } catch (error: any) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  if (lastError) {
    console.error(`Failed after ${MAX_RETRIES} retries:`, lastError);
    errors.push({ mentor: mentorSlug, error: lastError.message });
    
    // Alert if critical
    if (errors.length > MENTOR_SLUGS.length / 2) {
      await supabase.from('admin_alerts').insert({
        type: 'daily_generation_failure',
        severity: 'high',
        message: `Failed to generate for ${errors.length} mentors`
      });
    }
  }
}

// Return appropriate status
return new Response(
  JSON.stringify({ success: errors.length === 0, results, errors }),
  { 
    status: errors.length === 0 ? 200 : 207, // 207 Multi-Status
    headers: corsHeaders 
  }
);
```

---

## Low Severity Issues

### 13. Hardcoded Mentor Slugs
**Severity**: Low  
**Location**: `supabase/functions/generate-daily-mentor-pep-talks/index.ts` (line 49)

**Issue**: Mentor slugs are hardcoded:

```typescript
const MENTOR_SLUGS = ['atlas', 'darius', 'eli', 'nova', 'sienna', 'lumi', 'kai', 'stryker', 'solace'];
```

**Problem**: 
- Must manually update code when adding/removing mentors
- Could get out of sync with database
- Doesn't respect `is_active` flag

**Impact**: Manual maintenance burden, potential bugs.

**Recommendation**:
```typescript
// Fetch active mentors dynamically
const { data: activeMentors, error } = await supabase
  .from('mentors')
  .select('slug')
  .eq('is_active', true)
  .order('created_at');

if (error || !activeMentors) {
  throw new Error('Failed to fetch active mentors');
}

const MENTOR_SLUGS = activeMentors.map(m => m.slug);
```

---

### 14. Missing Loading States in MentorSelection
**Severity**: Low  
**Location**: `src/pages/MentorSelection.tsx` (lines 57-96)

**Issue**: No loading state during mentor selection:

```typescript
const handleSelectMentor = async (mentorId: string) => {
  try {
    setSelecting(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({ selected_mentor_id: mentorId })
      .eq("id", user.id);

    if (error) throw error;

    toast({ title: "Mentor Selected!" });
    
    navigate("/", { replace: true });
  } catch (error: any) {
    toast({ title: "Error", variant: "destructive" });
  } finally {
    setSelecting(false);
  }
};
```

**Problem**: The `selecting` state is set but not used to show loading UI. Users might click multiple times.

**Impact**: Potential duplicate requests, poor UX.

**Recommendation**:
```typescript
// In MentorGrid component, disable buttons during selection
<Button
  onClick={() => onSelectMentor(mentor.id)}
  disabled={isSelecting}
>
  {isSelecting && selectedMentorId === mentor.id ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Selecting...
    </>
  ) : (
    'Select Mentor'
  )}
</Button>
```

---

### 15. Inconsistent Error Messages
**Severity**: Low  
**Location**: Multiple edge functions

**Issue**: Error messages vary in format and detail:

- `generate-mentor-script`: `"AI gateway error"` (generic)
- `generate-complete-pep-talk`: `"Failed to generate content from AI"` (slightly better)
- `mentor-chat`: Returns detailed validation errors sometimes

**Problem**: Inconsistent user experience, hard to debug client-side.

**Impact**: Confusion for users and developers.

**Recommendation**: Create standardized error response format:

```typescript
// _shared/errorResponse.ts
export interface StandardError {
  error: string;
  code: string;
  details?: any;
  requestId?: string;
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  status: number = 500
): Response {
  const response: StandardError = {
    error: message,
    code,
    details,
    requestId: crypto.randomUUID()
  };
  
  return new Response(
    JSON.stringify(response),
    { status, headers: corsHeaders }
  );
}

// Usage:
return createErrorResponse(
  'AI_GATEWAY_ERROR',
  'Failed to generate content from AI service',
  { aiStatus: response.status },
  500
);
```

---

## Performance Observations

### Positive Findings

1. **Rate Limiting**: Good implementation of rate limiting in `rateLimiter.ts`
2. **Caching**: React Query used for mentor data caching
3. **Fallback Responses**: Excellent offline support with contextual fallbacks
4. **Validation Framework**: OutputValidator infrastructure exists (underutilized)

### Areas for Optimization

1. **Database Indexes**: Ensure indexes on:
   - `mentors.slug` (frequently queried)
   - `mentors.is_active` (for filtering)
   - `mentor_chats (user_id, created_at)` (for daily count queries)
   - `profiles.selected_mentor_id` (foreign key)

2. **Connection Pooling**: Edge functions create new Supabase clients on each invocation. Consider connection pooling if available.

3. **AI Response Caching**: Similar prompts could be cached temporarily:
   ```typescript
   // Cache common responses for 1 hour
   const cacheKey = `pep-talk:${mentorSlug}:${category}:${intensity}`;
   const cached = await getFromCache(cacheKey);
   if (cached) return cached;
   
   const generated = await generatePepTalk(...);
   await setCache(cacheKey, generated, 3600);
   return generated;
   ```

4. **Batch Database Operations**: In `generate-daily-mentor-pep-talks`, insert all pep talks in one batch query instead of sequential inserts.

---

## Security Observations

### Strengths

1. **Authentication**: Proper user authentication checks
2. **CORS**: Appropriate CORS headers
3. **Input Validation**: Zod schemas for input validation
4. **Rate Limiting**: Daily message limits enforced

### Concerns

1. **No Content Security Policy**: Consider CSP headers for XSS protection
2. **No Request Signing**: Edge function calls could be spoofed
3. **Limited Input Sanitization**: AI-generated content not sanitized before storage
4. **Secrets Management**: Relies on environment variables (standard but could use secret management service)

---

## Recommendations Summary

### Immediate Actions (Critical/High)

1. Fix race condition in daily message count
2. Add mentor validation before AI generation
3. Fix unsafe useEffect dependency
4. Standardize mentor identification (ID vs slug)
5. Add timeouts to all AI gateway calls
6. Improve tie-breaking in mentor matching
7. Add error boundaries to mentor components
8. Fix timezone inconsistency in daily count

### Short-term Improvements (Medium)

9. Optimize database queries and add caching
10. Fix potential memory leak in MentorReveal
11. Add comprehensive AI response validation
12. Improve error handling in daily generation

### Long-term Enhancements (Low)

13. Dynamic mentor slug loading
14. Better loading states in UI
15. Standardize error response format
16. Add database indexes
17. Consider AI response caching
18. Implement content security policies

---

## Testing Recommendations

1. **Unit Tests**: Add tests for:
   - `mentorMatching.ts` tie-breaking logic
   - `mentorScoring.ts` calculation accuracy
   - Date/timezone handling in message counts

2. **Integration Tests**: Test:
   - Complete mentor selection flow
   - Daily message limit enforcement (client + server)
   - Mentor chat with fallbacks

3. **Load Tests**: Verify:
   - Daily generation function with all mentors
   - Concurrent chat requests
   - AI gateway timeout behavior

4. **E2E Tests**: Cover:
   - Onboarding → mentor reveal → home
   - Mentor chat conversation
   - Switching mentors

---

## Conclusion

The mentor system is well-architected with good separation of concerns, comprehensive fallback mechanisms, and solid rate limiting. The main concerns are:

1. **Race conditions** that could allow limit bypasses
2. **Inconsistent mentor identification** causing extra queries
3. **Missing timeouts** on external API calls
4. **Incomplete validation** of AI-generated content

Addressing the critical and high-severity issues should be prioritized, as they could impact system stability, user experience, and API costs.

The system shows maturity in areas like offline support and fallback handling, which indicates thoughtful design. With the recommended fixes, the mentor system will be more robust, efficient, and maintainable.
