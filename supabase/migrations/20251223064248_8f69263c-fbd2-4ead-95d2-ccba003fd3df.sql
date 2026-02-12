DO $$
BEGIN
  IF to_regclass('public.achievements') IS NOT NULL THEN
    -- Clean up existing duplicate achievements (keep only earliest per user/type).
    DELETE FROM achievements a
    USING achievements b
    WHERE a.user_id = b.user_id
      AND a.achievement_type = b.achievement_type
      AND a.earned_at > b.earned_at;

    -- Add unique constraint to prevent future duplicates.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'achievements_user_achievement_unique'
    ) THEN
      ALTER TABLE achievements
      ADD CONSTRAINT achievements_user_achievement_unique
      UNIQUE (user_id, achievement_type);
    END IF;
  END IF;
END $$;
