BEGIN;

CREATE TABLE IF NOT EXISTS public.companion_narrative_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  epic_id uuid REFERENCES public.epics(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('story', 'postcard')),
  source_id uuid NOT NULL,
  stage integer CHECK (stage IS NULL OR stage BETWEEN 0 AND 100),
  chapter_number integer CHECK (chapter_number IS NULL OR chapter_number > 0),
  prompt_key text NOT NULL CHECK (char_length(prompt_key) BETWEEN 1 AND 80),
  prompt_text text NOT NULL CHECK (char_length(prompt_text) BETWEEN 1 AND 500),
  option_key text NOT NULL CHECK (char_length(option_key) BETWEEN 1 AND 80),
  option_label text NOT NULL CHECK (char_length(option_label) BETWEEN 1 AND 160),
  response_note text CHECK (response_note IS NULL OR char_length(response_note) <= 1000),
  consequence_tags text[] NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(consequence_tags) <= 8),
  companion_reply text CHECK (companion_reply IS NULL OR char_length(companion_reply) <= 500),
  side_quest_title text CHECK (side_quest_title IS NULL OR char_length(side_quest_title) <= 180),
  side_quest_status text NOT NULL DEFAULT 'proposed'
    CHECK (side_quest_status IN ('proposed', 'accepted', 'dismissed')),
  side_quest_task_id uuid REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id, prompt_key)
);

CREATE TABLE IF NOT EXISTS public.companion_narrative_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  epic_id uuid REFERENCES public.epics(id) ON DELETE SET NULL,
  source_choice_id uuid REFERENCES public.companion_narrative_choices(id) ON DELETE CASCADE,
  memory_type text NOT NULL
    CHECK (memory_type IN ('choice', 'discovery', 'promise', 'reflection', 'item', 'relationship')),
  memory_key text NOT NULL CHECK (char_length(memory_key) BETWEEN 1 AND 180),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 1000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  salience smallint NOT NULL DEFAULT 3 CHECK (salience BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, companion_id, memory_key)
);

CREATE INDEX IF NOT EXISTS companion_narrative_choices_companion_created_idx
  ON public.companion_narrative_choices (companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS companion_narrative_choices_epic_created_idx
  ON public.companion_narrative_choices (epic_id, created_at DESC)
  WHERE epic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS companion_narrative_memories_active_idx
  ON public.companion_narrative_memories (companion_id, salience DESC, updated_at DESC)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS companion_narrative_memories_epic_active_idx
  ON public.companion_narrative_memories (epic_id, salience DESC, updated_at DESC)
  WHERE epic_id IS NOT NULL AND status = 'active';

ALTER TABLE public.companion_narrative_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_narrative_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own companion narrative choices"
  ON public.companion_narrative_choices;
CREATE POLICY "Users can view own companion narrative choices"
  ON public.companion_narrative_choices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own companion narrative choices"
  ON public.companion_narrative_choices;
CREATE POLICY "Users can insert own companion narrative choices"
  ON public.companion_narrative_choices FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_companion companion
      WHERE companion.id = companion_id AND companion.user_id = auth.uid()
    )
    AND (
      epic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.epics epic
        WHERE epic.id = epic_id
          AND (
            epic.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.epic_members member
              WHERE member.epic_id = epic.id AND member.user_id = auth.uid()
            )
          )
      )
    )
    AND (
      (
        source_type = 'story'
        AND EXISTS (
          SELECT 1 FROM public.companion_stories story
          WHERE story.id = source_id
            AND story.companion_id = companion_id
            AND story.user_id = auth.uid()
        )
      )
      OR (
        source_type = 'postcard'
        AND EXISTS (
          SELECT 1 FROM public.companion_postcards postcard
          WHERE postcard.id = source_id
            AND postcard.companion_id = companion_id
            AND postcard.user_id = auth.uid()
            AND postcard.epic_id IS NOT DISTINCT FROM epic_id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own companion narrative choices"
  ON public.companion_narrative_choices;
CREATE POLICY "Users can update own companion narrative choices"
  ON public.companion_narrative_choices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_companion companion
      WHERE companion.id = companion_id AND companion.user_id = auth.uid()
    )
    AND (
      epic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.epics epic
        WHERE epic.id = epic_id
          AND (
            epic.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.epic_members member
              WHERE member.epic_id = epic.id AND member.user_id = auth.uid()
            )
          )
      )
    )
    AND (
      (
        source_type = 'story'
        AND EXISTS (
          SELECT 1 FROM public.companion_stories story
          WHERE story.id = source_id
            AND story.companion_id = companion_id
            AND story.user_id = auth.uid()
        )
      )
      OR (
        source_type = 'postcard'
        AND EXISTS (
          SELECT 1 FROM public.companion_postcards postcard
          WHERE postcard.id = source_id
            AND postcard.companion_id = companion_id
            AND postcard.user_id = auth.uid()
            AND postcard.epic_id IS NOT DISTINCT FROM epic_id
        )
      )
    )
    AND (
      side_quest_task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.daily_tasks task
        WHERE task.id = side_quest_task_id AND task.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own companion narrative choices"
  ON public.companion_narrative_choices;
CREATE POLICY "Users can delete own companion narrative choices"
  ON public.companion_narrative_choices FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own companion narrative memories"
  ON public.companion_narrative_memories;
CREATE POLICY "Users can view own companion narrative memories"
  ON public.companion_narrative_memories FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own companion narrative memories"
  ON public.companion_narrative_memories;
CREATE POLICY "Users can insert own companion narrative memories"
  ON public.companion_narrative_memories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_companion companion
      WHERE companion.id = companion_id AND companion.user_id = auth.uid()
    )
    AND (
      epic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.epics epic
        WHERE epic.id = epic_id
          AND (
            epic.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.epic_members member
              WHERE member.epic_id = epic.id AND member.user_id = auth.uid()
            )
          )
      )
    )
    AND source_choice_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.companion_narrative_choices choice
      WHERE choice.id = source_choice_id
        AND choice.user_id = auth.uid()
        AND choice.companion_id = companion_id
    )
  );

