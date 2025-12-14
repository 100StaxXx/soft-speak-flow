# Database Error Risk Analysis (42P01 - Undefined Table)

This document identifies all places where database errors similar to the `delete_user_account` issue could occur.

## Error Type: 42P01 (Undefined Table)

This error occurs when a database function or query references a table that doesn't exist. This typically happens when:
1. Migrations haven't been applied
2. Table names have changed but functions/queries weren't updated
3. Tables were removed but dependent code still references them

## Risk Categories

### 1. RPC Function Calls (High Risk)

These are calls to database functions that may reference non-existent tables:

#### Edge Functions Making RPC Calls:
- **`supabase/functions/delete-user/index.ts`**
  - `supabase.rpc("delete_user_account", { p_user_id: userId })`
  - **Risk**: HIGH - References 48+ tables in the database function
  - **Status**: ✅ Fixed with improved error handling

#### Client-Side RPC Calls:
- **`src/pages/Admin.tsx`**
  - `supabase.rpc("has_role", ...)`
  - **Risk**: LOW - Simple function, likely stable

- **`src/hooks/useCompanion.ts`**
  - `supabase.rpc('create_companion_if_not_exists', ...)`
  - **Risk**: MEDIUM - References `user_companion` table

- **`src/hooks/useReferrals.ts`**
  - `supabase.rpc("validate_referral_code", { p_code: ... })`
  - `supabase.rpc("apply_referral_code_atomic", ...)`
  - **Risk**: MEDIUM - References `referral_codes`, `referral_completions`, `profiles`, `user_companion_skins`, `referral_audit_log`

### 2. Database Functions with Table References (High Risk)

These functions are defined in migrations and could fail if tables don't exist:

#### Critical Functions (Multiple Table References):
1. **`delete_user_account(p_user_id uuid)`**
   - **Location**: Multiple migrations (latest: `20251214220253_2787235b-17b9-4d66-8c42-8ec478de53ea.sql`)
   - **Tables Referenced**: 48+ tables including:
     - `companion_evolution_cards`, `companion_evolutions`, `companion_postcards`, `companion_stories`
     - `user_companion`, `challenge_progress`, `user_challenges`
     - `habit_completions`, `epic_habits`, `habits`
     - `epic_progress_log`, `epic_members`, `guild_shouts`, `guild_rivalries`
     - `referral_payouts`, `referral_codes`, `push_subscriptions`, `subscriptions`
     - `mentor_chats`, `profiles`, and many more
   - **Risk**: HIGH
   - **Status**: ✅ Error handling improved in edge function

2. **`complete_referral_stage3(p_referee_id UUID, p_referrer_id UUID)`**
   - **Location**: `supabase/migrations/20251126_fix_transaction_bugs.sql`
   - **Tables Referenced**: 
     - `referral_completions`, `profiles`, `companion_skins`, `user_companion_skins`, `referral_audit_log`
   - **Risk**: MEDIUM

3. **`apply_referral_code_atomic(p_user_id UUID, p_referrer_id UUID, p_referral_code TEXT)`**
   - **Location**: `supabase/migrations/20251126_fix_transaction_bugs.sql`
   - **Tables Referenced**: 
     - `profiles`, `referral_codes`, `referral_completions`, `referral_audit_log`
   - **Risk**: MEDIUM

4. **`create_companion_if_not_exists(...)`**
   - **Location**: `supabase/migrations/20251125053253_c5d5e0f0-177c-42f2-a948-0b586c4a4f63.sql`
   - **Tables Referenced**: `user_companion`
   - **Risk**: MEDIUM

5. **`update_epic_progress()`**
   - **Location**: Multiple migrations
   - **Tables Referenced**: `epics`, `epic_progress_log`, `habits`, `habit_completions`
   - **Risk**: MEDIUM

### 3. Direct Table Queries in Edge Functions (Medium Risk)

These edge functions directly query tables that might not exist:

#### High-Volume Edge Functions (Many Table References):
- **`supabase/functions/apple-webhook/index.ts`**
  - Tables: `subscriptions`, `profiles`, `payment_history`, `referral_codes`, `referral_payouts`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-smart-notifications/index.ts`**
  - Tables: `profiles`, `companion_voice_templates`, `push_notification_queue`, `push_subscriptions`, `user_companion`, `mentors`, `daily_check_ins`, `user_daily_horoscopes`, `activity_feed`
  - **Risk**: MEDIUM

- **`supabase/functions/process-daily-decay/index.ts`**
  - Tables: `user_companion`, `daily_tasks`, `habit_completions`, `daily_check_ins`, `profiles`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-proactive-nudges/index.ts`**
  - Tables: `profiles`, `user_companion`, `mentor_nudges`, `mentors`, `daily_check_ins`, `habit_completions`, `habits`, `activity_feed`
  - **Risk**: MEDIUM

