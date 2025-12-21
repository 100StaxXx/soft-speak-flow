-- Add adversary_theme column to epic_rewards for theme-specific loot
ALTER TABLE public.epic_rewards ADD COLUMN IF NOT EXISTS adversary_theme text;

-- Insert theme-specific loot rewards (2 per theme: rare at 10 defeats, epic/legendary at 25 defeats)
-- Distraction theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Focused Mind Frame', 'A crystalline frame that blocks out mental noise', 'frame', 'rare', 100, 'distraction', '{"borderColor": "#60A5FA", "borderWidth": "3px", "shimmer": true, "cornerStyle": "circuit"}'),
('Laser Focus Aura', 'Particles of pure concentration orbit your companion', 'effect', 'epic', 50, 'distraction', '{"particleEffect": "stars", "color": "#3B82F6", "intensity": "medium"}');

-- Stagnation theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Flow State Frame', 'Ever-moving energy channels that never stop', 'frame', 'rare', 100, 'stagnation', '{"borderColor": "#34D399", "borderWidth": "3px", "glowAnimation": "shift", "cornerStyle": "lotus"}'),
('Momentum Trail', 'Flowing waves of kinetic energy follow your path', 'effect', 'epic', 50, 'stagnation', '{"particleEffect": "embers", "color": "#10B981", "intensity": "intense"}');

-- Anxiety theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Calm Waters Frame', 'Tranquil ripples that soothe the soul', 'frame', 'rare', 100, 'anxiety', '{"borderColor": "#818CF8", "borderWidth": "3px", "glowAnimation": "breathe", "cornerStyle": "wisp"}'),
('Serenity Glow', 'A peaceful aura that radiates inner calm', 'effect', 'epic', 50, 'anxiety', '{"glow": "0 0 30px rgba(129, 140, 248, 0.5)", "glowIntensity": "subtle", "glowAnimation": "breathe"}');

-- Doubt theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Conviction Frame', 'Bold lines that represent unwavering belief', 'frame', 'rare', 100, 'doubt', '{"borderColor": "#F59E0B", "borderWidth": "4px", "borderStyle": "double", "cornerStyle": "shield"}'),
('Self-Belief Radiance', 'Golden light emanating from inner strength', 'effect', 'epic', 50, 'doubt', '{"particleEffect": "divine", "color": "#FBBF24", "intensity": "medium"}');

-- Chaos theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Order From Chaos Frame', 'Geometric perfection born from disorder', 'frame', 'rare', 100, 'chaos', '{"borderColor": "#EC4899", "borderWidth": "3px", "shimmer": true, "cornerStyle": "crystal"}'),
('Harmony Particles', 'Once-chaotic energy now perfectly synchronized', 'effect', 'legendary', 30, 'chaos', '{"particleEffect": "dimensional", "color": "#DB2777", "intensity": "intense"}');

-- Laziness theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Eternal Flame Frame', 'Fire that burns forever with motivation', 'frame', 'rare', 100, 'laziness', '{"borderColor": "#EF4444", "borderWidth": "3px", "glowColor": "#F87171", "glowAnimation": "flicker", "cornerStyle": "flame"}'),
('Inner Fire Effect', 'Embers of unstoppable drive surround you', 'effect', 'epic', 50, 'laziness', '{"particleEffect": "embers", "color": "#EF4444", "intensity": "intense"}');

-- Overthinking theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Clear Mind Frame', 'A pristine frame representing mental clarity', 'frame', 'rare', 100, 'overthinking', '{"borderColor": "#A78BFA", "borderWidth": "2px", "glowAnimation": "static", "cornerStyle": "ornate"}'),
('Thought Liberation', 'Released thoughts float away as ethereal wisps', 'effect', 'epic', 50, 'overthinking', '{"particleEffect": "void", "color": "#8B5CF6", "intensity": "subtle"}');

-- Fear theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Fearless Guardian Frame', 'An imposing frame of courage and strength', 'frame', 'rare', 100, 'fear', '{"borderColor": "#14B8A6", "borderWidth": "4px", "borderStyle": "ridge", "cornerStyle": "heroic"}'),
('Courage Aura', 'A protective shield of bravery', 'effect', 'legendary', 30, 'fear', '{"particleEffect": "divine", "color": "#2DD4BF", "intensity": "intense"}');

-- Confusion theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Pathfinder Frame', 'Guiding lines that always show the way', 'frame', 'rare', 100, 'confusion', '{"borderColor": "#06B6D4", "borderWidth": "3px", "shimmer": true, "cornerStyle": "compass"}'),
('Guiding Light Effect', 'Illuminating particles that reveal truth', 'effect', 'epic', 50, 'confusion', '{"particleEffect": "stars", "color": "#22D3EE", "intensity": "medium"}');

-- Vulnerability theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Diamond Shell Frame', 'Unbreakable beauty forged through trials', 'frame', 'rare', 100, 'vulnerability', '{"borderColor": "#F472B6", "borderWidth": "3px", "glowAnimation": "pulse", "cornerStyle": "scale"}'),
('Resilience Shield', 'Crystalline fragments of inner strength', 'effect', 'epic', 50, 'vulnerability', '{"particleEffect": "ice", "color": "#EC4899", "intensity": "medium"}');

-- Imbalance theme loot
INSERT INTO public.epic_rewards (name, description, reward_type, rarity, drop_weight, adversary_theme, css_effect) VALUES
('Perfect Balance Frame', 'Yin and yang in eternal harmony', 'frame', 'rare', 100, 'imbalance', '{"gradientBorder": "linear-gradient(45deg, #1F2937, #F3F4F6)", "animatedGradient": true, "cornerStyle": "rift"}'),
('Equilibrium Effect', 'Opposing forces dancing in perfect sync', 'effect', 'legendary', 30, 'imbalance', '{"particleEffect": "dimensional", "color": "#6B7280", "intensity": "intense"}');