ALTER TABLE public.companion_chats
ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'companion',
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'chat';

ALTER TABLE public.companion_chats
DROP CONSTRAINT IF EXISTS companion_chats_surface_check;

ALTER TABLE public.companion_chats
ADD CONSTRAINT companion_chats_surface_check
CHECK (surface IN ('companion', 'journeys'));

ALTER TABLE public.companion_chats
DROP CONSTRAINT IF EXISTS companion_chats_source_check;

ALTER TABLE public.companion_chats
ADD CONSTRAINT companion_chats_source_check
CHECK (source IN ('chat', 'plan'));

CREATE INDEX IF NOT EXISTS idx_companion_chats_user_surface_created
ON public.companion_chats(user_id, surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_chats_session_created
ON public.companion_chats(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_companion_chats_session_source_created
ON public.companion_chats(session_id, source, created_at ASC);

CREATE TABLE IF NOT EXISTS public.companion_chat_threads (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('companion', 'journeys')),
  title text NOT NULL,
  preview_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

ALTER TABLE public.companion_chat_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion chat threads" ON public.companion_chat_threads;
CREATE POLICY "Users can view own companion chat threads"
ON public.companion_chat_threads
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own companion chat threads" ON public.companion_chat_threads;
CREATE POLICY "Users can insert own companion chat threads"
ON public.companion_chat_threads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own companion chat threads" ON public.companion_chat_threads;
CREATE POLICY "Users can update own companion chat threads"
ON public.companion_chat_threads
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_companion_chat_threads_user_companion_surface_archived
ON public.companion_chat_threads(user_id, companion_id, surface, archived_at, last_message_at DESC);
