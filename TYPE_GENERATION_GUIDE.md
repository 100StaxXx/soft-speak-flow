# 📘 TypeScript Type Generation Guide

**After applying migrations, you MUST regenerate types for the new RPC functions.**

---

## Quick Start

### Option 1: Use the Provided Script (Easiest)

```bash
./REGENERATE_TYPES.sh
```

This script:
- ✅ Uses your project ID automatically
- ✅ Backs up existing types
- ✅ Generates new types
- ✅ Shows verification checklist

---

### Option 2: Manual Command

```bash
supabase gen types typescript \
  --project-id tffrgsaawvletgiztfry \
  > src/integrations/supabase/types.ts
```

---

## Prerequisites

### 1. Install Supabase CLI (if not installed)

**NPM:**
```bash
npm install -g supabase
```

**Homebrew (Mac):**
```bash
brew install supabase/tap/supabase
```

**Other methods:** https://supabase.com/docs/guides/cli

### 2. Ensure Migrations Are Applied

The types can only be generated AFTER the database functions exist.

**Apply migrations first:**
```bash
# If using local dev:
supabase db push

# If using cloud:
supabase db push --project-ref tffrgsaawvletgiztfry
```

---

## Verification

After regenerating types, verify they include the new functions:

### Check 1: File Size
```bash
wc -c src/integrations/supabase/types.ts
```
Should be significantly larger (added ~200-300 lines).

### Check 2: Search for New Functions
```bash
grep -E "complete_referral_stage3|apply_referral_code_atomic" src/integrations/supabase/types.ts
```
Should find matches.

### Check 3: TypeScript Compilation
```bash
npm run type-check
# OR
npx tsc --noEmit
```
Should pass without errors.

### Check 4: Build
```bash
npm run build
```
Should build successfully.

---

## Expected Types

After regeneration, `src/integrations/supabase/types.ts` should include:

```typescript
Functions: {
  complete_referral_stage3: {
    Args: {
      p_referee_id: string
      p_referrer_id: string
    }
    Returns: Json
  }
  apply_referral_code_atomic: {
    Args: {
      p_user_id: string
      p_referrer_id: string
      p_referral_code: string
    }
    Returns: Json
  }
  has_completed_referral: {
    Args: {
      p_referee_id: string
      p_referrer_id: string
    }
    Returns: boolean
  }
  increment_referral_count: {
    Args: {
      referrer_id: string
    }
    Returns: undefined
  }
  decrement_referral_count: {
    Args: {
      referrer_id: string
    }
    Returns: undefined
  }
  // ... other existing functions
}
```

---

## What If It Fails?

### Error: "Function not found"

**Cause:** Migrations not applied to the database.

**Fix:**
```bash
# Check migration status
supabase migration list

# Apply pending migrations
supabase db push
```

### Error: "Authentication failed"

**Cause:** Not logged in to Supabase.

**Fix:**
```bash
supabase login
```

### Error: "Project not found"

**Cause:** Project ID incorrect or no access.

**Fix:**
1. Check project ID in Supabase dashboard
2. Verify you have access to the project
3. Try: `supabase projects list`

### Error: "Command not found"

**Cause:** Supabase CLI not installed.

**Fix:** See "Prerequisites" section above.

---

## Alternative: Download from Dashboard

If CLI doesn't work, you can generate types via the Supabase Dashboard:

1. Go to: https://app.supabase.com/project/tffrgsaawvletgiztfry
2. Click "API Docs" in sidebar
3. Scroll to "Generate Types"
4. Click "TypeScript" tab
5. Copy the generated types
6. Paste into `src/integrations/supabase/types.ts`

---

## After Type Generation

### Update Code (Optional)

You can now replace the interim types with generated ones:

**Before (using interim types):**
```typescript
import type { CompleteReferralStage3Result } from "@/types/referral-functions";
```

**After (using generated types):**
```typescript
import type { Database } from "@/integrations/supabase/types";

type CompleteReferralStage3Result = 
  Database["public"]["Functions"]["complete_referral_stage3"]["Returns"];
```

**Note:** The interim types in `src/types/referral-functions.ts` are compatible and can remain if you prefer.

---

## Automation (CI/CD)

Add to your deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Regenerate Supabase types
  run: |
    npm install -g supabase
    supabase gen types typescript \
      --project-id ${{ secrets.SUPABASE_PROJECT_ID }} \
      > src/integrations/supabase/types.ts
    
- name: Verify types
  run: npm run type-check
```

---

## Summary

1. ✅ Install Supabase CLI
2. ✅ Apply migrations
3. ✅ Run: `./REGENERATE_TYPES.sh` OR manual command
4. ✅ Verify types include new functions
5. ✅ Run type check and build
6. ✅ Commit updated types.ts

---

## Need Help?

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Type Generation:** https://supabase.com/docs/guides/api/generating-types
- **Your Project Dashboard:** https://app.supabase.com/project/tffrgsaawvletgiztfry

---

**Your Project ID:** `tffrgsaawvletgiztfry`  
**Output File:** `src/integrations/supabase/types.ts`  
**Script:** `./REGENERATE_TYPES.sh`

✨ Types must be regenerated after migrations for type safety! ✨
