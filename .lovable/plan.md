

# Fix Mentor Disconnection on App Resume

## Problem
When you switch away from the app and come back (or your token refreshes), the mentor vanishes because mentor queries are invalidated *before* the profile data they depend on finishes loading. The profile contains your `selected_mentor_id` -- without it, mentor queries resolve to `null`.

The retry fix you applied from ChatGPT improves **chat message reliability** (retrying on network errors). This fix addresses the separate **mentor disappearing** issue.

## Changes

### 1. `src/hooks/useAppResumeRefresh.ts` -- Web/PWA handler (line 67)

Make the visibility change handler `async` and `await` the profile refetch before invalidating mentor queries. The native (iOS/Android) handler on line 43 already does this correctly -- this makes the web handler match.

```
Before:  queryClient.refetchQueries(...)   // fire-and-forget
After:   await queryClient.refetchQueries(...)  // wait for profile
```

### 2. `src/hooks/useAuthSync.ts` -- Auth state handler (line 18)

Same fix inside the `setTimeout` callback: make it `async` and `await` the profile refetch before invalidating mentor queries.

```
Before:  setTimeout(() => { queryClient.refetchQueries(...); ... }, 0)
After:   setTimeout(async () => { await queryClient.refetchQueries(...); ... }, 0)
```

## Why This Works
Mentor queries use `resolvedMentorId` from the profile as their query key and `enabled` flag. If they refetch while the profile is still loading, they see `null` and return nothing -- the mentor disappears. Awaiting the profile ensures the mentor ID is available when mentor queries run.

