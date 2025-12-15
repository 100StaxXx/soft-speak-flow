-- Add push notification tracking to mentor_nudges
ALTER TABLE public.mentor_nudges 
ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying of unsent pushes
CREATE INDEX IF NOT EXISTS idx_mentor_nudges_push_pending 
ON public.mentor_nudges (user_id, push_sent_at) 
WHERE push_sent_at IS NULL;