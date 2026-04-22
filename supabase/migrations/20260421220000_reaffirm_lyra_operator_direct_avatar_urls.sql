-- Reaffirm canonical direct avatar URLs for Lyra and The Operator.
-- This is intentionally idempotent so environments with older mentor rows
-- converge on the same direct storage-backed avatar URLs.

UPDATE public.mentors
SET avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png'
WHERE slug = 'lyra'
  AND avatar_url IS DISTINCT FROM 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png';

UPDATE public.mentors
SET avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/operator-mentor.png'
WHERE slug = 'operator'
  AND avatar_url IS DISTINCT FROM 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/operator-mentor.png';
