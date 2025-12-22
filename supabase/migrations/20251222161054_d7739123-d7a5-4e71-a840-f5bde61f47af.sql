-- Card Moves table (designed for Option 3 expansion)
CREATE TABLE public.card_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  element TEXT NOT NULL CHECK (element IN ('body', 'mind', 'soul')),
  base_power INTEGER NOT NULL DEFAULT 20,
  accuracy INTEGER NOT NULL DEFAULT 100,
  move_type TEXT NOT NULL DEFAULT 'attack' CHECK (move_type IN ('attack', 'defend', 'buff', 'debuff', 'heal')),
  status_effect TEXT,
  status_chance INTEGER DEFAULT 0,
  energy_cost INTEGER NOT NULL DEFAULT 1,
  cooldown_turns INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Card to Moves mapping (each card can have 1-4 moves)
CREATE TABLE public.card_move_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.companion_evolution_cards(id) ON DELETE CASCADE,
  move_id UUID NOT NULL REFERENCES public.card_moves(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL DEFAULT 1 CHECK (slot_number >= 1 AND slot_number <= 4),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(card_id, slot_number)
);

-- Battle history for rewards/stats tracking
CREATE TABLE public.battle_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_type TEXT NOT NULL CHECK (opponent_type IN ('ai', 'pvp')),
  opponent_id UUID,
  result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'draw', 'forfeit')),
  cards_used UUID[] NOT NULL,
  turns_taken INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  damage_received INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  rewards_claimed JSONB DEFAULT '{}',
  battle_log JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.card_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_move_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_history ENABLE ROW LEVEL SECURITY;

-- Card moves are readable by everyone (game data)
CREATE POLICY "Card moves are viewable by everyone" 
ON public.card_moves FOR SELECT USING (true);

-- Card move assignments - users can view their own (fixed type cast)
CREATE POLICY "Users can view their own card move assignments" 
ON public.card_move_assignments FOR SELECT 
USING (
  card_id IN (
    SELECT id FROM public.companion_evolution_cards WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own card move assignments" 
ON public.card_move_assignments FOR INSERT 
WITH CHECK (
  card_id IN (
    SELECT id FROM public.companion_evolution_cards WHERE user_id = auth.uid()
  )
);

-- Battle history - users can only see their own
CREATE POLICY "Users can view their own battle history" 
ON public.battle_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own battle history" 
ON public.battle_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own battle history" 
ON public.battle_history FOR UPDATE USING (auth.uid() = user_id);

-- Seed starter moves
INSERT INTO public.card_moves (name, description, element, base_power, move_type) VALUES
('Power Strike', 'A forceful physical attack', 'body', 25, 'attack'),
('Iron Guard', 'Brace for impact, reducing damage', 'body', 0, 'defend'),
('Adrenaline Rush', 'Boost your attack power', 'body', 0, 'buff'),
('Psychic Pulse', 'A focused mental assault', 'mind', 25, 'attack'),
('Mental Barrier', 'Create a shield of concentration', 'mind', 0, 'defend'),
('Strategic Focus', 'Enhance accuracy and critical chance', 'mind', 0, 'buff'),
('Spirit Blast', 'Channel spiritual energy', 'soul', 25, 'attack'),
('Soul Shield', 'Protect with inner light', 'soul', 0, 'defend'),
('Inner Peace', 'Restore health through meditation', 'soul', 15, 'heal');

-- Create indexes
CREATE INDEX idx_card_move_assignments_card ON public.card_move_assignments(card_id);
CREATE INDEX idx_battle_history_user ON public.battle_history(user_id);
CREATE INDEX idx_battle_history_completed ON public.battle_history(completed_at DESC);