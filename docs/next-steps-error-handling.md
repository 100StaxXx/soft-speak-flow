# Next Steps: Database Error Handling Implementation

## Immediate Actions (Do Now)

### 1. Test the Updated delete-user Function ✅
- [ ] Test account deletion in development/staging
- [ ] Verify error messages are user-friendly
- [ ] Check that 42P01 errors are properly caught and logged
- [ ] Confirm the shared error handler works correctly

### 2. Commit and Push Current Changes
```bash
git add supabase/functions/delete-user/index.ts
git add supabase/functions/_shared/errorHandler.ts
git add docs/database-error-risk-analysis.md
git commit -m "Add shared error handler and improve delete-user error handling"
git push
```

## High Priority (This Week)

### 3. Update Critical Referral Functions
These handle user payments and are critical for business operations:

**Files to update:**
- `supabase/functions/process-referral/index.ts`
- `supabase/functions/request-referral-payout/index.ts`
- `supabase/functions/record-subscription/index.ts`
- `supabase/functions/create-influencer-code/index.ts`
- `supabase/functions/process-paypal-payout/index.ts`

**Client-side RPC calls:**
- `src/hooks/useReferrals.ts` - Add try-catch around RPC calls

**Example implementation:**
```typescript
import { createErrorResponse, logError } from "../_shared/errorHandler.ts";

try {
  const { error } = await supabase.rpc("apply_referral_code_atomic", params);
  if (error) {
    logError(error, "apply_referral_code_atomic RPC");
    throw error;
  }
} catch (error) {
  return createErrorResponse(error, req, corsHeaders);
}
```

### 4. Update Payment/Subscription Functions
Critical for revenue operations:

**Files to update:**
- `supabase/functions/apple-webhook/index.ts`
- `supabase/functions/_shared/appleSubscriptions.ts`

## Medium Priority (Next 2 Weeks)

### 5. Update Push Notification Functions
These run frequently and could cause widespread issues:

**Files to update:**
- `supabase/functions/schedule-adaptive-pushes/index.ts`
- `supabase/functions/deliver-adaptive-pushes/index.ts`
- `supabase/functions/trigger-adaptive-event/index.ts`
- `supabase/functions/dispatch-daily-pushes/index.ts`
- `supabase/functions/dispatch-daily-quote-pushes/index.ts`
- `supabase/functions/schedule-daily-mentor-pushes/index.ts`
- `supabase/functions/schedule-daily-quote-pushes/index.ts`
- `supabase/functions/deliver-scheduled-notifications/index.ts`
- `supabase/functions/send-shout-notification/index.ts`

### 6. Update Core User Functions
Important for user experience:

**Files to update:**
- `supabase/functions/reset-companion/index.ts`
- `supabase/functions/process-daily-decay/index.ts`
- `supabase/functions/generate-proactive-nudges/index.ts`
- `supabase/functions/generate-smart-notifications/index.ts`

**Client-side:**
- `src/hooks/useCompanion.ts` - Add error handling around `create_companion_if_not_exists` RPC

## Lower Priority (As Time Permits)

### 7. Update Content Generation Functions
These are less critical but should still have error handling:

**Files to update:**
- All functions in `supabase/functions/generate-*` directory
- `supabase/functions/mentor-chat/index.ts`
- `supabase/functions/generate-guild-story/index.ts`

### 8. Update Shared Utilities
- `supabase/functions/_shared/rateLimiter.ts`
- `supabase/functions/_shared/promptBuilder.ts`

## Implementation Pattern

For each function, follow this pattern:

### Step 1: Import the error handler
```typescript
import { createErrorResponse, logError } from "../_shared/errorHandler.ts";
```

### Step 2: Wrap RPC calls
```typescript
const { error: rpcError } = await supabase.rpc("function_name", params);
if (rpcError) {
  logError(rpcError, "function_name RPC");
  throw rpcError;
}
```

### Step 3: Wrap table queries (for critical operations)
```typescript
const { data, error } = await supabase.from("table_name").select("*");
if (error) {
  logError(error, "table_name query");
  throw error;
}
```

### Step 4: Update catch blocks
```typescript
} catch (error) {
  logError(error, "function-name edge function");
  return createErrorResponse(error, req, corsHeaders);
}
```

## Testing Strategy

### 1. Unit Testing
- Test error handler with various error types
- Verify error messages are user-friendly
- Check status codes are correct

### 2. Integration Testing
- Test functions with missing tables (simulate by renaming tables temporarily)
- Verify error responses are properly formatted
- Check logs contain useful debugging information

### 3. Monitoring
- Set up alerts for 42P01 errors in production
- Monitor error rates after deployment
- Track which functions are most prone to errors

## Migration Verification

Before deploying any changes, verify:
1. All migrations have been applied to the target database
2. All tables referenced in functions exist
3. All RPC functions are properly defined

You can create a simple verification script:
```typescript
// verify-migrations.ts
const criticalTables = [
  'profiles',
  'user_companion',
  'referral_codes',
  'referral_payouts',
  'subscriptions',
  // ... add all critical tables
];

for (const table of criticalTables) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error?.code === "42P01") {
    console.error(`❌ Table ${table} does not exist`);
  } else {
    console.log(`✅ Table ${table} exists`);
  }
}
```

## Success Metrics

Track these metrics to measure success:
- Reduction in 42P01 errors
- Improved error message clarity (user feedback)
- Faster debugging time (better error logs)
- Reduced support tickets related to database errors

## Rollout Plan

1. **Week 1**: Deploy shared error handler + delete-user function
2. **Week 2**: Update referral and payment functions
3. **Week 3**: Update push notification functions
4. **Week 4**: Update remaining functions
5. **Ongoing**: Monitor and iterate based on production data

## Notes

- The shared error handler is backward compatible - existing functions will continue to work
- You can update functions incrementally without breaking changes
- Focus on high-traffic and critical functions first
- Consider creating a checklist to track which functions have been updated
