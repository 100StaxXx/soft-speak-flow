# TODO Functions Status

This document tracks functions that have TODO comments for Firebase migration and their current status.

## Functions Already Available in Firebase

These functions are already implemented in `src/lib/firebase/functions.ts` and can be used directly:

### ✅ Available and Ready to Use

1. **generateCompanionImage** - Available
   - Location: `src/lib/firebase/functions.ts:255`
   - TODO in: `src/hooks/useCompanionRegenerate.ts:44`

2. **generateDailyHoroscope** - Available
   - Location: `src/lib/firebase/functions.ts:204`
   - TODO in: `src/pages/Horoscope.tsx:82`

3. **generateCosmicPostcard** - Available
   - Location: `src/lib/firebase/functions.ts:180`
   - TODO in: `src/hooks/useCompanionPostcards.ts:66`

4. **generateCompanionStory** - Available
   - Location: `src/lib/firebase/functions.ts:76`
   - TODO in: `src/hooks/useCompanionStory.ts:81`, `src/hooks/useCompanion.ts:255`

5. **generateGuildStory** - Available
   - Location: `src/lib/firebase/functions.ts:168`
   - TODO in: `src/hooks/useGuildStories.ts:62`

6. **generateReflectionReply** - Available
   - Location: `src/lib/firebase/functions.ts:156`
   - TODO in: `src/pages/Reflection.tsx:82`

7. **generateActivityComment** - Available
   - Location: `src/lib/firebase/functions.ts:320`
   - TODO in: `src/hooks/useActivityFeed.ts:94`

8. **generateCheckInResponse** - Available
   - Location: `src/lib/firebase/functions.ts:284`
   - TODO in: (used in MorningCheckIn component)

9. **transcribeAudio** - Available
   - Location: `src/lib/firebase/functions.ts:516`
   - TODO in: `src/pages/PepTalkDetail.tsx:78`

10. **createInfluencerCode** - Available
    - Location: `src/lib/firebase/functions.ts:567`
    - TODO in: `src/pages/Partners.tsx:37`, `src/pages/Creator.tsx:33`

11. **generateCosmicDeepDive** - Available
    - Location: `src/lib/firebase/functions.ts:192`
    - TODO in: `src/pages/CosmicDeepDive.tsx:84`

12. **generateMentorScript** - Available
    - Location: `src/lib/firebase/functions.ts:216`
    - TODO in: `src/hooks/useAudioGeneration.ts:23`

13. **generateMentorAudio** - Available
    - Location: `src/lib/firebase/functions.ts:463`
    - TODO in: `src/hooks/useAudioGeneration.ts:45`

14. **generateFullMentorAudio** - Available
    - Location: `src/lib/firebase/functions.ts:475`
    - TODO in: `src/hooks/useAudioGeneration.ts:67`

15. **generateSmartNotifications** - Available
    - Location: `src/lib/firebase/functions.ts:132`
    - TODO in: `src/hooks/useAdaptiveNotifications.ts:111`

## Functions That Need Implementation

These functions have TODOs but are not yet in the Firebase functions file:

### 🔄 Need to Add to functions.ts

1. **sendShoutNotification** - Not in functions.ts
   - TODO in: `src/hooks/useGuildShouts.ts:109`
   - Note: May need to be implemented

2. **applyReferralCode** - Not in functions.ts
   - TODO in: `src/hooks/useReferrals.ts:123`
   - Note: Currently done directly in Firestore, may need atomic operation

## Storage TODOs

1. **Admin Audio Upload** - Storage migration needed
   - TODO in: `src/pages/Admin.tsx:198`
   - Note: Needs Firebase Storage integration

## Action Items

### High Priority (Functions Available)
Update these files to use existing Firebase functions:

1. `src/hooks/useCompanionRegenerate.ts` - Use `generateCompanionImage`
2. `src/pages/Horoscope.tsx` - Use `generateDailyHoroscope` and `calculateCosmicProfile`
3. `src/hooks/useCompanionPostcards.ts` - Use `generateCosmicPostcard`
4. `src/hooks/useCompanionStory.ts` - Use `generateCompanionStory`
5. `src/hooks/useCompanion.ts` - Use `generateCompanionStory`
6. `src/hooks/useGuildStories.ts` - Use `generateGuildStory`
7. `src/pages/Reflection.tsx` - Use `generateReflectionReply`
8. `src/hooks/useActivityFeed.ts` - Use `generateActivityComment`
9. `src/pages/PepTalkDetail.tsx` - Use `transcribeAudio`
10. `src/pages/Partners.tsx` - Use `createInfluencerCode`
11. `src/pages/Creator.tsx` - Use `createInfluencerCode`
12. `src/pages/CosmicDeepDive.tsx` - Use `generateCosmicDeepDive`
13. `src/hooks/useAudioGeneration.ts` - Use `generateMentorScript`, `generateMentorAudio`, `generateFullMentorAudio`
14. `src/hooks/useAdaptiveNotifications.ts` - Use `generateSmartNotifications`

### Medium Priority (Need Implementation)
1. `src/hooks/useGuildShouts.ts` - Implement `sendShoutNotification`
2. `src/hooks/useReferrals.ts` - Consider atomic `applyReferralCode` function
3. `src/pages/Admin.tsx` - Migrate audio upload to Firebase Storage

## Quick Fix Pattern

For files with available functions, replace:

```typescript
// TODO: Migrate to Firebase Cloud Function
// const response = await fetch('https://YOUR-FIREBASE-FUNCTION/function-name', {
//   method: 'POST',
//   ...
// });
throw new Error("Needs Firebase Cloud Function migration");
```

With:

```typescript
import { functionName } from '@/lib/firebase/functions';
const result = await functionName({ ...params });
```

## Notes

- Most functions are already available and just need to be imported and used
- Some functions may need parameter adjustments
- Storage operations need Firebase Storage helper integration
- All functions should handle errors appropriately

