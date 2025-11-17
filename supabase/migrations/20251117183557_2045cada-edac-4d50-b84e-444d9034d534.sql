-- Speed up pep talk filtering by emotional triggers
CREATE INDEX IF NOT EXISTS idx_pep_talks_emotional_triggers ON pep_talks USING GIN(emotional_triggers);

-- Speed up daily missions queries
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON daily_missions(user_id, mission_date DESC);

-- Speed up activity feed queries
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON activity_feed(user_id, created_at DESC);

-- Speed up pep talks by mentor queries
CREATE INDEX IF NOT EXISTS idx_pep_talks_mentor_created ON pep_talks(mentor_slug, created_at DESC);

-- Speed up quotes by mentor queries
CREATE INDEX IF NOT EXISTS idx_quotes_mentor ON quotes(mentor_id);

-- Speed up user companion lookups
CREATE INDEX IF NOT EXISTS idx_user_companion_user ON user_companion(user_id);

-- Speed up habit completions queries
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON habit_completions(user_id, date DESC);