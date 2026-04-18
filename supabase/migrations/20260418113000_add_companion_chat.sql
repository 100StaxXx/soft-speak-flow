ALTER TABLE public.user_ai_learning
ADD COLUMN IF NOT EXISTS conversation_profile jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_companion_chat_at timestamptz;

CREATE TABLE IF NOT EXISTS public.companion_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  input_mode text CHECK (input_mode IN ('text', 'voice')),
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companion_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own companion chats"
ON public.companion_chats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companion chats"
ON public.companion_chats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_companion_chats_user_companion_created
ON public.companion_chats(user_id, companion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_chats_user_created
ON public.companion_chats(user_id, created_at DESC);
