-- Ensure Lyra and The Operator always have canonical avatar URLs in the mentors table.

UPDATE public.mentors
SET avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png'
WHERE slug = 'lyra';

UPDATE public.mentors
SET avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/operator-mentor.png'
WHERE slug = 'operator';
