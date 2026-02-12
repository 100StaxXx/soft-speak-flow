-- Clean stale onboarding mentor references for users affected by removed mentors.
-- 1) Remove onboarding_data.mentorId when it points to a missing mentor or no mentor is selected.
UPDATE public.profiles AS p
SET onboarding_data = COALESCE(p.onboarding_data, '{}'::jsonb) - 'mentorId',
    updated_at = NOW()
WHERE COALESCE(p.onboarding_data, '{}'::jsonb) ? 'mentorId'
  AND (
    p.selected_mentor_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.mentors AS m
      WHERE m.id::text = p.onboarding_data->>'mentorId'
    )
  );

-- 2) Keep onboarding_data.mentorId in sync with selected_mentor_id for active users.
UPDATE public.profiles AS p
SET onboarding_data = jsonb_set(
      COALESCE(p.onboarding_data, '{}'::jsonb),
      '{mentorId}',
      to_jsonb(p.selected_mentor_id::text),
      true
    ),
    updated_at = NOW()
WHERE p.selected_mentor_id IS NOT NULL
  AND (
    NOT (COALESCE(p.onboarding_data, '{}'::jsonb) ? 'mentorId')
    OR (p.onboarding_data->>'mentorId') IS DISTINCT FROM p.selected_mentor_id::text
  );
