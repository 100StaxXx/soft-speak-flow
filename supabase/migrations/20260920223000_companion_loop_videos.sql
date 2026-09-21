-- Add four reusable idle moments. No accounts, access grants or paid jobs are created here.
ALTER TABLE public.cosmiq_wellbeing_videos
  DROP CONSTRAINT cosmiq_wellbeing_videos_category_check,
  ADD CONSTRAINT cosmiq_wellbeing_videos_category_check CHECK
    (category IN ('mind','body','soul','idle_breathe','idle_look','idle_rest','idle_greet')),
  ADD COLUMN scene_image_url text;

-- Serialize the per-user daily cap: parallel prewarming must not bypass it.
-- Two full seven-clip sets fit within the cap. Existing monetary budgets are unchanged.
CREATE FUNCTION public.limit_cosmiq_companion_video_queue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('cosmiq-video:' || NEW.user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.cosmiq_wellbeing_videos
    WHERE companion_id = NEW.companion_id AND stage = NEW.stage AND category = NEW.category
      AND source_key = NEW.source_key AND prompt_version = NEW.prompt_version) THEN
    RETURN NEW; -- ON CONFLICT DO NOTHING will reuse the existing job.
  END IF;
  IF (SELECT count(*) FROM public.cosmiq_wellbeing_videos
      WHERE user_id = NEW.user_id AND created_at >= now() - interval '24 hours') >= 14 THEN
    RAISE EXCEPTION 'companion_video_daily_limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.limit_cosmiq_companion_video_queue() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER limit_cosmiq_companion_video_queue BEFORE INSERT ON public.cosmiq_wellbeing_videos
  FOR EACH ROW EXECUTE FUNCTION public.limit_cosmiq_companion_video_queue();
