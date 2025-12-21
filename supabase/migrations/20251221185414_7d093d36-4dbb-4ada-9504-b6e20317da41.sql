-- =============================================
-- FAIRY TALE GUILD ENHANCEMENTS - ALL PHASES
-- =============================================

-- =============================================
-- PHASE 1B: DAILY BLESSINGS SYSTEM
-- =============================================

-- Blessing types (seeded data)
CREATE TABLE public.guild_blessing_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT NOT NULL,
  effect_type TEXT NOT NULL, -- 'xp_boost', 'streak_shield', 'energy_restore', 'bond_boost'
  effect_value NUMERIC NOT NULL DEFAULT 1.1, -- multiplier or flat value
  effect_duration_hours INTEGER NOT NULL DEFAULT 24,
  rarity TEXT NOT NULL DEFAULT 'common', -- 'common', 'rare', 'legendary'
  theme_color TEXT NOT NULL DEFAULT '#FFD700',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Blessings sent between members
CREATE TABLE public.guild_blessings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blessing_type_id UUID NOT NULL REFERENCES public.guild_blessing_types(id) ON DELETE CASCADE,
  message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guild_blessings_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- Daily blessing charges (limits how many you can send)
CREATE TABLE public.guild_blessing_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charges_remaining INTEGER NOT NULL DEFAULT 3,
  max_charges INTEGER NOT NULL DEFAULT 3,
  last_refresh_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- =============================================
-- PHASE 2: GUILD BOSS BATTLES
-- =============================================

-- Boss encounters
CREATE TABLE public.guild_boss_encounters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  boss_name TEXT NOT NULL,
  boss_title TEXT, -- e.g., "The Procrastination Phantom"
  boss_lore TEXT,
  boss_image_url TEXT,
  boss_tier TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'elite', 'legendary'
  max_hp INTEGER NOT NULL DEFAULT 1000,
  current_hp INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'defeated', 'expired', 'fled'
  spawned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  defeated_at TIMESTAMP WITH TIME ZONE,
  xp_reward INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guild_boss_encounters_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- Damage log for boss battles
CREATE TABLE public.guild_boss_damage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id UUID NOT NULL REFERENCES public.guild_boss_encounters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  damage_amount INTEGER NOT NULL,
  damage_source TEXT NOT NULL, -- 'habit_completion', 'quest_completion', 'blessing', 'critical_hit'
  source_id TEXT, -- ID of the habit/quest that triggered the damage
  is_killing_blow BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- PHASE 3: TITLES & HALL OF LEGENDS
-- =============================================

-- Title definitions
CREATE TABLE public.guild_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  requirement_type TEXT NOT NULL, -- 'boss_kills', 'blessings_sent', 'streak_days', 'damage_dealt', 'rituals_attended'
  requirement_value INTEGER NOT NULL,
  theme_color TEXT NOT NULL DEFAULT '#FFD700',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Earned titles
CREATE TABLE public.guild_member_titles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.guild_titles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false, -- only one active at a time
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, title_id, community_id),
  UNIQUE(user_id, title_id, epic_id)
);

-- Hall of Legends (permanent achievements)
CREATE TABLE public.guild_legends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  legend_type TEXT NOT NULL, -- 'boss_defeated', 'milestone_reached', 'streak_record', 'first_blood', 'perfect_week'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  hero_ids UUID[] NOT NULL DEFAULT '{}', -- users involved
  metadata JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guild_legends_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- =============================================
-- PHASE 4: RITUALS & PROPHECY
-- =============================================

-- Guild rituals
CREATE TABLE public.guild_rituals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  ritual_type TEXT NOT NULL, -- 'morning_rally', 'evening_campfire', 'weekly_feast', 'battle_cry'
  name TEXT NOT NULL,
  description TEXT,
  scheduled_time TIME NOT NULL, -- daily time
  scheduled_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- days of week (0=Sunday)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guild_rituals_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- Ritual attendance
CREATE TABLE public.guild_ritual_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ritual_id UUID NOT NULL REFERENCES public.guild_rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ritual_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(ritual_id, user_id, ritual_date)
);

-- Prophecy board
CREATE TABLE public.guild_prophecies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  prophet_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prophecy_text TEXT NOT NULL,
  prophecy_type TEXT NOT NULL, -- 'streak_prediction', 'boss_slayer', 'blessing_giver', 'rise_to_top'
  target_value INTEGER, -- e.g., 7 for "will hit 7-day streak"
  is_fulfilled BOOLEAN NOT NULL DEFAULT false,
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guild_prophecies_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- =============================================
-- PHASE 5: ARTIFACTS & RAIDS
-- =============================================

-- Guild artifacts
CREATE TABLE public.guild_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  image_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'rare', -- 'rare', 'epic', 'legendary', 'mythic'
  artifact_type TEXT NOT NULL, -- 'banner', 'companion_skin', 'frame', 'aura', 'title_prefix'
  unlock_requirement_type TEXT NOT NULL, -- 'boss_kills', 'total_damage', 'members_count', 'streak_total'
  unlock_requirement_value INTEGER NOT NULL,
  css_effect JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unlocked artifacts per guild
