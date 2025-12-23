-- Add community_id to shout_push_log table for community shouts
ALTER TABLE public.shout_push_log ADD COLUMN community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

-- Make epic_id nullable since we now support community-only shouts
ALTER TABLE public.shout_push_log ALTER COLUMN epic_id DROP NOT NULL;

-- Add check constraint to ensure at least one context is set
ALTER TABLE public.shout_push_log ADD CONSTRAINT shout_push_log_context_check 
  CHECK (epic_id IS NOT NULL OR community_id IS NOT NULL);

-- Add index for community-based lookups
CREATE INDEX idx_shout_push_log_community ON public.shout_push_log (sender_id, recipient_id, community_id, sent_at);