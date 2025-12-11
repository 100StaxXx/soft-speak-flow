# Supabase to Firebase Migration - Next Steps

## ✅ Completed
- All components migrated to Firestore
- All Firestore collection helpers created
- Real-time listeners implemented
- Profile, habits, epics, mentors, achievements, and more fully migrated

## 🔄 Next Steps

### 1. Remove Supabase Dependencies

**Files to check:**
- `package.json` - Remove `@supabase/supabase-js` and related packages
- `src/integrations/supabase/` - Can be deleted after verification
- Any remaining imports of `@/integrations/supabase/client`

**Steps:**
```bash
# Check for remaining Supabase imports
grep -r "from.*supabase" src/
grep -r "import.*supabase" src/

# Remove from package.json
npm uninstall @supabase/supabase-js @supabase/auth-helpers-react

# Delete Supabase integration folder (after verification)
rm -rf src/integrations/supabase
```

### 2. Migrate Supabase Edge Functions to Firebase Cloud Functions

**Check for edge function calls:**
- Search for `supabase.functions.invoke()` or similar patterns
- Look for direct HTTP calls to Supabase edge function URLs

**Common patterns to migrate:**
```typescript
// Old Supabase
const { data } = await supabase.functions.invoke('function-name', { body: {...} });

// New Firebase
import { callFunction } from '@/lib/firebase/functions';
const data = await callFunction('function-name', {...});
```

**Functions that may need migration:**
- Companion image generation
- Guild story generation
- Horoscope generation
- Any AI/ML processing functions
- Webhook handlers

### 3. Migrate Supabase Storage to Firebase Storage

**Check for storage usage:**
- Search for `supabase.storage.from()` or `storage.from()`
- Look for file upload/download operations
- Check for image URL patterns from Supabase storage

**Migration pattern:**
```typescript
// Old Supabase Storage
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload('path/to/file', file);

// New Firebase Storage
import { uploadFile, getDownloadURL } from '@/lib/firebase/storage';
const url = await uploadFile('bucket-name', 'path/to/file', file);
```

**Storage buckets to migrate:**
- Companion images
- User avatars
- Mentor images
- Any other file uploads

### 4. Update Authentication

**Current state:**
- Most components use `useAuth` hook (likely already Firebase-based)
- Check if any components still use `supabase.auth`

**Files to check:**
- `src/hooks/useAuth.ts`
- Any components using `supabase.auth.getUser()` or `supabase.auth.getSession()`

**Migration pattern:**
```typescript
// Old Supabase Auth
const { data: { user } } = await supabase.auth.getUser();

// New Firebase Auth
import { useAuth } from '@/hooks/useAuth';
const { user } = useAuth();
```

### 5. Environment Variables

**Update `.env` files:**
- Remove Supabase URL and anon key
- Ensure Firebase config is properly set
- Update any environment-specific configurations

**Variables to remove:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Any other Supabase-related env vars

**Variables to verify:**
- Firebase config variables
- API keys for Firebase services

### 6. Testing Checklist

**Component Testing:**
- [ ] All user-facing components work correctly
- [ ] Data reads/writes function properly
- [ ] Real-time updates work (where applicable)
- [ ] Error handling is appropriate
- [ ] Loading states display correctly

**Feature Testing:**
- [ ] User authentication and profile management
- [ ] Habit tracking and completions
- [ ] Epic/guild functionality
- [ ] Companion features
- [ ] Mentor selection and interactions
- [ ] Achievements and XP tracking
- [ ] Activity feed
- [ ] Push notifications
- [ ] Admin features (referral codes, payouts)

**Integration Testing:**
- [ ] Firebase Cloud Functions work correctly
- [ ] Firebase Storage uploads/downloads work
- [ ] Real-time listeners function properly
- [ ] Batch operations complete successfully

### 7. Cleanup Tasks

**Code cleanup:**
- Remove unused Supabase imports
- Remove commented-out Supabase code
- Update documentation
- Remove Supabase-specific error handling
- Clean up any Supabase type definitions

**File cleanup:**
- Delete `src/integrations/supabase/` directory
- Remove Supabase-related test files
- Update README with Firebase information

### 8. Documentation Updates

**Update:**
- README.md - Remove Supabase references, add Firebase setup
- API documentation - Update endpoints and examples
- Deployment docs - Update for Firebase hosting
- Environment setup guide - Firebase configuration

## Migration Verification Script

Create a script to verify migration completeness:

```typescript
// scripts/verify-migration.ts
// Check for remaining Supabase imports
// Verify all components use Firestore
// Check for missing Firebase configurations
```

## Rollback Plan

**If issues arise:**
1. Keep Supabase integration code in a backup branch
2. Document any breaking changes
3. Have a rollback procedure ready
4. Test migration in staging first

## Timeline Recommendations

1. **Week 1:** Remove Supabase dependencies, test thoroughly
2. **Week 2:** Migrate edge functions to Cloud Functions
3. **Week 3:** Migrate storage, test file operations
4. **Week 4:** Final authentication updates, cleanup
5. **Week 5:** Comprehensive testing, documentation updates

## Notes

- Test each migration step independently
- Keep Supabase instance running during migration for safety
- Monitor Firebase usage and costs
- Update error messages to reference Firebase instead of Supabase
- Ensure all team members are aware of the migration