CREATE TABLE public.guild_artifact_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artifact_id UUID NOT NULL REFERENCES public.guild_artifacts(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unlocked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(artifact_id, community_id),
  UNIQUE(artifact_id, epic_id),
  CONSTRAINT guild_artifact_unlocks_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- Raid seasons for inter-guild competition
CREATE TABLE public.guild_raid_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  rewards JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Raid scores per guild per season
CREATE TABLE public.guild_raid_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.guild_raid_seasons(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  epic_id UUID REFERENCES public.epics(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL DEFAULT 0,
  bosses_defeated INTEGER NOT NULL DEFAULT 0,
  total_damage_dealt BIGINT NOT NULL DEFAULT 0,
  members_active INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(season_id, community_id),
  UNIQUE(season_id, epic_id),
  CONSTRAINT guild_raid_scores_context_check CHECK (community_id IS NOT NULL OR epic_id IS NOT NULL)
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.guild_blessing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_blessings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_blessing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_boss_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_boss_damage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_member_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_legends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_ritual_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_prophecies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_artifact_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_raid_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_raid_scores ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Blessing types are public (seed data)
CREATE POLICY "Blessing types are viewable by all" ON public.guild_blessing_types
  FOR SELECT USING (true);

-- Blessings: members can view, senders can create
CREATE POLICY "Guild members can view blessings" ON public.guild_blessings
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_blessings.epic_id AND user_id = auth.uid()))
    OR sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

CREATE POLICY "Users can send blessings" ON public.guild_blessings
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Blessing charges: users manage their own
CREATE POLICY "Users can view own charges" ON public.guild_blessing_charges
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own charges" ON public.guild_blessing_charges
  FOR ALL USING (user_id = auth.uid());

-- Boss encounters: members can view
CREATE POLICY "Guild members can view boss encounters" ON public.guild_boss_encounters
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_boss_encounters.epic_id AND user_id = auth.uid()))
  );

CREATE POLICY "Service role can manage boss encounters" ON public.guild_boss_encounters
  FOR ALL USING (is_service_role());

-- Boss damage log: members can view, users can log damage
CREATE POLICY "Guild members can view damage log" ON public.guild_boss_damage_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guild_boss_encounters gbe
      WHERE gbe.id = encounter_id
      AND (
        (gbe.community_id IS NOT NULL AND is_community_member_safe(gbe.community_id, auth.uid()))
        OR (gbe.epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = gbe.epic_id AND user_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Users can log own damage" ON public.guild_boss_damage_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Titles: public read
CREATE POLICY "Titles are viewable by all" ON public.guild_titles
  FOR SELECT USING (true);

-- Member titles: members can view
CREATE POLICY "Anyone can view earned titles" ON public.guild_member_titles
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own titles" ON public.guild_member_titles
  FOR ALL USING (user_id = auth.uid());

-- Legends: members can view
CREATE POLICY "Guild members can view legends" ON public.guild_legends
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_legends.epic_id AND user_id = auth.uid()))
  );

CREATE POLICY "Service role can manage legends" ON public.guild_legends
  FOR ALL USING (is_service_role());

-- Rituals: members can view, admins can create
CREATE POLICY "Guild members can view rituals" ON public.guild_rituals
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_rituals.epic_id AND user_id = auth.uid()))
  );

CREATE POLICY "Guild admins can manage rituals" ON public.guild_rituals
  FOR ALL USING (
    created_by = auth.uid()
    OR (community_id IS NOT NULL AND is_community_admin(community_id, auth.uid()))
  );

-- Ritual attendance: users can manage own
CREATE POLICY "Users can view ritual attendance" ON public.guild_ritual_attendance
  FOR SELECT USING (true);

CREATE POLICY "Users can record own attendance" ON public.guild_ritual_attendance
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Prophecies: members can view and create
CREATE POLICY "Guild members can view prophecies" ON public.guild_prophecies
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_prophecies.epic_id AND user_id = auth.uid()))
  );

CREATE POLICY "Guild members can create prophecies" ON public.guild_prophecies
  FOR INSERT WITH CHECK (prophet_id = auth.uid());

-- Artifacts: public read
CREATE POLICY "Artifacts are viewable by all" ON public.guild_artifacts
  FOR SELECT USING (true);

-- Artifact unlocks: members can view
CREATE POLICY "Guild members can view unlocks" ON public.guild_artifact_unlocks
  FOR SELECT USING (
    (community_id IS NOT NULL AND is_community_member_safe(community_id, auth.uid()))
    OR (epic_id IS NOT NULL AND EXISTS (SELECT 1 FROM epic_members WHERE epic_id = guild_artifact_unlocks.epic_id AND user_id = auth.uid()))
  );