DROP POLICY IF EXISTS "Users can update own companion narrative memories"
  ON public.companion_narrative_memories;
CREATE POLICY "Users can update own companion narrative memories"
  ON public.companion_narrative_memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_companion companion
      WHERE companion.id = companion_id AND companion.user_id = auth.uid()
    )
    AND (
      epic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.epics epic
        WHERE epic.id = epic_id
          AND (
            epic.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.epic_members member
              WHERE member.epic_id = epic.id AND member.user_id = auth.uid()
            )
          )
      )
    )
    AND source_choice_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.companion_narrative_choices choice
      WHERE choice.id = source_choice_id
        AND choice.user_id = auth.uid()
        AND choice.companion_id = companion_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own companion narrative memories"
  ON public.companion_narrative_memories;
CREATE POLICY "Users can delete own companion narrative memories"
  ON public.companion_narrative_memories FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_companion_narrative_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companion_narrative_choices_touch_updated_at
  ON public.companion_narrative_choices;
CREATE TRIGGER companion_narrative_choices_touch_updated_at
BEFORE UPDATE ON public.companion_narrative_choices
FOR EACH ROW EXECUTE FUNCTION public.touch_companion_narrative_updated_at();

DROP TRIGGER IF EXISTS companion_narrative_memories_touch_updated_at
  ON public.companion_narrative_memories;
CREATE TRIGGER companion_narrative_memories_touch_updated_at
BEFORE UPDATE ON public.companion_narrative_memories
FOR EACH ROW EXECUTE FUNCTION public.touch_companion_narrative_updated_at();

