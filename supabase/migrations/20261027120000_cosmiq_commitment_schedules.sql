-- Fixed commitments are availability, not tasks or XP-bearing activity.
CREATE OR REPLACE FUNCTION public.cosmiq_valid_commitment_blocks(blocks jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE b jsonb; ids text[] := '{}'; d jsonb; k text;
BEGIN
  IF jsonb_typeof(blocks) IS DISTINCT FROM 'array' OR jsonb_array_length(blocks) > 50 THEN RETURN false; END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(blocks) LOOP
    IF jsonb_typeof(b) IS DISTINCT FROM 'object'
      OR NOT (b ?& ARRAY['id','title','kind','repeat','days','start','end','starts_on','ends_on'])
      OR coalesce(length(b->>'id'),0) NOT BETWEEN 1 AND 100 OR b->>'id' = ANY(ids)
      OR coalesce(length(trim(b->>'title')),0) NOT BETWEEN 1 AND 80
      OR b->>'kind' NOT IN ('work','school','commute','other')
      OR b->>'repeat' NOT IN ('weekly','once')
      OR coalesce(b->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR coalesce(b->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      OR b->>'start' = b->>'end'
      OR coalesce(b->>'starts_on','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR jsonb_typeof(b->'days') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    FOREACH k IN ARRAY ARRAY['id','title','kind','repeat','start','end','starts_on'] LOOP
      IF jsonb_typeof(b->k) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
    END LOOP;
    IF (b->>'starts_on')::date::text <> b->>'starts_on' THEN RETURN false; END IF;
    IF b->>'ends_on' IS NOT NULL AND ((b->>'ends_on')::date < (b->>'starts_on')::date
      OR (b->>'ends_on')::date::text <> b->>'ends_on') THEN RETURN false; END IF;
    IF b->>'repeat' = 'weekly' AND jsonb_array_length(b->'days') = 0 THEN RETURN false; END IF;
    IF jsonb_array_length(b->'days') > 7 THEN RETURN false; END IF;
    FOR d IN SELECT value FROM jsonb_array_elements(b->'days') LOOP
      IF jsonb_typeof(d) <> 'number' OR d::text !~ '^[0-6]$' THEN RETURN false; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(b->'days')) <> jsonb_array_length(b->'days') THEN RETURN false; END IF;
    ids := array_append(ids,b->>'id');
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE TABLE public.cosmiq_commitment_schedules (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (public.cosmiq_valid_commitment_blocks(blocks)),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.cosmiq_check_commitment_timezone() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cosmiq_commitment_timezone BEFORE INSERT OR UPDATE ON public.cosmiq_commitment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.cosmiq_check_commitment_timezone();
ALTER TABLE public.cosmiq_commitment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY commitment_owner ON public.cosmiq_commitment_schedules FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.cosmiq_commitment_schedules FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cosmiq_commitment_schedules TO authenticated;
GRANT ALL ON public.cosmiq_commitment_schedules TO service_role;
