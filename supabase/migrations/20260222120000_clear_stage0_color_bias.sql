-- Remove legacy stage-0 color locking that biases stage-1 hatch output toward monochrome.
-- Only applies to companions that have not hatched yet.
UPDATE public.user_companion
SET
  eye_color = CASE
    WHEN eye_color = ('glowing ' || favorite_color) THEN ''
    ELSE eye_color
  END,
  fur_color = CASE
    WHEN fur_color = favorite_color THEN ''
    ELSE fur_color
  END,
  updated_at = NOW()
WHERE current_stage = 0
  AND (
    eye_color = ('glowing ' || favorite_color)
    OR fur_color = favorite_color
  );
