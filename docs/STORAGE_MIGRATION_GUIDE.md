# Storage Migration Guide

## Overview
This guide helps migrate Supabase Storage usage to Firebase Storage.

## Firebase Storage Helper

The Firebase Storage helper is available at `src/lib/firebase/storage.ts`:

```typescript
import { uploadFile, getFileDownloadURL, deleteFile, uploadFileWithMetadata } from '@/lib/firebase/storage';
```

## Migration Patterns

### Upload File

**Supabase:**
```typescript
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload('path/to/file', file);
```

**Firebase:**
```typescript
const url = await uploadFile('bucket-name', 'path/to/file', file);
```

### Get Download URL

**Supabase:**
```typescript
const { data } = supabase.storage
  .from('bucket-name')
  .getPublicUrl('path/to/file');
const url = data.publicUrl;
```

**Firebase:**
```typescript
const url = await getFileDownloadURL('bucket-name', 'path/to/file');
```

### Delete File

**Supabase:**
```typescript
await supabase.storage
  .from('bucket-name')
  .remove(['path/to/file']);
```

**Firebase:**
```typescript
await deleteFile('bucket-name', 'path/to/file');
```

### Upload with Metadata

**Firebase:**
```typescript
const { url, result } = await uploadFileWithMetadata(
  'bucket-name',
  'path/to/file',
  file,
  { customField: 'value' }
);
```

## Files to Check

Based on the search, these files may contain storage usage:

1. `src/pages/Profile.tsx` - Profile image uploads
2. `src/pages/Admin.tsx` - Admin file operations
3. `src/components/QuoteImageGenerator.tsx` - Quote image generation
4. `src/pages/Library.tsx` - Library file operations
5. `src/utils/imageDownload.ts` - Image download utilities
6. `src/utils/hashtagParser.ts` - May reference image URLs
7. `src/pages/PremiumSuccess.tsx` - Premium-related files
8. `src/pages/Premium.tsx` - Premium-related files
9. `src/components/ShareableStreakBadge.tsx` - Badge image generation
10. `src/components/InstallPWA.tsx` - PWA assets
11. `src/components/EvolutionCardFlip.tsx` - Evolution card images
12. `src/components/EnhancedShareButton.tsx` - Share image generation

## Common Storage Buckets

Based on the codebase, these buckets are likely used:

- `companion-images` - Companion evolution images
- `mentor-images` - Mentor avatars
- `quote-images` - Quote images
- `user-avatars` - User profile pictures
- `pep-talk-audio` - Audio files for pep talks
- `evolution-cards` - Evolution card images

## Migration Steps

1. **Identify Storage Usage**
   - Search for `supabase.storage` or `storage.from`
   - Check file upload/download operations
   - Identify bucket names

2. **Update Imports**
   ```typescript
   // Remove
   import { supabase } from '@/integrations/supabase/client';
   
   // Add
   import { uploadFile, getFileDownloadURL, deleteFile } from '@/lib/firebase/storage';
   ```

3. **Update Function Calls**
   - Replace Supabase storage calls with Firebase helpers
   - Update error handling
   - Test file operations

4. **Update URLs**
   - Update any hardcoded Supabase storage URLs
   - Update image references
   - Test image loading

5. **Test**
   - Test file uploads
   - Test file downloads
   - Test image display
   - Test file deletion

## Notes

- Firebase Storage uses different URL patterns than Supabase
- File paths may need adjustment
- Permissions are handled differently (Firebase Security Rules)
- Consider updating Firebase Storage security rules

## Security Rules

After migration, ensure Firebase Storage security rules are configured:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Add appropriate rules
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

