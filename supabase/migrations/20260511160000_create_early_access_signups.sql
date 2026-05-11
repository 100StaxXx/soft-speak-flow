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

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage early access signups" ON public.early_access_signups;
CREATE POLICY "Admins can manage early access signups"
  ON public.early_access_signups
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

  RETURN v_signup;
END;
$$;

REVOKE ALL ON FUNCTION public.record_early_access_signup(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_early_access_signup(text, text, text, text, jsonb) TO service_role;
