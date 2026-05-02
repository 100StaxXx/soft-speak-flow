-- Add opt-in account preference for higher-contrast quest and ritual cards
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS readable_quest_cards_enabled BOOLEAN DEFAULT false;