#### Medium-Volume Edge Functions:
- **`supabase/functions/reset-companion/index.ts`**
  - Tables: `user_companion`, `xp_events`, `companion_evolutions`, `profiles`
  - **Risk**: MEDIUM

- **`supabase/functions/request-referral-payout/index.ts`**
  - Tables: `profiles`, `referral_payouts`
  - **Risk**: MEDIUM

- **`supabase/functions/record-subscription/index.ts`**
  - Tables: `referral_codes`, `referral_payouts`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-cosmic-deep-dive/index.ts`**
  - Tables: `user_cosmic_deep_dives`, `profiles`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-guild-story/index.ts`**
  - Tables: `epic_members`, `epics`, `guild_stories`, `user_companion`
  - **Risk**: MEDIUM

- **`supabase/functions/mentor-chat/index.ts`**
  - Tables: `mentor_chats`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/process-referral/index.ts`**
  - Tables: `referral_codes`
  - **Risk**: MEDIUM

- **`supabase/functions/create-influencer-code/index.ts`**
  - Tables: `referral_codes`
  - **Risk**: MEDIUM

- **`supabase/functions/process-paypal-payout/index.ts`**
  - Tables: `user_roles`, `referral_payouts`
  - **Risk**: MEDIUM

#### Push Notification Functions:
- **`supabase/functions/schedule-adaptive-pushes/index.ts`**
  - Tables: `adaptive_push_settings`, `profiles`, `mentors`, `adaptive_push_queue`
  - **Risk**: MEDIUM

- **`supabase/functions/deliver-adaptive-pushes/index.ts`**
  - Tables: `adaptive_push_queue`, `adaptive_push_settings`
  - **Risk**: MEDIUM

- **`supabase/functions/trigger-adaptive-event/index.ts`**
  - Tables: `adaptive_push_queue`, `adaptive_push_settings`, `profiles`, `mentors`
  - **Risk**: MEDIUM

- **`supabase/functions/dispatch-daily-pushes/index.ts`**
  - Tables: `user_daily_pushes`, `push_subscriptions`
  - **Risk**: MEDIUM

- **`supabase/functions/dispatch-daily-quote-pushes/index.ts`**
  - Tables: `user_daily_quote_pushes`, `daily_quotes`, `quotes`, `push_device_tokens`
  - **Risk**: MEDIUM

- **`supabase/functions/schedule-daily-mentor-pushes/index.ts`**
  - Tables: `profiles`, `mentors`, `daily_pep_talks`, `user_daily_pushes`
  - **Risk**: MEDIUM

- **`supabase/functions/schedule-daily-quote-pushes/index.ts`**
  - Tables: `profiles`, `mentors`, `daily_quotes`, `user_daily_quote_pushes`
  - **Risk**: MEDIUM

- **`supabase/functions/deliver-scheduled-notifications/index.ts`**
  - Tables: `push_notification_queue`, `push_subscriptions`
  - **Risk**: MEDIUM

- **`supabase/functions/send-shout-notification/index.ts`**
  - Tables: `guild_shouts`, `profiles`, `muted_guild_users`, `shout_push_log`, `push_device_tokens`
  - **Risk**: MEDIUM

#### Content Generation Functions:
- **`supabase/functions/generate-companion-evolution/index.ts`**
  - Tables: `user_companion`, `evolution_thresholds`, `companion_evolutions`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-companion-story/index.ts`**
  - Tables: `user_companion`, `profiles`, `companion_stories`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-cosmic-postcard/index.ts`**
  - Tables: `companion_postcards`, `user_companion`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-daily-horoscope/index.ts`**
  - Tables: `profiles`, `mentors`, `user_daily_horoscopes`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-daily-missions/index.ts`**
  - Tables: `daily_missions`, `profiles`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-weekly-challenges/index.ts`**
  - Tables: `challenges`, `challenge_tasks`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-weekly-insights/index.ts`**
  - Tables: `profiles`, `mentors`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-activity-comment/index.ts`**
  - Tables: `activity_feed`, `profiles`, `mentors`, `daily_pep_talks`, `habits`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-check-in-response/index.ts`**
  - Tables: `daily_check_ins`, `profiles`, `mentors`, `daily_pep_talks`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-reflection-reply/index.ts`**
  - Tables: `user_reflections`, `ai_output_validation_log`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-evolution-card/index.ts`**
  - Tables: `companion_evolution_cards`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-daily-quotes/index.ts`**
  - Tables: `mentors`, `daily_quotes`, `quotes`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-daily-mentor-pep-talks/index.ts`**
  - Tables: `daily_pep_talks`, `mentors`, `pep_talks`
  - **Risk**: MEDIUM

- **`supabase/functions/generate-lesson/index.ts`**
  - Tables: `lessons`, `mentors`
  - **Risk**: MEDIUM

- **`supabase/functions/batch-generate-lessons/index.ts`**
  - Tables: `mentors`, `lessons`
  - **Risk**: MEDIUM

- **`supabase/functions/calculate-cosmic-profile/index.ts`**
  - Tables: `profiles`
  - **Risk**: LOW

- **`supabase/functions/resolve-streak-freeze/index.ts`**
  - Tables: `profiles`
  - **Risk**: LOW

- **`supabase/functions/check-task-reminders/index.ts`**
  - Tables: `daily_tasks`, `push_device_tokens`, `user_companion`
  - **Risk**: MEDIUM

- **`supabase/functions/sync-daily-pep-talk-transcript/index.ts`**
  - Tables: `daily_pep_talks`
  - **Risk**: MEDIUM

#### Shared Utilities:
- **`supabase/functions/_shared/rateLimiter.ts`**
  - Tables: `ai_output_validation_log`
  - **Risk**: LOW

- **`supabase/functions/_shared/promptBuilder.ts`**
  - Tables: `prompt_templates`, `user_ai_preferences`
  - **Risk**: MEDIUM

- **`supabase/functions/_shared/appleSubscriptions.ts`**
  - Tables: `payment_history`, `subscriptions`, `profiles`
  - **Risk**: MEDIUM

## Recommendations

### 1. Add Error Handling to All RPC Calls

All edge functions that call RPC functions should handle 42P01 errors gracefully:

```typescript
try {
  const { error: rpcError } = await supabase.rpc("function_name", params);
  if (rpcError) {
    if (rpcError.code === "42P01") {
      console.error("Database table not found. Migration may not be applied:", rpcError);
      // Return user-friendly error
    }
    throw rpcError;
  }
} catch (error) {
  // Handle error
}
```

### 2. Add Error Handling to Direct Table Queries

For critical operations, wrap table queries in try-catch:

```typescript
try {
  const { data, error } = await supabase.from("table_name").select("*");
  if (error) {
    if (error.code === "42P01") {
      console.error("Table not found:", error);
      // Handle gracefully
    }
    throw error;
  }
} catch (error) {
  // Handle error
}
```

### 3. Create a Shared Error Handler Utility

Create a utility function for consistent error handling:

```typescript
// supabase/functions/_shared/errorHandler.ts
export function handleDatabaseError(error: any): { message: string; status: number } {
  if (error?.code === "42P01") {
    return {
      message: "Database table not found. This usually means a migration hasn't been applied.",
      status: 500
    };
  }
  // Handle other error codes...
  return {
    message: error?.message || "Unknown error",
    status: 500
  };
}
```

### 4. Migration Verification

Before deploying, verify that:
1. All migrations have been applied to the target database
2. All tables referenced in functions exist
3. All RPC functions are properly defined

### 5. Add Database Health Checks

Consider adding a health check endpoint that verifies critical tables exist:

```typescript
// Check if critical tables exist
const criticalTables = ['profiles', 'user_companion', 'referral_codes'];
for (const table of criticalTables) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error?.code === "42P01") {
    throw new Error(`Critical table ${table} does not exist`);
  }
}
```

## Priority Actions

1. **HIGH PRIORITY**: Add error handling to `delete-user` edge function ✅ (Already done)
2. **MEDIUM PRIORITY**: Add error handling to all referral-related functions
3. **MEDIUM PRIORITY**: Add error handling to push notification functions
4. **LOW PRIORITY**: Add error handling to content generation functions (they're less critical)

## Testing Recommendations

1. Test all RPC calls with missing tables (simulate by temporarily renaming tables)
2. Test edge functions with missing tables
3. Add integration tests that verify migrations are applied
4. Monitor error logs for 42P01 errors in production