-- Raid seasons: public read
CREATE POLICY "Raid seasons are viewable by all" ON public.guild_raid_seasons
  FOR SELECT USING (true);

-- Raid scores: public read (leaderboard)
CREATE POLICY "Raid scores are viewable by all" ON public.guild_raid_scores
  FOR SELECT USING (true);

-- =============================================
-- SEED DATA: BLESSING TYPES
-- =============================================

INSERT INTO public.guild_blessing_types (name, icon, description, effect_type, effect_value, effect_duration_hours, rarity, theme_color) VALUES
  ('Fire Aura', '🔥', 'Ignite your ally with burning motivation! +15% XP for 24 hours.', 'xp_boost', 1.15, 24, 'common', '#FF6B35'),
  ('Shield of Persistence', '🛡️', 'Protect your ally''s streak from breaking once today.', 'streak_shield', 1, 24, 'rare', '#4ECDC4'),
  ('Lightning Surge', '⚡', 'Electrify your ally''s progress! Double damage to guild bosses.', 'boss_damage', 2.0, 12, 'rare', '#FFE66D'),
  ('Moonlight Restoration', '🌙', 'Restore your ally''s energy under the moon''s gentle glow.', 'energy_restore', 50, 1, 'common', '#A8DADC'),
  ('Phoenix Blessing', '🔮', 'Rise from the ashes! Revive a broken streak.', 'streak_revive', 1, 24, 'legendary', '#FF006E'),
  ('Starlight Bond', '✨', 'Strengthen the bond! +25% companion XP for 24 hours.', 'bond_boost', 1.25, 24, 'epic', '#FFD93D');

-- =============================================
-- SEED DATA: TITLES
-- =============================================

INSERT INTO public.guild_titles (name, description, icon, rarity, requirement_type, requirement_value, theme_color) VALUES
  ('Novice', 'Took the first step on the journey', '🌱', 'common', 'blessings_sent', 1, '#90BE6D'),
  ('Blessing Bearer', 'Shared 10 blessings with allies', '💫', 'common', 'blessings_sent', 10, '#FFD93D'),
  ('Guardian Angel', 'Sent 50 blessings to guildmates', '👼', 'rare', 'blessings_sent', 50, '#00B4D8'),
  ('Dragon Slayer', 'Dealt the killing blow to a guild boss', '🐉', 'epic', 'boss_kills', 1, '#FF6B35'),
  ('Boss Hunter', 'Defeated 5 guild bosses', '⚔️', 'rare', 'boss_kills', 5, '#E63946'),
  ('Legend Killer', 'Vanquished 25 guild bosses', '💀', 'legendary', 'boss_kills', 25, '#9B5DE5'),
  ('Steadfast', 'Maintained a 7-day streak', '🔥', 'common', 'streak_days', 7, '#FF6B35'),
  ('Unbreakable', 'Maintained a 30-day streak', '💎', 'rare', 'streak_days', 30, '#4ECDC4'),
  ('Immortal', 'Maintained a 100-day streak', '👑', 'legendary', 'streak_days', 100, '#FFD700'),
  ('Devoted', 'Attended 10 guild rituals', '🙏', 'common', 'rituals_attended', 10, '#A8DADC'),
  ('High Priest', 'Attended 50 guild rituals', '⛪', 'epic', 'rituals_attended', 50, '#9B5DE5'),
  ('Damage Dealer', 'Dealt 1000 total damage to bosses', '💥', 'common', 'damage_dealt', 1000, '#FF006E'),
  ('Berserker', 'Dealt 10000 total damage to bosses', '🔨', 'epic', 'damage_dealt', 10000, '#E63946');

-- =============================================
-- SEED DATA: ARTIFACTS
-- =============================================

INSERT INTO public.guild_artifacts (name, description, icon, rarity, artifact_type, unlock_requirement_type, unlock_requirement_value, css_effect) VALUES
  ('Banner of the Dawn', 'A radiant banner showing your guild''s first light', '🏳️', 'rare', 'banner', 'boss_kills', 1, '{"glow": "0 0 20px rgba(255, 215, 0, 0.5)"}'),
  ('Dragon''s Mantle', 'A legendary cloak woven from dragon scales', '🐲', 'legendary', 'companion_skin', 'boss_kills', 10, '{"filter": "hue-rotate(30deg)", "animation": "pulse 2s infinite"}'),
  ('Crown of Unity', 'Awarded to guilds with 10+ active members', '👑', 'epic', 'frame', 'members_count', 10, '{"border": "3px solid gold"}'),
  ('Phoenix Aura', 'An ethereal glow earned through collective perseverance', '🔥', 'mythic', 'aura', 'streak_total', 100, '{"boxShadow": "0 0 30px rgba(255, 107, 53, 0.6)"}'),
  ('Titan''s Hammer', 'Forged from the might of 50000 damage dealt', '🔨', 'legendary', 'title_prefix', 'total_damage', 50000, '{}');

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_blessings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_boss_encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_boss_damage_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_legends;