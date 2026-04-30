\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(6);

SELECT ok(
  to_regclass('public.idx_daily_tasks_habit_date_unique') IS NOT NULL,
  'daily task habit conflict index exists'
);

SELECT ok(
  (
    SELECT i.indisunique
    FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.idx_daily_tasks_habit_date_unique')
  ),
  'daily task habit conflict index is unique'
);

SELECT is(
  (
    SELECT pg_get_expr(i.indpred, i.indrelid)
    FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.idx_daily_tasks_habit_date_unique')
  ),
  NULL::text,
  'daily task habit conflict index is non-partial'
);

SELECT is(
  (
    SELECT array_agg(a.attname ORDER BY key_position)
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS indexed(attnum, key_position)
    JOIN pg_attribute a
      ON a.attrelid = i.indrelid
     AND a.attnum = indexed.attnum
    WHERE i.indexrelid = to_regclass('public.idx_daily_tasks_habit_date_unique')
  ),
  ARRAY['user_id', 'task_date', 'habit_source_id']::name[],
  'daily task habit conflict index uses the expected columns'
);

INSERT INTO public.habits (
  id,
  user_id,
  title,
  frequency,
  is_active
)
VALUES (
  'aaaaaaaa-3530-4000-8000-000000000001',
  'aaaaaaaa-3530-4000-8000-000000000002',
  'Habit conflict index test',
  'daily',
  true
);

INSERT INTO public.daily_tasks (
  id,
  user_id,
  task_text,
  task_date,
  habit_source_id,
  source
)
VALUES (
  'aaaaaaaa-3530-4000-8000-000000000003',
  'aaaaaaaa-3530-4000-8000-000000000002',
  'Habit conflict index first insert',
  '2026-04-30',
  'aaaaaaaa-3530-4000-8000-000000000001',
  'manual'
);

SELECT lives_ok(
  $$
    INSERT INTO public.daily_tasks (
      id,
      user_id,
      task_text,
      task_date,
      habit_source_id,
      source
    )
    VALUES (
      'aaaaaaaa-3530-4000-8000-000000000004',
      'aaaaaaaa-3530-4000-8000-000000000002',
      'Habit conflict index second insert',
      '2026-04-30',
      'aaaaaaaa-3530-4000-8000-000000000001',
      'manual'
    )
    ON CONFLICT (user_id, task_date, habit_source_id) DO UPDATE
    SET task_text = EXCLUDED.task_text
  $$,
  'ON CONFLICT can infer the daily task habit index'
);

INSERT INTO public.daily_tasks (
  id,
  user_id,
  task_text,
  task_date,
  habit_source_id,
  scheduled_time,
  source
)
VALUES
  (
    'aaaaaaaa-3530-4000-8000-000000000005',
    'aaaaaaaa-3530-4000-8000-000000000002',
    'Non-habit conflict index first insert',
    '2026-04-30',
    NULL,
    '09:00',
    'manual'
  ),
  (
    'aaaaaaaa-3530-4000-8000-000000000006',
    'aaaaaaaa-3530-4000-8000-000000000002',
    'Non-habit conflict index second insert',
    '2026-04-30',
    NULL,
    '10:00',
    'manual'
  );

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.daily_tasks
    WHERE user_id = 'aaaaaaaa-3530-4000-8000-000000000002'
      AND task_date = '2026-04-30'
      AND habit_source_id IS NULL
  ),
  2,
  'non-habit rows with null habit_source_id can coexist'
);

SELECT * FROM finish();
ROLLBACK;
