-- Create battle matches table (3-player games)
CREATE TABLE IF NOT EXISTS public.battle_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, in_progress, completed
  winner_user_id UUID REFERENCES profiles(id),
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create battle participants table (3 players per match)
CREATE TABLE IF NOT EXISTS public.battle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES battle_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  placement INTEGER, -- 1st, 2nd, 3rd place
  xp_earned INTEGER DEFAULT 0,
  cards_used UUID[] NOT NULL, -- Array of evolution card IDs
  energy INTEGER DEFAULT 2,
  eliminated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Create battle rounds table (tracks each turn)
CREATE TABLE IF NOT EXISTS public.battle_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES battle_matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  player_actions JSONB NOT NULL, -- {user_id: {card_played, target_user_id, damage_dealt, etc}}
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, round_number)
);

-- Create battle rankings table (persistent leaderboard)
CREATE TABLE IF NOT EXISTS public.battle_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  second_place INTEGER DEFAULT 0,
  third_place INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  rank_points INTEGER DEFAULT 1000, -- ELO-style ranking
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view matches they're in"
  ON public.battle_matches FOR SELECT
  USING (
    id IN (
      SELECT match_id FROM battle_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own participation"
  ON public.battle_participants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view rounds for their matches"
  ON public.battle_rounds FOR SELECT
  USING (
    match_id IN (
      SELECT match_id FROM battle_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view rankings"
  ON public.battle_rankings FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own ranking"
  ON public.battle_rankings FOR SELECT
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_battle_matches_status ON battle_matches(status);
CREATE INDEX IF NOT EXISTS idx_battle_participants_user ON battle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_match ON battle_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_battle_rankings_points ON battle_rankings(rank_points DESC);

-- Enable realtime for battle updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rounds;