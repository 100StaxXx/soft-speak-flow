DO $$
DECLARE
  catalog_today DATE := (now() AT TIME ZONE 'America/Los_Angeles')::date;
BEGIN
  UPDATE public.wallpaper_assets
  SET publish_state = 'suppressed'
  WHERE page_key IN ('quests', 'campaigns', 'companion')
    AND publish_state = 'ready'
    AND (
      source_kind <> 'generated'
      OR generation_date < DATE '2026-04-08'
    );

  DELETE FROM public.daily_wallpaper_assignments
  WHERE for_date = catalog_today
    AND page_key IN ('quests', 'campaigns', 'companion');

  WITH target_pages AS (
    SELECT unnest(ARRAY['quests', 'campaigns', 'companion']) AS page_key
  ),
  eligible_assets AS (
    SELECT
      wa.id,
      wa.page_key,
      wa.generation_date,
      wa.created_at,
      COALESCE((wa.validation_result ->> 'scenicQualityScore')::numeric, 0) AS scenic_quality_score,
      COALESCE((wa.validation_result ->> 'moodMatchScore')::numeric, 0) AS mood_match_score,
      COALESCE((wa.validation_result ->> 'detailScore')::numeric, 0) AS detail_score,
      COALESCE((wa.validation_result ->> 'contrastScore')::numeric, 0) AS contrast_score,
      COALESCE((wa.validation_result ->> 'safeZoneConfidenceScore')::numeric, 0) AS safe_zone_confidence_score
    FROM public.wallpaper_assets wa
    WHERE wa.page_key IN ('quests', 'campaigns', 'companion')
      AND wa.publish_state = 'ready'
      AND wa.source_kind = 'generated'
      AND wa.generation_date >= DATE '2026-04-08'
  ),
  same_day_ranked AS (
    SELECT
      ea.*,
      ROW_NUMBER() OVER (
        PARTITION BY ea.page_key
        ORDER BY
          (
            ea.scenic_quality_score * 0.35
            + ea.mood_match_score * 0.25
            + ea.detail_score * 0.2
            + ea.contrast_score * 0.2
          ) DESC,
          ea.safe_zone_confidence_score DESC,
          ea.created_at DESC
      ) AS rank_in_page
    FROM eligible_assets ea
    WHERE ea.generation_date = catalog_today
  ),
  latest_ranked AS (
    SELECT
      ea.*,
      ROW_NUMBER() OVER (
        PARTITION BY ea.page_key
        ORDER BY ea.created_at DESC
      ) AS rank_in_page
    FROM eligible_assets ea
  ),
  replacement_candidates AS (
    SELECT
      tp.page_key,
      COALESCE(sd.id, lr.id) AS wallpaper_asset_id,
      CASE
        WHEN sd.id IS NOT NULL THEN 'auto'
        ELSE 'carry_forward'
      END AS assignment_source
    FROM target_pages tp
    LEFT JOIN same_day_ranked sd
      ON sd.page_key = tp.page_key
     AND sd.rank_in_page = 1
    LEFT JOIN latest_ranked lr
      ON lr.page_key = tp.page_key
     AND lr.rank_in_page = 1
    WHERE COALESCE(sd.id, lr.id) IS NOT NULL
  )
  INSERT INTO public.daily_wallpaper_assignments (
    page_key,
    for_date,
    wallpaper_asset_id,
    assignment_source
  )
  SELECT
    page_key,
    catalog_today,
    wallpaper_asset_id,
    assignment_source
  FROM replacement_candidates
  ON CONFLICT (page_key, for_date) DO UPDATE
  SET wallpaper_asset_id = EXCLUDED.wallpaper_asset_id,
      assignment_source = EXCLUDED.assignment_source,
      updated_at = now();
END $$;
