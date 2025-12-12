-- Phase 1: Add referral fields to profiles table
ALTER TABLE profiles
ADD COLUMN referral_code TEXT UNIQUE,
ADD COLUMN referred_by UUID REFERENCES profiles(id),
ADD COLUMN referral_count INTEGER DEFAULT 0;

-- Phase 2: Create companion_skins master table
CREATE TABLE companion_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  skin_type TEXT NOT NULL, -- aura, frame, accessory, overlay
  unlock_type TEXT NOT NULL, -- referral, achievement, purchase
  unlock_requirement INTEGER, -- 1, 3, or 5 for referrals
  css_effect JSONB NOT NULL, -- glow colors, animations, overlays
  image_url TEXT,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for companion_skins
ALTER TABLE companion_skins ENABLE ROW LEVEL SECURITY;

-- Anyone can view skins
CREATE POLICY "Anyone can view companion skins"
ON companion_skins FOR SELECT
USING (true);

-- Admins can manage skins
CREATE POLICY "Admins can manage companion skins"
ON companion_skins FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Phase 3: Create user_companion_skins table for unlocked skins
CREATE TABLE user_companion_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skin_id UUID NOT NULL REFERENCES companion_skins(id) ON DELETE CASCADE,
  is_equipped BOOLEAN DEFAULT false,
  acquired_via TEXT, -- referral_milestone, achievement, purchase
  acquired_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, skin_id)
);

-- Enable RLS for user_companion_skins
ALTER TABLE user_companion_skins ENABLE ROW LEVEL SECURITY;

-- Users can view their own skins
CREATE POLICY "Users can view own skins"
ON user_companion_skins FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own skins
CREATE POLICY "Users can insert own skins"
ON user_companion_skins FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own skins
CREATE POLICY "Users can update own skins"
ON user_companion_skins FOR UPDATE
USING (auth.uid() = user_id);

-- Phase 4: Auto-generate referral codes for new users
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate REF- followed by 8 random alphanumeric characters
    code := 'REF-' || upper(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-generate referral code on profile creation
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_referral_code_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();

-- Backfill existing users with referral codes
UPDATE profiles
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Phase 5: Seed the 3 referral milestone skins
INSERT INTO companion_skins (name, description, skin_type, unlock_type, unlock_requirement, css_effect, rarity) VALUES
(
  'Cosmic Aura',
  'A shimmering aura of cosmic energy surrounds your companion',
  'aura',
  'referral',
  1,
  '{"glowColor": "hsl(var(--primary))", "glowIntensity": "0.6", "animation": "pulse"}'::jsonb,
  'rare'
),
(
  'Golden Frame',
  'A radiant golden frame highlighting your companion''s achievements',
  'frame',
  'referral',
  3,
  '{"borderColor": "hsl(45, 100%, 60%)", "borderWidth": "3px", "shimmer": true}'::jsonb,
  'epic'
),
(
  'Celestial Wings',
  'Majestic ethereal wings symbolizing your community impact',
  'overlay',
  'referral',
  5,
  '{"overlayImage": "celestial-wings", "opacity": "0.8", "animation": "float"}'::jsonb,
  'legendary'
);