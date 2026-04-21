ALTER TABLE public.companion_chats
DROP CONSTRAINT IF EXISTS companion_chats_source_check;

ALTER TABLE public.companion_chats
ADD CONSTRAINT companion_chats_source_check
CHECK (source IN ('chat', 'plan', 'agent'));

ALTER TABLE public.companion_chat_threads
ADD COLUMN IF NOT EXISTS openai_conversation_id text,
ADD COLUMN IF NOT EXISTS last_openai_response_id text;

CREATE TABLE IF NOT EXISTS public.companion_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL REFERENCES public.companion_chat_threads(session_id) ON DELETE CASCADE,
  session_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'failed', 'executed')),
  intent text NOT NULL,
  action_type text NOT NULL,
  normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL,
  affected_entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmation_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb,
  execution_error jsonb,
  idempotency_key text NOT NULL,
  replaced_by_action_id uuid REFERENCES public.companion_pending_actions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (thread_id = session_id)
);

ALTER TABLE public.companion_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion pending actions" ON public.companion_pending_actions;
CREATE POLICY "Users can view own companion pending actions"
ON public.companion_pending_actions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own companion pending actions" ON public.companion_pending_actions;
CREATE POLICY "Users can insert own companion pending actions"
ON public.companion_pending_actions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own companion pending actions" ON public.companion_pending_actions;
CREATE POLICY "Users can update own companion pending actions"
ON public.companion_pending_actions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_companion_pending_actions_thread_created
ON public.companion_pending_actions(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_pending_actions_user_status
ON public.companion_pending_actions(user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_pending_actions_thread_pending_unique
ON public.companion_pending_actions(thread_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_pending_actions_idempotency
ON public.companion_pending_actions(user_id, idempotency_key);
