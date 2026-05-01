CREATE OR REPLACE FUNCTION public.acknowledge_task_reminder_delivery(
  p_task_id uuid,
  p_delivered_offset_minutes integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task public.daily_tasks%ROWTYPE;
  v_configured_offsets integer[] := '{}'::integer[];
  v_sent_offsets integer[] := '{}'::integer[];
  v_effective_offsets integer[] := '{}'::integer[];
  v_next_sent_offsets integer[] := '{}'::integer[];
  v_legacy_offset integer;
  v_all_sent boolean := false;
BEGIN
  IF p_task_id IS NULL
     OR p_delivered_offset_minutes IS NULL
     OR p_delivered_offset_minutes < 1
     OR p_delivered_offset_minutes > 10080 THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_task
  FROM public.daily_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT offset_value ORDER BY offset_value), '{}'::integer[])
  INTO v_configured_offsets
  FROM unnest(COALESCE(v_task.reminder_offsets_minutes, '{}'::integer[])) AS offsets(offset_value)
  WHERE offset_value BETWEEN 1 AND 10080;

  SELECT COALESCE(array_agg(DISTINCT offset_value ORDER BY offset_value), '{}'::integer[])
  INTO v_sent_offsets
  FROM unnest(COALESCE(v_task.reminder_sent_offsets_minutes, '{}'::integer[])) AS offsets(offset_value)
  WHERE offset_value BETWEEN 1 AND 10080;

  v_legacy_offset := CASE
    WHEN v_task.reminder_minutes_before BETWEEN 1 AND 10080 THEN v_task.reminder_minutes_before
    ELSE p_delivered_offset_minutes
  END;

  v_effective_offsets := CASE
    WHEN COALESCE(array_length(v_configured_offsets, 1), 0) > 0 THEN v_configured_offsets
    ELSE ARRAY[v_legacy_offset]::integer[]
  END;

  SELECT COALESCE(array_agg(DISTINCT offset_value ORDER BY offset_value), '{}'::integer[])
  INTO v_next_sent_offsets
  FROM unnest(v_sent_offsets || ARRAY[p_delivered_offset_minutes]::integer[]) AS offsets(offset_value)
  WHERE offset_value BETWEEN 1 AND 10080;

  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(v_effective_offsets) AS configured(offset_value)
    WHERE configured.offset_value <> ALL(v_next_sent_offsets)
  )
  INTO v_all_sent;

  UPDATE public.daily_tasks
  SET
    reminder_sent_offsets_minutes = v_next_sent_offsets,
    reminder_sent = v_all_sent
  WHERE id = p_task_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.acknowledge_task_reminder_delivery(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_task_reminder_delivery(uuid, integer) TO service_role;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_notification_scan
ON public.daily_tasks(task_date, id)
WHERE completed = false AND scheduled_time IS NOT NULL;
