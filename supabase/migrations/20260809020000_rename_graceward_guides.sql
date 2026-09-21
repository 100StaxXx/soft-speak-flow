-- Rename the seven active fictional Christian Guides without changing their
-- stable ids, slugs, voice ids, images, or user selections.

UPDATE public.mentors SET name = 'Micah' WHERE slug = 'sage';
UPDATE public.mentors SET name = 'Clara' WHERE slug = 'lyra';
UPDATE public.mentors SET name = 'Lydia' WHERE slug = 'icon';
UPDATE public.mentors SET name = 'Jude' WHERE slug = 'charles';
UPDATE public.mentors SET name = 'Grace' WHERE slug = 'princess';
UPDATE public.mentors SET name = 'Ezra' WHERE slug = 'operator';
UPDATE public.mentors SET name = 'Caleb' WHERE slug = 'rival';
