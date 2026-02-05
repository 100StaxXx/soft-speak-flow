-- Seed creativity from average of legacy power + connection, scaled to 1000
UPDATE public.user_companion
SET creativity = LEAST(1000, GREATEST(100,
  ROUND(((COALESCE(power, 30) + COALESCE(connection, 30)) / 2) * 10)::INTEGER
))
WHERE (creativity IS NULL OR creativity = 0 OR creativity = 300)
  AND (power IS NOT NULL OR connection IS NOT NULL);

-- Fallback for rows with no legacy values
UPDATE public.user_companion
SET creativity = 300
WHERE creativity IS NULL OR creativity = 0;