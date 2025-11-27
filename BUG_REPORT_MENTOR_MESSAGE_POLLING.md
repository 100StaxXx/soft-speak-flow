# Bug Report: Mentor Message Polling Optimization

## Bugs Found

### 🔴 CRITICAL Bug #1: Edge Function Error Not Handled
**File**: `src/components/MorningCheckIn.tsx:126-128`
**Issue**: The Edge Function is invoked without error handling. If it fails, the user will see "Preparing..." forever.

```typescript
// Current code (BAD)
supabase.functions.invoke('generate-check-in-response', {
  body: { checkInId: checkIn.id }
});
```

**Impact**: 
- If Edge Function fails (rate limit, AI API down, etc.), polling continues indefinitely
- User never sees an error message
- Wastes resources polling for a response that will never come

---

### 🟡 HIGH Bug #2: No Polling Timeout
**File**: `src/components/MorningCheckIn.tsx:47-52`
**Issue**: Polling has no maximum timeout. If the Edge Function silently fails, polling continues forever.

```typescript
refetchInterval: (data) => {
  if (data?.completed_at && !data?.mentor_response) {
    return 2000; // Polls forever!
  }
  return false;
}
```

**Impact**:
- Infinite polling if Edge Function fails without updating the database
- Unnecessary database queries
- Poor user experience (loading forever)
- Potential mobile battery drain

---

### 🟡 MEDIUM Bug #3: No Fallback Message
**File**: `src/components/MorningCheckIn.tsx:167-175`
**Issue**: If mentor response generation fails after timeout, user still sees "Preparing..."

**Impact**:
- User confusion
- No clear indication that something went wrong
- User doesn't know if they should wait or refresh

---

### 🟢 LOW Bug #4: Edge Function Invocation Not Awaited
**File**: `src/components/MorningCheckIn.tsx:126`
**Issue**: Fire-and-forget invocation means we don't know if it succeeded

```typescript
// Not awaited, no error catching
supabase.functions.invoke('generate-check-in-response', {
  body: { checkInId: checkIn.id }
});
```

**Impact**:
- Can't log errors on client side
- Can't show immediate feedback if invocation fails
- Harder to debug production issues

---

### 🟢 LOW Bug #5: Parallel Query Error Handling Could Be Better
**File**: `supabase/functions/generate-check-in-response/index.ts:72-86`
**Issue**: If both queries fail, we only get one error

```typescript
const [
  { data: checkIn, error: checkInError },
  { data: profile, error: profileError }
] = await Promise.all([...]);

// Only checks checkInError first
if (checkInError) {
  throw checkInError;
}
// If both fail, profileError is ignored
```

**Impact**:
- Less informative error messages
- Harder to debug multi-failure scenarios

---

## Recommended Fixes

1. ✅ Add error handling to Edge Function invocation
2. ✅ Add 30-second polling timeout (15 attempts × 2 seconds)
3. ✅ Show fallback message after timeout
4. ✅ Await and log Edge Function invocation
5. ✅ Improve parallel query error handling
