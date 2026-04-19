ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS companion_name TEXT NULL;
