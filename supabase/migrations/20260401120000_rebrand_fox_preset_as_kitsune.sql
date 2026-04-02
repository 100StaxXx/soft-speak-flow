-- Rebrand the launch fox preset as Kitsune while preserving the existing preset/storage slug.

UPDATE public.companion_presets
SET
  display_name = 'Kitsune',
  role = 'mystic trickster',
  signature_identity = 'fox spirit silhouette, oversized ears, luminous cheek markings, and a flowing tail fan',
  anatomy_lock = '4 legs; fox silhouette with magical tails',
  reveal_copy = 'Mystical, clever, and lit by fox-fire.',
  updated_at = now()
WHERE id = 'fox';

UPDATE public.user_companion
SET spirit_animal = 'Kitsune'
WHERE preset_id = 'fox'
  AND lower(trim(coalesce(spirit_animal, ''))) = 'fox';

UPDATE public.user_companion
SET cached_creature_name = 'Kitsune'
WHERE preset_id = 'fox'
  AND lower(trim(coalesce(cached_creature_name, ''))) = 'fox';