CREATE OR REPLACE FUNCTION public.record_companion_narrative_choice(
  p_companion_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_prompt_key text,
  p_prompt_text text,
  p_option_key text,
  p_option_label text,
  p_memory_type text,
  p_memory_key text,
  p_memory_summary text,
  p_consequence_tags text[] DEFAULT '{}'::text[],
  p_epic_id uuid DEFAULT NULL,
  p_stage integer DEFAULT NULL,
  p_chapter_number integer DEFAULT NULL,
  p_companion_reply text DEFAULT NULL,
  p_side_quest_title text DEFAULT NULL,
  p_response_note text DEFAULT NULL
)
RETURNS public.companion_narrative_choices
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_choice public.companion_narrative_choices;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_companion companion
    WHERE companion.id = p_companion_id AND companion.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Companion not found' USING ERRCODE = '42501';
  END IF;

  IF p_epic_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.epics epic
    WHERE epic.id = p_epic_id
      AND (
        epic.user_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.epic_members member
          WHERE member.epic_id = epic.id AND member.user_id = v_user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Epic not found' USING ERRCODE = '42501';
  END IF;

  IF p_source_type = 'story' AND NOT EXISTS (
    SELECT 1 FROM public.companion_stories story
    WHERE story.id = p_source_id
      AND story.companion_id = p_companion_id
      AND story.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Story source not found' USING ERRCODE = '22023';
  END IF;

  IF p_source_type = 'postcard' AND NOT EXISTS (
    SELECT 1 FROM public.companion_postcards postcard
    WHERE postcard.id = p_source_id
      AND postcard.companion_id = p_companion_id
      AND postcard.user_id = v_user_id
      AND postcard.epic_id IS NOT DISTINCT FROM p_epic_id
  ) THEN
    RAISE EXCEPTION 'Postcard source not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.companion_narrative_choices (
    user_id,
    companion_id,
    epic_id,
    source_type,
    source_id,
    stage,
    chapter_number,
    prompt_key,
    prompt_text,
    option_key,
    option_label,
    response_note,
    consequence_tags,
    companion_reply,
    side_quest_title
  ) VALUES (
    v_user_id,
    p_companion_id,
    p_epic_id,
    p_source_type,
    p_source_id,
    p_stage,
    p_chapter_number,
    p_prompt_key,
    p_prompt_text,
    p_option_key,
    p_option_label,
    NULLIF(trim(p_response_note), ''),
    COALESCE(p_consequence_tags, '{}'::text[]),
    NULLIF(trim(p_companion_reply), ''),
    NULLIF(trim(p_side_quest_title), '')
  )
  ON CONFLICT (user_id, source_type, source_id, prompt_key)
  DO UPDATE SET
    option_key = EXCLUDED.option_key,
    option_label = EXCLUDED.option_label,
    response_note = EXCLUDED.response_note,
    consequence_tags = EXCLUDED.consequence_tags,
    companion_reply = EXCLUDED.companion_reply,
    side_quest_title = EXCLUDED.side_quest_title,
    side_quest_status = CASE
      WHEN public.companion_narrative_choices.side_quest_status = 'accepted'
        THEN 'accepted'
      ELSE 'proposed'
    END
  RETURNING * INTO v_choice;

  INSERT INTO public.companion_narrative_memories (
    user_id,
    companion_id,
    epic_id,
    source_choice_id,
    memory_type,
    memory_key,
    summary,
    details,
    salience
  ) VALUES (
    v_user_id,
    p_companion_id,
    p_epic_id,
    v_choice.id,
    p_memory_type,
    p_memory_key,
    p_memory_summary,
    jsonb_build_object(
      'source_type', p_source_type,
      'source_id', p_source_id,
      'prompt', p_prompt_text,
      'answer', p_option_label,
      'note', NULLIF(trim(p_response_note), ''),
      'tags', COALESCE(p_consequence_tags, '{}'::text[])
    ),
    CASE p_memory_type
      WHEN 'promise' THEN 5
      WHEN 'relationship' THEN 4
      WHEN 'choice' THEN 4
      ELSE 3
    END
  )
  ON CONFLICT (user_id, companion_id, memory_key)
  DO UPDATE SET
    epic_id = EXCLUDED.epic_id,
    source_choice_id = EXCLUDED.source_choice_id,
    memory_type = EXCLUDED.memory_type,
    summary = EXCLUDED.summary,
    details = EXCLUDED.details,
    salience = EXCLUDED.salience,
    status = 'active';

  RETURN v_choice;
END;
$$;

REVOKE ALL ON FUNCTION public.record_companion_narrative_choice(
  uuid, text, uuid, text, text, text, text, text, text, text, text[], uuid,
  integer, integer, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_companion_narrative_choice(
  uuid, text, uuid, text, text, text, text, text, text, text, text[], uuid,
  integer, integer, text, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.touch_companion_narrative_updated_at() FROM PUBLIC;

COMMIT;
