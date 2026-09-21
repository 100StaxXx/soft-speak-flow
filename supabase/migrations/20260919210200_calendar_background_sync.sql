-- Disabled until provider/device verification and an explicit rollout. No cron is
-- installed by this migration; it cannot start writing to people's calendars.
CREATE TABLE public.calendar_sync_worker_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  run_token uuid, lease_until timestamptz
);
INSERT INTO public.calendar_sync_worker_control(singleton) VALUES(true);
ALTER TABLE public.calendar_sync_worker_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_sync_worker_control FROM PUBLIC, authenticated, anon;
GRANT ALL ON public.calendar_sync_worker_control TO service_role;

-- Provider Retry-After applies to the account, not merely the item that hit it.
CREATE TABLE public.calendar_sync_connection_backoff (
  connection_id uuid PRIMARY KEY REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  retry_after timestamptz NOT NULL
);
ALTER TABLE public.calendar_sync_connection_backoff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_sync_connection_backoff FROM PUBLIC, authenticated, anon;
GRANT ALL ON public.calendar_sync_connection_backoff TO service_role;

ALTER TABLE public.calendar_quest_imports
  ADD COLUMN next_background_sync_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN background_failure_count integer NOT NULL DEFAULT 0;
CREATE INDEX calendar_quest_background_due ON public.calendar_quest_imports(next_background_sync_at)
  WHERE sync_enabled AND provider IN ('google','outlook') AND sync_status IN ('linked','retry');

CREATE FUNCTION public.claim_calendar_sync_worker()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE token uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE public.calendar_sync_worker_control SET run_token=gen_random_uuid(),lease_until=now()+interval '3 minutes'
    WHERE singleton AND enabled AND (lease_until IS NULL OR lease_until<=now())
    RETURNING run_token INTO token;
  RETURN token;
END $$;

CREATE FUNCTION public.release_calendar_sync_worker(p_run_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  UPDATE public.calendar_sync_worker_control SET run_token=NULL,lease_until=NULL WHERE run_token=p_run_token;
END $$;

CREATE FUNCTION public.claim_next_calendar_background_sync(p_run_token uuid)
RETURNS SETOF public.calendar_quest_imports LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE linkid uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.calendar_sync_worker_control WHERE enabled AND run_token=p_run_token AND lease_until>now()) THEN RETURN; END IF;
  SELECT l.id INTO linkid FROM public.calendar_quest_imports l
    JOIN public.user_calendar_connections c ON c.id=l.connection_id AND c.user_id=l.user_id AND c.provider=l.provider AND c.sync_enabled
    JOIN public.daily_tasks t ON t.id=l.task_id AND t.user_id=l.user_id
    WHERE l.sync_enabled AND l.provider IN ('google','outlook') AND l.sync_status IN ('linked','retry')
      AND l.next_background_sync_at<=now() AND (l.sync_lease_until IS NULL OR l.sync_lease_until<=now())
      AND NOT EXISTS(SELECT 1 FROM public.calendar_sync_connection_backoff b WHERE b.connection_id=l.connection_id AND b.retry_after>now())
    ORDER BY l.next_background_sync_at,l.id LIMIT 1 FOR UPDATE OF l SKIP LOCKED;
  IF linkid IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.calendar_quest_imports SET sync_token=gen_random_uuid(),sync_lease_until=now()+interval '3 minutes',
    next_background_sync_at=now()+interval '5 minutes' WHERE id=linkid RETURNING *;
END $$;

CREATE FUNCTION public.finish_calendar_background_sync(
  p_user_id uuid,p_link_id uuid,p_revision bigint,p_token uuid,p_expected jsonb,p_snapshot jsonb,
  p_status text,p_error text DEFAULT NULL,p_retry_seconds integer DEFAULT 0
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ok boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.calendar_quest_imports WHERE id=p_link_id AND user_id=p_user_id AND provider IN ('google','outlook')) THEN RETURN false; END IF;
  ok := public._apply_calendar_quest_sync(p_user_id,p_link_id,p_revision,p_token,p_expected,p_snapshot,p_status,p_error);
  IF ok THEN
    IF p_status='retry' AND p_retry_seconds>0 THEN
      INSERT INTO public.calendar_sync_connection_backoff(connection_id,retry_after)
        SELECT connection_id,now()+make_interval(secs=>least(p_retry_seconds,86400))
        FROM public.calendar_quest_imports WHERE id=p_link_id AND user_id=p_user_id
        ON CONFLICT(connection_id) DO UPDATE SET retry_after=greatest(calendar_sync_connection_backoff.retry_after,excluded.retry_after);
    END IF;
    UPDATE public.calendar_quest_imports SET
      next_background_sync_at=now()+make_interval(secs=>CASE WHEN p_status='retry'
        THEN greatest(least(greatest(coalesce(p_retry_seconds,0),0),86400),
          least(3600,60*power(2,least(background_failure_count,6)))::integer) ELSE 120 END),
      background_failure_count=CASE WHEN p_status='retry' THEN least(background_failure_count+1,100) ELSE 0 END
      WHERE id=p_link_id AND user_id=p_user_id;
  ELSE
    -- A stale local snapshot must not strand the lease or overwrite the newer quest.
    UPDATE public.calendar_quest_imports SET sync_token=NULL,sync_lease_until=NULL
      WHERE id=p_link_id AND user_id=p_user_id AND sync_token=p_token;
  END IF;
  RETURN ok;
END $$;

REVOKE ALL ON FUNCTION public.claim_calendar_sync_worker() FROM PUBLIC,authenticated,anon;
REVOKE ALL ON FUNCTION public.release_calendar_sync_worker(uuid) FROM PUBLIC,authenticated,anon;
REVOKE ALL ON FUNCTION public.claim_next_calendar_background_sync(uuid) FROM PUBLIC,authenticated,anon;
REVOKE ALL ON FUNCTION public.finish_calendar_background_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text,integer) FROM PUBLIC,authenticated,anon;
GRANT EXECUTE ON FUNCTION public.claim_calendar_sync_worker() TO service_role;
GRANT EXECUTE ON FUNCTION public.release_calendar_sync_worker(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_calendar_background_sync(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_calendar_background_sync(uuid,uuid,bigint,uuid,jsonb,jsonb,text,text,integer) TO service_role;
