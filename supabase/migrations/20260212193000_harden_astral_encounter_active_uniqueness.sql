-- Keep only the newest unfinished astral encounter per user.
-- Older unfinished duplicates are stale and should be closed out.
WITH ranked_unfinished AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.astral_encounters
  WHERE completed_at IS NULL
),
stale_unfinished AS (
  SELECT id
  FROM ranked_unfinished
  WHERE rn > 1
)
UPDATE public.astral_encounters ae
SET completed_at = now()
FROM stale_unfinished su
WHERE ae.id = su.id
  AND ae.completed_at IS NULL;

-- Enforce at most one unfinished encounter per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_astral_encounters_one_active_per_user
  ON public.astral_encounters(user_id)
  WHERE completed_at IS NULL;
