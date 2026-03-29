\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();

INSERT INTO public.user_companion (
  user_id,
  favorite_color,
  spirit_animal,
  core_element,
  story_tone,
  discipline,
  resolve,
  vitality,
  wisdom,
  creativity,
  alignment
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '#7c3aed',
  'Phoenix',
  'Ice',
  'steady',
  300,
  300,
  300,
  300,
  300,
  300
)
ON CONFLICT (user_id) DO UPDATE
SET
  discipline = EXCLUDED.discipline,
  resolve = EXCLUDED.resolve,
  vitality = EXCLUDED.vitality,
  wisdom = EXCLUDED.wisdom,
  creativity = EXCLUDED.creativity,
  alignment = EXCLUDED.alignment,
  updated_at = NOW();

DELETE FROM public.companion_attribute_events
WHERE user_id = '10000000-0000-0000-0000-000000000001';

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');

SELECT is(
  (
    SELECT awarded_amount
    FROM public.award_companion_attribute(
      'discipline',
      'habit_complete',
      'habit_complete:habit-1:2026-03-28',
      4,
      TRUE
    )
    LIMIT 1
  ),
  4,
  'habit completion awards four discipline'
);

SELECT is(
  (
    SELECT discipline
    FROM public.user_companion
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  304,
  'habit completion updates discipline'
);

SELECT is(
  (
    SELECT resolve
    FROM public.user_companion
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  301,
  'habit completion applies a positive resolve echo'
);

SELECT ok(
  (
    SELECT was_duplicate
    FROM public.award_companion_attribute(
      'discipline',
      'habit_complete',
      'habit_complete:habit-1:2026-03-28',
      4,
      TRUE
    )
    LIMIT 1
  ),
  'duplicate source keys are detected'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.companion_attribute_events
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND attribute = 'discipline'
      AND source_key = 'habit_complete:habit-1:2026-03-28'
  ),
  1,
  'duplicate source keys do not insert another event row'
);

SELECT is(
  (
    SELECT awarded_amount
    FROM public.award_companion_attribute(
      'discipline',
      'planned_task_on_time',
      'planned_task_on_time:task-1',
      2,
      TRUE
    )
    LIMIT 1
  ),
  2,
  'first planned on-time task awards two discipline'
);

SELECT is(
  (
    SELECT awarded_amount
    FROM public.award_companion_attribute(
      'discipline',
      'planned_task_on_time',
      'planned_task_on_time:task-2',
      2,
      TRUE
    )
    LIMIT 1
  ),
  2,
  'second planned on-time task awards two discipline'
);

SELECT is(
  (
    SELECT awarded_amount
    FROM public.award_companion_attribute(
      'discipline',
      'planned_task_on_time',
      'planned_task_on_time:task-3',
      2,
      TRUE
    )
    LIMIT 1
  ),
  0,
  'repeatable discipline gains stop once the daily cap is reached'
);

SELECT ok(
  (
    SELECT cap_applied
    FROM public.award_companion_attribute(
      'discipline',
      'planned_task_on_time',
      'planned_task_on_time:task-4',
      2,
      TRUE
    )
    LIMIT 1
  ),
  'cap_applied is true after the repeatable daily cap is exhausted'
);

SELECT is(
  (
    SELECT discipline
    FROM public.user_companion
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  308,
  'repeatable awards stop at the eight-point daily cap'
);

SELECT is(
  (
    SELECT awarded_amount
    FROM public.award_companion_attribute(
      'discipline',
      'streak_milestone',
      'streak_milestone:14:2026-03-28',
      25,
      TRUE
    )
    LIMIT 1
  ),
  25,
  'streak milestones bypass the repeatable daily cap'
);

SELECT is(
  (
    SELECT discipline
    FROM public.user_companion
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  333,
  'streak milestones still increase discipline after the repeatable cap'
);

SELECT is(
  (
    SELECT resolve
    FROM public.user_companion
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  308,
  'resolve echo accumulates across successful discipline awards'
);

CREATE TEMP TABLE tmp_discipline_scores (
  original_score INTEGER NOT NULL,
  score INTEGER NOT NULL
);

INSERT INTO tmp_discipline_scores (original_score, score)
VALUES
  (300, 300),
  (795, 795),
  (1000, 1000);

UPDATE tmp_discipline_scores
SET score = CASE
  WHEN score > 300 THEN LEAST(
    1000,
    GREATEST(100, ROUND(300 + ((score - 300) * 0.45))::INTEGER)
  )
  ELSE score
END;

SELECT is(
  (SELECT score FROM tmp_discipline_scores WHERE original_score = 300),
  300,
  'compression keeps 300 unchanged'
);

SELECT is(
  (SELECT score FROM tmp_discipline_scores WHERE original_score = 795),
  523,
  'compression maps 795 to 523'
);

SELECT ok(
  (
    SELECT array_agg(score ORDER BY original_score) = ARRAY[300, 523, 615]
    FROM tmp_discipline_scores
  ),
  'compression preserves ordering for scores above 300'
);

SELECT * FROM finish();
ROLLBACK;
