-- Remove "AI" from Lyra's best-for copy in already-seeded mentor rows.

UPDATE public.mentors
SET target_user = 'Builders, overthinkers, and strategists who want a brilliant feminine voice that makes complexity feel legible.'
WHERE slug = 'lyra';
