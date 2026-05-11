CREATE TABLE IF NOT EXISTS public.early_access_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  referrer text,
  user_agent text,
  signup_count integer NOT NULL DEFAULT 1 CHECK (signup_count > 0),
  status text NOT NULL DEFAULT 'pending',
  owner_notification_status text NOT NULL DEFAULT 'not_attempted',
  owner_notification_error text,
  owner_notified_at timestamptz,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_signup_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT early_access_signups_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT early_access_signups_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS early_access_signups_email_unique
  ON public.early_access_signups (email);

CREATE INDEX IF NOT EXISTS early_access_signups_created_at_idx
  ON public.early_access_signups (created_at DESC);

CREATE TABLE IF NOT EXISTS public.early_access_notification_recipients (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_access_notification_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage early access signups" ON public.early_access_signups;
CREATE POLICY "Admins can manage early access signups"
  ON public.early_access_signups
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can manage early access notification recipients" ON public.early_access_notification_recipients;
CREATE POLICY "Admins can manage early access notification recipients"
  ON public.early_access_notification_recipients
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_early_access_signups_updated_at ON public.early_access_signups;
CREATE TRIGGER update_early_access_signups_updated_at
  BEFORE UPDATE ON public.early_access_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_early_access_signup(
  p_email text,
  p_source text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_request_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.early_access_signups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_signup public.early_access_signups;
  v_owner_id uuid;
  v_queued_count integer := 0;
BEGIN
  IF v_email IS NULL OR v_email = '' OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  INSERT INTO public.early_access_signups (
    email,
    source,
    referrer,
    user_agent,
    request_metadata
  )
  VALUES (
    v_email,
    NULLIF(btrim(p_source), ''),
    NULLIF(btrim(p_referrer), ''),
    NULLIF(btrim(p_user_agent), ''),
    COALESCE(p_request_metadata, '{}'::jsonb)
  )
  ON CONFLICT (email)
  DO UPDATE SET
    signup_count = public.early_access_signups.signup_count + 1,
    source = COALESCE(EXCLUDED.source, public.early_access_signups.source),
    referrer = COALESCE(EXCLUDED.referrer, public.early_access_signups.referrer),
    user_agent = COALESCE(EXCLUDED.user_agent, public.early_access_signups.user_agent),
    request_metadata = COALESCE(public.early_access_signups.request_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'last_request',
        EXCLUDED.request_metadata,
        'last_duplicate_at',
        timezone('utc', now())
      ),
    last_signup_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  RETURNING * INTO v_signup;

  BEGIN
    FOR v_owner_id IN
      SELECT DISTINCT recipients.user_id
      FROM public.early_access_notification_recipients AS recipients
      INNER JOIN public.profiles AS profiles
        ON profiles.id = recipients.user_id
      UNION
      SELECT DISTINCT roles.user_id
      FROM public.user_roles AS roles
      INNER JOIN public.profiles AS profiles
        ON profiles.id = roles.user_id
      WHERE roles.role = 'admin'::public.app_role
    LOOP
      INSERT INTO public.push_notification_queue (
        user_id,
        notification_type,
        title,
        body,
        scheduled_for,
        context,
        delivered,
        status,
        source_table,
        source_id,
        dedupe_key,
        priority,
        payload,
        channel
      )
      VALUES (
        v_owner_id,
        'plan_day_overdue',
        'New Cosmiq early access signup',
        v_email,
        timezone('utc', now()),
        jsonb_build_object(
          'type', 'early_access_signup',
          'signup_id', v_signup.id,
          'email', v_email,
          'signup_count', v_signup.signup_count
        ),
        false,
        'queued',
        'early_access_signups',
        v_signup.id,
        'early_access_signup:' || v_signup.id::text || ':' || v_signup.signup_count::text,
        100,
        jsonb_build_object(
          'type', 'early_access_signup',
          'signup_id', v_signup.id,
          'email', v_email,
          'signup_count', v_signup.signup_count
        ),
        'apns'
      )
      ON CONFLICT (dedupe_key) DO NOTHING;

      IF FOUND THEN
        v_queued_count := v_queued_count + 1;
      END IF;
    END LOOP;

    UPDATE public.early_access_signups
    SET
      owner_notification_status = CASE
        WHEN v_queued_count > 0 THEN 'queued'
        ELSE 'no_owner_configured'
      END,
      owner_notification_error = NULL,
      owner_notified_at = CASE
        WHEN v_queued_count > 0 THEN timezone('utc', now())
        ELSE owner_notified_at
      END,
      updated_at = timezone('utc', now())
    WHERE id = v_signup.id
    RETURNING * INTO v_signup;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.early_access_signups
      SET
        owner_notification_status = 'enqueue_failed',
        owner_notification_error = SQLERRM,
        updated_at = timezone('utc', now())
      WHERE id = v_signup.id
      RETURNING * INTO v_signup;
  END;

  RETURN v_signup;
END;
$$;

REVOKE ALL ON FUNCTION public.record_early_access_signup(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_early_access_signup(text, text, text, text, jsonb) TO anon, authenticated, service_role;
