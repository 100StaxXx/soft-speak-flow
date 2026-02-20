CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  is_image BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_sort
  ON public.task_attachments(task_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_task_attachments_user_created
  ON public.task_attachments(user_id, created_at DESC);

CREATE POLICY "Users can view their task attachments"
ON public.task_attachments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their task attachments"
ON public.task_attachments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their task attachments"
ON public.task_attachments
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their task attachments"
ON public.task_attachments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
