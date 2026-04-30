# Daily task habit conflict index

These checks guard the unique arbiter used by Supabase upserts with:

```sql
ON CONFLICT (user_id, task_date, habit_source_id)
```

The shipped migration is `supabase/migrations/20260430120000_replace_partial_habit_task_conflict_index.sql`. It intentionally replaces the legacy partial index with a non-partial unique index so Postgres can infer the conflict target.

## Preflight checks

Estimate duplicate cleanup volume before deploying:

```sql
WITH ranked_habit_instances AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, task_date, habit_source_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS row_num
  FROM public.daily_tasks
  WHERE habit_source_id IS NOT NULL
)
SELECT count(*) AS duplicate_rows_to_delete
FROM ranked_habit_instances
WHERE row_num > 1;
```

Check current table and related index sizes:

```sql
SELECT
  pg_size_pretty(pg_relation_size('public.daily_tasks')) AS daily_tasks_table_size,
  pg_size_pretty(pg_total_relation_size('public.daily_tasks')) AS daily_tasks_total_size;

SELECT
  indexname,
  pg_size_pretty(pg_relation_size((schemaname || '.' || indexname)::regclass)) AS index_size,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_tasks'
  AND indexname IN (
    'idx_daily_tasks_habit_date_unique',
    'idx_daily_tasks_habit_source_id'
  )
ORDER BY indexname;
```

## Post-deploy checks

Confirm the replacement index is non-partial:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_daily_tasks_habit_date_unique';
```

Expected `indexdef`:

```text
CREATE UNIQUE INDEX idx_daily_tasks_habit_date_unique ON public.daily_tasks USING btree (user_id, task_date, habit_source_id)
```

Confirm `ON CONFLICT` inference works against the deployed schema by running the DB regression test:

```sh
npm run test:migrations:habit-index:db
```
