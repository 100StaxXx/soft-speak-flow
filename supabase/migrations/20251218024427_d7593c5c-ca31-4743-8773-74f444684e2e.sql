-- Add new SMITE-inspired frames with enhanced CSS effects

-- Common Tier Frames (15% drop weight)
INSERT INTO epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Starweaver Border', 'Delicate cosmic threads woven into an ethereal frame', 'frame', 'common', 15, 
  '{"borderColor": "hsl(270, 50%, 50%)", "borderWidth": "3px", "borderStyle": "solid", "cornerStyle": "thread", "shimmer": false}'::jsonb),
('Nebula Wisp', 'A frame wreathed in purple mist from distant nebulae', 'frame', 'common', 15,
  '{"borderColor": "hsl(280, 40%, 45%)", "borderWidth": "3px", "borderStyle": "solid", "cornerStyle": "wisp", "glowColor": "hsl(280, 50%, 40%)", "glowAnimation": "breathe"}'::jsonb);

-- Rare Tier Frames (10% drop weight)
INSERT INTO epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Celestial Circuit', 'Glowing blue circuit patterns channel cosmic energy', 'frame', 'rare', 10,
  '{"borderColor": "hsl(210, 80%, 55%)", "borderWidth": "4px", "borderStyle": "double", "cornerStyle": "circuit", "glowColor": "hsl(210, 80%, 50%)", "glowAnimation": "pulse", "shimmer": true}'::jsonb),
('Aurora Frame', 'Shifting colors of the northern lights dance across this frame', 'frame', 'rare', 10,
  '{"borderColor": "hsl(180, 70%, 50%)", "borderWidth": "4px", "borderStyle": "solid", "cornerStyle": "aurora", "gradientBorder": "linear-gradient(45deg, hsl(180, 70%, 50%), hsl(280, 70%, 60%), hsl(120, 70%, 50%))", "animatedGradient": true, "shimmer": true}'::jsonb),
('Frost Crystal', 'Crystalline ice formations frame your companion', 'frame', 'rare', 10,
  '{"borderColor": "hsl(200, 80%, 70%)", "borderWidth": "4px", "borderStyle": "solid", "cornerStyle": "crystal", "glowColor": "hsl(200, 90%, 80%)", "particleEffect": "ice", "shimmer": true}'::jsonb);

-- Epic Tier Frames (5% drop weight)
INSERT INTO epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Dragon Scale', 'Scaled texture with golden highlights worthy of ancient dragons', 'frame', 'epic', 5,
  '{"borderColor": "hsl(45, 90%, 50%)", "borderWidth": "5px", "borderStyle": "ridge", "cornerStyle": "scale", "glowColor": "hsl(45, 100%, 55%)", "glowAnimation": "pulse", "shimmer": true}'::jsonb),
('Void Rift', 'Dark energy cracks reveal glimpses of cosmic power', 'frame', 'epic', 5,
  '{"borderColor": "hsl(280, 50%, 20%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "rift", "glowColor": "hsl(280, 80%, 60%)", "glowAnimation": "flicker", "particleEffect": "void", "shimmer": true}'::jsonb),
('Phoenix Ember', 'Fiery orange with ember particles rising eternally', 'frame', 'epic', 5,
  '{"borderColor": "hsl(25, 100%, 50%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "flame", "glowColor": "hsl(20, 100%, 55%)", "glowAnimation": "flicker", "particleEffect": "embers", "shimmer": true}'::jsonb);

-- Legendary Tier Frames (2% drop weight) - NEW TIER
INSERT INTO epic_rewards (name, description, reward_type, rarity, drop_weight, css_effect) VALUES
('Cosmic Ascendant', 'An animated golden border with star particles cascading at each corner', 'frame', 'legendary', 2,
  '{"borderColor": "hsl(45, 100%, 60%)", "borderWidth": "6px", "borderStyle": "double", "cornerStyle": "ornate", "glowColor": "hsl(45, 100%, 65%)", "glowAnimation": "breathe", "particleEffect": "stars", "gradientBorder": "linear-gradient(45deg, hsl(45, 100%, 55%), hsl(35, 100%, 65%), hsl(55, 100%, 60%))", "animatedGradient": true, "shimmer": true}'::jsonb),
('Primal Deity', 'Ornate mythological patterns pulse with divine power', 'frame', 'legendary', 2,
  '{"borderColor": "hsl(270, 70%, 55%)", "borderWidth": "6px", "borderStyle": "groove", "cornerStyle": "deity", "glowColor": "hsl(280, 80%, 60%)", "glowAnimation": "pulse", "particleEffect": "divine", "shimmer": true}'::jsonb),
('Dimensional Tear', 'A multicolor shifting border that pulses between realities', 'frame', 'legendary', 2,
  '{"borderColor": "hsl(300, 80%, 55%)", "borderWidth": "6px", "borderStyle": "solid", "cornerStyle": "dimensional", "glowColor": "hsl(180, 80%, 60%)", "glowAnimation": "shift", "gradientBorder": "linear-gradient(90deg, hsl(300, 80%, 55%), hsl(180, 80%, 55%), hsl(60, 80%, 55%), hsl(300, 80%, 55%))", "animatedGradient": true, "particleEffect": "dimensional", "shimmer": true}'::jsonb);

-- Story-Type Specific Frames (exclusive drops)
INSERT INTO epic_rewards (name, description, reward_type, rarity, drop_weight, story_type_slug, css_effect) VALUES
('Fortune Seeker Frame', 'Golden frame adorned with treasure motifs', 'frame', 'epic', 8, 'treasure_hunt',
  '{"borderColor": "hsl(45, 100%, 55%)", "borderWidth": "5px", "borderStyle": "double", "cornerStyle": "treasure", "glowColor": "hsl(45, 100%, 60%)", "glowAnimation": "pulse", "shimmer": true}'::jsonb),
('Shadow Detective Frame', 'Dark frame with magnifying glass corners', 'frame', 'epic', 8, 'mystery',
  '{"borderColor": "hsl(260, 30%, 30%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "mystery", "glowColor": "hsl(260, 50%, 50%)", "glowAnimation": "flicker", "shimmer": true}'::jsonb),
('Sacred Pilgrim Frame', 'Serene frame with lotus and prayer motifs', 'frame', 'epic', 8, 'pilgrimage',
  '{"borderColor": "hsl(180, 60%, 50%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "lotus", "glowColor": "hsl(180, 70%, 55%)", "glowAnimation": "breathe", "shimmer": true}'::jsonb),
('Hero''s Mantle Frame', 'Heroic frame with sword and shield corners', 'frame', 'epic', 8, 'heroes_journey',
  '{"borderColor": "hsl(0, 70%, 50%)", "borderWidth": "5px", "borderStyle": "ridge", "cornerStyle": "heroic", "glowColor": "hsl(0, 80%, 55%)", "glowAnimation": "pulse", "shimmer": true}'::jsonb),
('Guardian''s Shield Frame', 'Protective frame with shield emblems', 'frame', 'epic', 8, 'rescue_mission',
  '{"borderColor": "hsl(210, 60%, 50%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "shield", "glowColor": "hsl(210, 70%, 55%)", "glowAnimation": "pulse", "shimmer": true}'::jsonb),
('Star Mapper Frame', 'Exploration frame with compass and star motifs', 'frame', 'epic', 8, 'exploration',
  '{"borderColor": "hsl(230, 60%, 55%)", "borderWidth": "5px", "borderStyle": "solid", "cornerStyle": "compass", "glowColor": "hsl(230, 70%, 60%)", "glowAnimation": "breathe", "shimmer": true}'::jsonb);