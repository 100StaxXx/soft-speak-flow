ALTER TABLE public.daily_pep_talks
ADD COLUMN IF NOT EXISTS transcript_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (transcript_status IN ('pending', 'processing', 'ready', 'failed')),
ADD COLUMN IF NOT EXISTS transcript_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS transcript_next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcript_last_attempt_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transcript_last_error TEXT,
ADD COLUMN IF NOT EXISTS transcript_ready_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_daily_pep_talks_transcript_retry
ON public.daily_pep_talks(transcript_status, transcript_next_retry_at)
WHERE transcript_status IN ('pending', 'processing');

WITH ready_rows AS (
  SELECT dpt.id
  FROM public.daily_pep_talks AS dpt
  WHERE jsonb_typeof(dpt.transcript) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(dpt.transcript) AS word
      WHERE jsonb_typeof(word) = 'object'
        AND word ? 'word'
        AND word ? 'start'
        AND word ? 'end'
        AND jsonb_typeof(word->'word') = 'string'
        AND jsonb_typeof(word->'start') = 'number'
        AND jsonb_typeof(word->'end') = 'number'
    )
)
UPDATE public.daily_pep_talks AS dpt
SET
  transcript_status = 'ready',
  transcript_next_retry_at = NULL,
  transcript_last_error = NULL,
  transcript_ready_at = COALESCE(dpt.transcript_ready_at, now())
WHERE dpt.id IN (SELECT id FROM ready_rows);

UPDATE public.daily_pep_talks AS dpt
SET
  transcript_status = 'failed',
  transcript_next_retry_at = now(),
  transcript_last_error = COALESCE(dpt.transcript_last_error, 'Missing word-level transcript timestamps')
WHERE dpt.transcript_status <> 'ready';
