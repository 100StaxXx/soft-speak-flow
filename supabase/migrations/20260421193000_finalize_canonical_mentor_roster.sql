-- Finalize the canonical active mentor roster after the Final 6 rebrand + Lyra activation.
-- This migration keeps the settings dropdown DB-driven by ensuring only the intended
-- active mentors remain selectable.

-- Preview-only mentors should never appear in active mentor queries.
UPDATE public.mentors
SET is_active = false
WHERE slug = 'the-guy';

UPDATE public.mentors
SET is_active = true
WHERE slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival');
