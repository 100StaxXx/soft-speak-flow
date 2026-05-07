ALTER TABLE public.push_notification_queue
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

UPDATE public.push_notification_queue
SET read_at = COALESCE(read_at, delivered_at, now())
WHERE read_at IS NULL
  AND delivered_at IS NOT NULL
  AND delivered_at < now() - interval '24 hours';

CREATE INDEX IF NOT EXISTS idx_push_notification_queue_unread
  ON public.push_notification_queue (user_id, delivered_at DESC)
  WHERE delivered_at IS NOT NULL
    AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_push_notification_read(p_queue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_queue_id IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.push_notification_queue
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_queue_id
    AND user_id = auth.uid()
    AND delivered_at IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_push_notification_opened(p_queue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_queue_id IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.push_notification_queue
  SET
    read_at = COALESCE(read_at, now()),
    opened_at = COALESCE(opened_at, now())
  WHERE id = p_queue_id
    AND user_id = auth.uid()
    AND delivered_at IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_all_push_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.push_notification_queue
  SET read_at = COALESCE(read_at, now())
  WHERE user_id = auth.uid()
    AND delivered_at IS NOT NULL
    AND read_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_push_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_push_notification_opened(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_push_notifications_read() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_push_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_push_notification_opened(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_push_notifications_read() TO authenticated;
