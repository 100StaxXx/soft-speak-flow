-- Add neglect tracking columns to user_companion
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS neglected_image_url TEXT,
ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS inactive_days INTEGER DEFAULT 0;

-- Add streak freeze columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS streak_freezes_available INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_streak_freeze_used TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS streak_freezes_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days');

-- Create index for efficient daily decay processing
CREATE INDEX IF NOT EXISTS idx_user_companion_inactive_days ON public.user_companion(inactive_days);
CREATE INDEX IF NOT EXISTS idx_profiles_streak_freezes_reset ON public.profiles(streak_freezes_reset_at);