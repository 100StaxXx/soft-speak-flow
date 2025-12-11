# Quick Fixes for TODO Functions

This guide provides quick fixes for files with TODO comments that reference functions already available in Firebase.

## Files to Update

### 1. useCompanionRegenerate.ts
**Current:** TODO comment with error throw  
**Fix:** Use `generateCompanionImage` from `@/lib/firebase/functions`

```typescript
import { generateCompanionImage } from '@/lib/firebase/functions';

// Replace TODO section with:
const imageResult = await generateCompanionImage({
  companionId: companion.id,
  stage: companion.current_stage,
  species: companion.spirit_animal,
  element: companion.core_element,
  color: companion.favorite_color,
});
```

### 2. Horoscope.tsx
**Current:** TODO comments for horoscope and cosmic profile  
**Fix:** Use `generateDailyHoroscope` and `calculateCosmicProfile`

```typescript
import { generateDailyHoroscope, calculateCosmicProfile } from '@/lib/firebase/functions';

// For horoscope:
const data = await generateDailyHoroscope({
  zodiacSign: profile?.zodiac_sign || '',
  date: new Date().toISOString(),
});

// For cosmic profile:
const cosmicData = await calculateCosmicProfile();
```

### 3. useCompanionPostcards.ts
**Current:** TODO comment  
**Fix:** Use `generateCosmicPostcard`

```typescript
import { generateCosmicPostcard } from '@/lib/firebase/functions';

const data = await generateCosmicPostcard({
  companionId: companion.id,
  occasion: 'milestone',
});
```

### 4. useCompanionStory.ts
**Current:** TODO comment  
**Fix:** Use `generateCompanionStory`

```typescript
import { generateCompanionStory } from '@/lib/firebase/functions';

const data = await generateCompanionStory({
  companionId: companion.id,
  stage: stage,
});
```

### 5. useGuildStories.ts
**Current:** TODO comment  
**Fix:** Already using `generateGuildStory` - verify it's imported correctly

### 6. Reflection.tsx
**Current:** TODO comment  
**Fix:** Use `generateReflectionReply`

```typescript
import { generateReflectionReply } from '@/lib/firebase/functions';

// In background (non-blocking):
generateReflectionReply({
  reflectionText: reflectionData.text,
  mood: reflectionData.mood,
}).catch(console.error);
```

### 7. useActivityFeed.ts
**Current:** TODO comment  
**Fix:** Use `generateActivityComment`

```typescript
import { generateActivityComment } from '@/lib/firebase/functions';

// In background (non-blocking):
generateActivityComment({
  activityData: activity,
  context: 'user_activity',
}).catch(console.error);
```

### 8. PepTalkDetail.tsx
**Current:** TODO comment  
**Fix:** Use `transcribeAudio`

```typescript
import { transcribeAudio } from '@/lib/firebase/functions';

const transcriptData = await transcribeAudio({
  audioUrl: pepTalk.audio_url,
});
```

### 9. Partners.tsx & Creator.tsx
**Current:** TODO comment  
**Fix:** Use `createInfluencerCode`

```typescript
import { createInfluencerCode } from '@/lib/firebase/functions';

const data = await createInfluencerCode({
  name: formData.name,
  email: formData.email,
  handle: formData.handle,
  paypalEmail: formData.paypalEmail,
});
```

### 10. CosmicDeepDive.tsx
**Current:** TODO comment  
**Fix:** Use `generateCosmicDeepDive`

```typescript
import { generateCosmicDeepDive } from '@/lib/firebase/functions';

const data = await generateCosmicDeepDive({
  topic: selectedTopic,
  userContext: profile?.zodiac_sign,
});
```

### 11. useAudioGeneration.ts
**Current:** Multiple TODO comments  
**Fix:** Use existing functions

```typescript
import { 
  generateMentorScript, 
  generateMentorAudio, 
  generateFullMentorAudio 
} from '@/lib/firebase/functions';

// For script:
const scriptData = await generateMentorScript({...});

// For audio:
const audioData = await generateMentorAudio({...});

// For full:
const fullData = await generateFullMentorAudio({...});
```

### 12. useAdaptiveNotifications.ts
**Current:** TODO comment  
**Fix:** Use `generateSmartNotifications`

```typescript
import { generateSmartNotifications } from '@/lib/firebase/functions';

const data = await generateSmartNotifications({
  context: 'adaptive',
  timeOfDay: getTimeOfDay(),
});
```

## Storage Fixes

### Admin.tsx - Audio Upload
**Current:** TODO for Firebase Storage  
**Fix:** Use Firebase Storage helper

```typescript
import { uploadFile } from '@/lib/firebase/storage';

const filePath = `pep-talk-audio/${fileName}`;
const url = await uploadFile('pep-talk-audio', filePath, audioFile);
```

## Testing After Fixes

After applying these fixes:

1. Test each function call
2. Verify error handling
3. Check loading states
4. Verify data flow
5. Test edge cases

## Notes

- All functions are already available in `src/lib/firebase/functions.ts`
- Most fixes are simple import + function call replacements
- Some may need parameter adjustments based on actual function signatures
- Error handling should be maintained
- Loading states should be preserved

