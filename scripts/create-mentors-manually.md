# Manual Mentor Creation in Firebase Console

Since Firestore security rules are blocking writes, you can manually create the mentors in the Firebase Console:

1. Go to Firebase Console → Firestore Database
2. Click "Start collection" or navigate to `mentors` collection
3. For each mentor, click "Add document" and use the Supabase ID as the document ID
4. Add these fields:

## Mentor Data Structure

For each mentor, create a document with these fields:

- `name` (string): Mentor name (e.g., "Sienna", "Lumi", "Rich")
- `slug` (string): Mentor slug (e.g., "sienna", "lumi", "stryker")
- `description` (string): Full description
- `tone_description` (string): Tone description
- `avatar_url` (string, optional): Avatar URL
- `tags` (array): Array of tag strings
- `mentor_type` (string): Mentor type
- `target_user_type` (string, optional): Target user type
- `short_title` (string, optional): Short title
- `primary_color` (string): Primary color (e.g., "#7B68EE")
- `target_user` (string, optional): Target user
- `themes` (array, optional): Array of theme strings
- `intensity_level` (string, optional): "high", "medium", or "gentle"
- `is_active` (boolean): true
- `created_at` (timestamp): Creation timestamp

## Quick Option: Use the Output Script

Run this to get JSON you can paste into Firebase Console:

```bash
$env:VITE_SUPABASE_URL="https://tffrgsaawvletgiztfry.supabase.co"
$env:VITE_SUPABASE_PUBLISHABLE_KEY="your_key"
npx ts-node scripts/export-mentors-json.ts
```

