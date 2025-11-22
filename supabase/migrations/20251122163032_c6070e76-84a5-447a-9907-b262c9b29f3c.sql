-- Fix user_ai_preferences to not reference auth.users (only profiles)
ALTER TABLE public.user_ai_preferences 
DROP CONSTRAINT IF EXISTS user_ai_preferences_user_id_fkey;

ALTER TABLE public.user_ai_preferences
ADD CONSTRAINT user_ai_preferences_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Same fix for ai_output_validation_log
ALTER TABLE public.ai_output_validation_log
DROP CONSTRAINT IF EXISTS ai_output_validation_log_user_id_fkey;

ALTER TABLE public.ai_output_validation_log
ADD CONSTRAINT ai_output_validation_log_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;