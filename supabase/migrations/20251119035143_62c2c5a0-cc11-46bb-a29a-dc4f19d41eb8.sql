-- Create companion evolution cards table
CREATE TABLE companion_evolution_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES user_companion(id) ON DELETE CASCADE,
  evolution_id uuid NOT NULL REFERENCES companion_evolutions(id) ON DELETE CASCADE,
  evolution_stage integer NOT NULL,
  
  -- Creature Identity
  creature_name text NOT NULL,
  species text NOT NULL,
  element text NOT NULL,
  
  -- Stats (strength, agility, vitality, intellect, spirit, affinity)
  stats jsonb NOT NULL DEFAULT '{"strength": 0, "agility": 0, "vitality": 0, "intellect": 0, "spirit": 0, "affinity": 0}'::jsonb,
  
  -- Abilities & Story
  traits text[] DEFAULT '{}',
  story_text text NOT NULL,
  lore_seed text NOT NULL,
  
  -- Progression
  bond_level integer DEFAULT 1 CHECK (bond_level >= 1 AND bond_level <= 100),
  rarity text NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Celestial', 'Primal', 'Origin')),
  frame_type text NOT NULL,
  
  -- Metadata
  image_url text,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE companion_evolution_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own cards"
  ON companion_evolution_cards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON companion_evolution_cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON companion_evolution_cards
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_cards_user ON companion_evolution_cards(user_id);
CREATE INDEX idx_cards_companion ON companion_evolution_cards(companion_id);
CREATE INDEX idx_cards_stage ON companion_evolution_cards(evolution_stage);
CREATE INDEX idx_cards_rarity ON companion_evolution_cards(rarity);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE companion_evolution_cards;