-- Restore the safe daily pep-talk content source and make notification opt-outs
-- cancel pending daily pep/quote delivery.

ALTER TABLE public.push_notification_queue
  DROP CONSTRAINT IF EXISTS push_notification_queue_status_check;

ALTER TABLE public.push_notification_queue
  ADD CONSTRAINT push_notification_queue_status_check
  CHECK (status IN (
    'queued',
    'processing',
    'retry',
    'sent',
    'failed_terminal',
    'shadow',
    'skipped_rollout',
    'skipped_budget',
    'skipped_disabled'
  ));

CREATE OR REPLACE FUNCTION public.cancel_disabled_daily_notification_sources()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.daily_push_enabled IS DISTINCT FROM TRUE
    AND OLD.daily_push_enabled IS DISTINCT FROM NEW.daily_push_enabled THEN
    UPDATE public.user_daily_pushes
    SET delivered_at = COALESCE(delivered_at, now())
    WHERE user_id = NEW.id
      AND delivered_at IS NULL;

    UPDATE public.push_notification_queue
    SET
      status = 'skipped_disabled',
      delivered = true,
      delivered_at = COALESCE(delivered_at, now()),
      next_retry_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      last_error = 'daily_push_disabled'
    WHERE user_id = NEW.id
      AND notification_type = 'daily_pep'
      AND status IN ('queued', 'retry', 'processing');
  END IF;

  IF NEW.daily_quote_push_enabled IS DISTINCT FROM TRUE
    AND OLD.daily_quote_push_enabled IS DISTINCT FROM NEW.daily_quote_push_enabled THEN
    UPDATE public.user_daily_quote_pushes
    SET delivered_at = COALESCE(delivered_at, now())
    WHERE user_id = NEW.id
      AND delivered_at IS NULL;

    UPDATE public.push_notification_queue
    SET
      status = 'skipped_disabled',
      delivered = true,
      delivered_at = COALESCE(delivered_at, now()),
      next_retry_at = NULL,
      claimed_at = NULL,
      claimed_by = NULL,
      last_error = 'daily_quote_disabled'
    WHERE user_id = NEW.id
      AND notification_type = 'daily_quote'
      AND status IN ('queued', 'retry', 'processing');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cancel_disabled_daily_notification_sources_trigger
  ON public.profiles;

CREATE TRIGGER cancel_disabled_daily_notification_sources_trigger
  AFTER UPDATE OF daily_push_enabled, daily_quote_push_enabled
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_disabled_daily_notification_sources();

SELECT cron.schedule(
  'generate-tomorrow-pep-talks',
  '15 0 * * *',
  $$SELECT public.invoke_edge_function_with_internal_secret('generate-tomorrow-pep-talks', '{}'::jsonb);$$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-tomorrow-pep-talks');
