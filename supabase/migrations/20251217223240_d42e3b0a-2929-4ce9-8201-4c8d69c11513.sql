-- Epic rewards catalog table
CREATE TABLE public.epic_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('background', 'frame', 'effect', 'artifact')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  css_effect JSONB,
  image_url TEXT,
  story_type_slug TEXT REFERENCES public.epic_story_types(slug),
  drop_weight INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User's unlocked rewards table
CREATE TABLE public.user_epic_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.epic_rewards(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  is_equipped BOOLEAN DEFAULT false,
  UNIQUE(user_id, reward_id)
);

-- Enable RLS
ALTER TABLE public.epic_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_epic_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for epic_rewards (public read, admin write)
CREATE POLICY "Anyone can view epic rewards"
  ON public.epic_rewards FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage epic rewards"
  ON public.epic_rewards FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for user_epic_rewards
CREATE POLICY "Users can view own epic rewards"
  ON public.user_epic_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own epic rewards"
  ON public.user_epic_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own epic rewards"
  ON public.user_epic_rewards FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed data: Backgrounds
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Nebula Dreams', 'A dreamy purple and pink nebula background', 'background', 'common', 35, '{"gradient": "linear-gradient(135deg, hsl(280, 60%, 20%), hsl(320, 60%, 25%), hsl(260, 50%, 15%))", "animation": "nebula-shift"}'),
('Starfield Classic', 'Classic twinkling starfield background', 'background', 'common', 25, '{"gradient": "radial-gradient(circle at 50% 50%, hsl(240, 30%, 10%), hsl(240, 50%, 5%))", "particles": "stars"}'),
('Cosmic Ocean', 'Deep blue waves of cosmic energy', 'background', 'rare', 20, '{"gradient": "linear-gradient(180deg, hsl(210, 80%, 15%), hsl(220, 70%, 25%), hsl(200, 60%, 10%))", "animation": "wave"}'),
('Golden Galaxy', 'A shimmering golden particle field', 'background', 'rare', 15, '{"gradient": "radial-gradient(ellipse at center, hsl(45, 70%, 25%), hsl(35, 60%, 15%), hsl(25, 50%, 8%))", "particles": "gold"}'),
('Void Embrace', 'Dark void with subtle energy pulses', 'background', 'epic', 5, '{"gradient": "radial-gradient(circle at 50% 50%, hsl(270, 30%, 8%), hsl(0, 0%, 2%))", "animation": "pulse", "glow": "hsl(270, 50%, 30%)"}');

-- Seed data: Frames
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Bronze Constellation', 'A bronze frame with constellation patterns', 'frame', 'common', 15, '{"borderColor": "hsl(30, 50%, 40%)", "borderWidth": "3px", "borderStyle": "solid", "shimmer": false}'),
('Silver Stardust', 'A silver frame dusted with starlight', 'frame', 'rare', 10, '{"borderColor": "hsl(220, 20%, 70%)", "borderWidth": "4px", "borderStyle": "solid", "shimmer": true}'),
('Mythic Glow', 'A purple mythic frame with inner glow', 'frame', 'epic', 5, '{"borderColor": "hsl(280, 60%, 50%)", "borderWidth": "4px", "borderStyle": "double", "shimmer": true, "glowColor": "hsl(280, 60%, 40%)"}');

-- Seed data: Victory Effects
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Sparkle Trail', 'Leaves a trail of sparkles around your companion', 'effect', 'rare', 5, '{"effectType": "particles", "color": "hsl(50, 90%, 70%)", "intensity": "medium"}'),
('Cosmic Crown', 'A floating cosmic crown above your companion', 'effect', 'epic', 2.5, '{"effectType": "overlay", "image": "crown", "color": "hsl(45, 80%, 60%)", "position": "top"}'),
('Radiant Wings', 'Ethereal wings of light behind your companion', 'effect', 'legendary', 0.5, '{"effectType": "overlay", "image": "wings", "color": "hsl(200, 80%, 70%)", "animation": "flutter"}');

-- Seed data: Story-specific Artifacts
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect, story_type_slug) VALUES
('The Wanderers Map', 'An ancient map that guided you to treasure', 'artifact', 'legendary', 0.4, '{"icon": "🗺️", "glow": "hsl(45, 70%, 50%)"}', 'treasure_hunt'),
('Crystal of Truth', 'A crystal that reveals hidden truths', 'artifact', 'legendary', 0.4, '{"icon": "🔮", "glow": "hsl(280, 70%, 60%)"}', 'mystery'),
('Enlightenment Stone', 'A stone imbued with ancient wisdom', 'artifact', 'legendary', 0.4, '{"icon": "💎", "glow": "hsl(180, 60%, 50%)"}', 'pilgrimage'),
('Heros Medallion', 'A medallion earned through heroic deeds', 'artifact', 'legendary', 0.4, '{"icon": "🏅", "glow": "hsl(45, 80%, 55%)"}', 'heroes_journey'),
('Guardians Shield', 'A shield that protected those in need', 'artifact', 'legendary', 0.4, '{"icon": "🛡️", "glow": "hsl(210, 60%, 50%)"}', 'rescue_mission'),
('Compass of Infinity', 'A compass pointing to undiscovered realms', 'artifact', 'legendary', 0.4, '{"icon": "🧭", "glow": "hsl(30, 70%, 50%)"}', 'exploration');

-- Add indexes for performance
CREATE INDEX idx_epic_rewards_type ON public.epic_rewards(reward_type);
CREATE INDEX idx_epic_rewards_rarity ON public.epic_rewards(rarity);
CREATE INDEX idx_user_epic_rewards_user ON public.user_epic_rewards(user_id);
CREATE INDEX idx_user_epic_rewards_equipped ON public.user_epic_rewards(user_id, is_equipped) WHERE is_equipped = true;