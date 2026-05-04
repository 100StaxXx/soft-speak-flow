ALTER TABLE public.daily_tasks
ADD COLUMN IF NOT EXISTS excluded_from_planner_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_task_date_planner_visible
ON public.daily_tasks(user_id, task_date)
WHERE excluded_from_planner_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_excluded_from_planner
ON public.daily_tasks(user_id, excluded_from_planner_at DESC)
WHERE excluded_from_planner_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.deleted_planner_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('campaign', 'ritual', 'habit', 'task')),
  entity_id uuid,
  title text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_planner_entities_entity
ON public.deleted_planner_entities(user_id, entity_type, entity_id)
WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deleted_planner_entities_user_deleted
ON public.deleted_planner_entities(user_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_deleted_planner_entities_user_title
ON public.deleted_planner_entities(user_id, lower(title))
WHERE title IS NOT NULL;

ALTER TABLE public.deleted_planner_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deleted planner entities" ON public.deleted_planner_entities;
CREATE POLICY "Users can view own deleted planner entities"
ON public.deleted_planner_entities
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage deleted planner entities" ON public.deleted_planner_entities;
CREATE POLICY "Service role can manage deleted planner entities"
ON public.deleted_planner_entities
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.remove_deleted_planner_entries_from_jsonb_array(
  p_array jsonb,
  p_deleted_title text,
  p_deleted_id uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_agg(entry ORDER BY ordinal), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(p_array, '[]'::jsonb)) = 'array' THEN COALESCE(p_array, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS items(entry, ordinal)
  WHERE NOT (
    (
      NULLIF(btrim(COALESCE(p_deleted_title, '')), '') IS NOT NULL
      AND position(
        lower(btrim(p_deleted_title))
        IN lower(CASE WHEN jsonb_typeof(entry) = 'string' THEN entry #>> '{}' ELSE entry::text END)
      ) > 0
    )
    OR (
      p_deleted_id IS NOT NULL
      AND position(
        lower(p_deleted_id::text)
        IN lower(CASE WHEN jsonb_typeof(entry) = 'string' THEN entry #>> '{}' ELSE entry::text END)
      ) > 0
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.remove_deleted_planner_text_array_key(
  p_doc jsonb,
  p_key text,
  p_deleted_title text,
  p_deleted_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_doc IS NULL OR jsonb_typeof(p_doc) <> 'object' THEN
    RETURN p_doc;
  END IF;

  IF jsonb_typeof(p_doc -> p_key) IS DISTINCT FROM 'array' THEN
    RETURN p_doc;
  END IF;

  RETURN jsonb_set(
    p_doc,
    ARRAY[p_key],
    public.remove_deleted_planner_entries_from_jsonb_array(p_doc -> p_key, p_deleted_title, p_deleted_id),
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.forget_deleted_planner_entities(
  p_user_id uuid,
  p_entities jsonb,
  p_source text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity jsonb;
  v_entity_type text;
  v_entity_id uuid;
  v_entity_id_text text;
  v_title text;
  v_metadata jsonb;
  v_like_title text;
  v_like_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR v_entity IN
    SELECT value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(COALESCE(p_entities, '[]'::jsonb)) = 'array'
        THEN COALESCE(p_entities, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS entries(value)
  LOOP
    v_entity_type := NULLIF(btrim(COALESCE(v_entity ->> 'entity_type', v_entity ->> 'entityType', '')), '');
    IF v_entity_type = 'epic' THEN
      v_entity_type := 'campaign';
    END IF;
    IF v_entity_type NOT IN ('campaign', 'ritual', 'habit', 'task') THEN
      CONTINUE;
    END IF;

    v_entity_id := NULL;
    v_entity_id_text := NULLIF(btrim(COALESCE(v_entity ->> 'entity_id', v_entity ->> 'entityId', '')), '');
    IF v_entity_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_entity_id := v_entity_id_text::uuid;
    END IF;

    v_title := NULLIF(btrim(COALESCE(v_entity ->> 'title', v_entity ->> 'name', '')), '');
    v_metadata := CASE
      WHEN jsonb_typeof(v_entity -> 'metadata') = 'object' THEN v_entity -> 'metadata'
      ELSE '{}'::jsonb
    END;

    IF v_entity_id IS NULL AND v_title IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.deleted_planner_entities (
      user_id,
      entity_type,
      entity_id,
      title,
      deleted_at,
      source,
      metadata
    )
    VALUES (
      p_user_id,
      v_entity_type,
      v_entity_id,
      v_title,
      now(),
      p_source,
      v_metadata
    )
    ON CONFLICT (user_id, entity_type, entity_id) WHERE entity_id IS NOT NULL
    DO UPDATE SET
      title = COALESCE(EXCLUDED.title, public.deleted_planner_entities.title),
      deleted_at = GREATEST(public.deleted_planner_entities.deleted_at, EXCLUDED.deleted_at),
      source = COALESCE(EXCLUDED.source, public.deleted_planner_entities.source),
      metadata = public.deleted_planner_entities.metadata || EXCLUDED.metadata;

    IF v_entity_id IS NOT NULL THEN
      IF v_entity_type = 'task' THEN
        UPDATE public.daily_tasks
        SET excluded_from_planner_at = COALESCE(excluded_from_planner_at, now())
        WHERE user_id = p_user_id
          AND id = v_entity_id;
      ELSIF v_entity_type = 'campaign' THEN
        UPDATE public.daily_tasks
        SET excluded_from_planner_at = COALESCE(excluded_from_planner_at, now())
        WHERE user_id = p_user_id
          AND epic_id = v_entity_id;
      ELSE
        UPDATE public.daily_tasks
        SET excluded_from_planner_at = COALESCE(excluded_from_planner_at, now())
        WHERE user_id = p_user_id
          AND habit_source_id = v_entity_id;
      END IF;
    END IF;

    v_like_title := CASE
      WHEN v_title IS NULL THEN NULL
      ELSE '%' || replace(replace(replace(v_title, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
    END;
    v_like_id := CASE
      WHEN v_entity_id IS NULL THEN NULL
      ELSE '%' || v_entity_id::text || '%'
    END;

    IF to_regclass('public.companion_chats') IS NOT NULL THEN
      DELETE FROM public.companion_chats
      WHERE user_id = p_user_id
        AND (
          (v_like_title IS NOT NULL AND content ILIKE v_like_title ESCAPE E'\\')
          OR (v_like_id IS NOT NULL AND content ILIKE v_like_id)
        );
    END IF;

    IF to_regclass('public.companion_memories') IS NOT NULL THEN
      DELETE FROM public.companion_memories
      WHERE user_id = p_user_id
        AND (
          (v_like_title IS NOT NULL AND memory_context::text ILIKE v_like_title ESCAPE E'\\')
          OR (v_like_id IS NOT NULL AND memory_context::text ILIKE v_like_id)
        );
    END IF;

    IF to_regclass('public.companion_pending_actions') IS NOT NULL THEN
      DELETE FROM public.companion_pending_actions
      WHERE user_id = p_user_id
        AND (
          (v_like_title IS NOT NULL AND (
            summary ILIKE v_like_title ESCAPE E'\\'
            OR confirmation_message ILIKE v_like_title ESCAPE E'\\'
            OR normalized_payload::text ILIKE v_like_title ESCAPE E'\\'
            OR affected_entities::text ILIKE v_like_title ESCAPE E'\\'
            OR metadata::text ILIKE v_like_title ESCAPE E'\\'
          ))
          OR (v_like_id IS NOT NULL AND (
            normalized_payload::text ILIKE v_like_id
            OR affected_entities::text ILIKE v_like_id
            OR metadata::text ILIKE v_like_id
          ))
        );
    END IF;

    IF to_regclass('public.planner_events') IS NOT NULL THEN
      DELETE FROM public.planner_events
      WHERE user_id = p_user_id
        AND (
          (v_entity_id IS NOT NULL AND v_entity_type = 'campaign' AND epic_id = v_entity_id)
          OR (v_entity_id IS NOT NULL AND v_entity_type = 'task' AND task_id = v_entity_id)
          OR (v_like_title IS NOT NULL AND payload::text ILIKE v_like_title ESCAPE E'\\')
          OR (v_like_id IS NOT NULL AND payload::text ILIKE v_like_id)
        );
    END IF;

    IF to_regclass('public.user_ai_learning') IS NOT NULL THEN
      UPDATE public.user_ai_learning
      SET
        conversation_profile = public.remove_deleted_planner_text_array_key(
          conversation_profile,
          'goals',
          v_title,
          v_entity_id
        ),
        successful_patterns = public.remove_deleted_planner_text_array_key(
          public.remove_deleted_planner_text_array_key(
            successful_patterns,
            'ai_accepted',
            v_title,
            v_entity_id
          ),
          'recurring_tasks',
          v_title,
          v_entity_id
        ),
        updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.forget_deleted_planner_entities(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forget_deleted_planner_entities(uuid, jsonb, text) TO authenticated, service_role;
