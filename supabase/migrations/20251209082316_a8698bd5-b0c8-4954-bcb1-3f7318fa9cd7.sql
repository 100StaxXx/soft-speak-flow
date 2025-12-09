
-- Astral Encounters table - tracks each encounter
CREATE TABLE public.astral_encounters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  adversary_name TEXT NOT NULL,
  adversary_theme TEXT NOT NULL,
  adversary_tier TEXT NOT NULL DEFAULT 'common',
  adversary_lore TEXT,
  mini_game_type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_source_id UUID,
  result TEXT,
  accuracy_score INTEGER,
  xp_earned INTEGER DEFAULT 0,
  essence_earned TEXT,
  stat_boost_type TEXT,
  stat_boost_amount INTEGER DEFAULT 0,
  phases_completed INTEGER DEFAULT 0,
  total_phases INTEGER DEFAULT 1,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_available_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adversary Essences - permanent buffs collected
CREATE TABLE public.adversary_essences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.astral_encounters(id) ON DELETE CASCADE,
  essence_name TEXT NOT NULL,
  essence_description TEXT,
  stat_type TEXT NOT NULL,
  stat_boost INTEGER NOT NULL DEFAULT 0,
  adversary_name TEXT NOT NULL,
  adversary_theme TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',
  absorbed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cosmic Codex Entries - bestiary/lore collection
CREATE TABLE public.cosmic_codex_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  adversary_theme TEXT NOT NULL,
  adversary_name TEXT NOT NULL,
  adversary_lore TEXT,
  times_defeated INTEGER NOT NULL DEFAULT 1,
  first_defeated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_defeated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, adversary_theme)
);

-- Add encounter tracking to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_quests_completed INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_encounter_quest_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_weekly_encounter TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.astral_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adversary_essences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmic_codex_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for astral_encounters
CREATE POLICY "Users can view own encounters" ON public.astral_encounters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own encounters" ON public.astral_encounters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own encounters" ON public.astral_encounters
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for adversary_essences
CREATE POLICY "Users can view own essences" ON public.adversary_essences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own essences" ON public.adversary_essences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for cosmic_codex_entries
CREATE POLICY "Users can view own codex" ON public.cosmic_codex_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own codex entries" ON public.cosmic_codex_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own codex entries" ON public.cosmic_codex_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_astral_encounters_user_id ON public.astral_encounters(user_id);
CREATE INDEX idx_astral_encounters_trigger ON public.astral_encounters(trigger_type, trigger_source_id);
CREATE INDEX idx_adversary_essences_user_id ON public.adversary_essences(user_id);
CREATE INDEX idx_cosmic_codex_user_id ON public.cosmic_codex_entries(user_id);
