-- Epic Story Types (the 6 adventure types)
CREATE TABLE public.epic_story_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  base_chapters INTEGER NOT NULL DEFAULT 5,
  boss_name_template TEXT NOT NULL,
  boss_theme TEXT NOT NULL,
  boss_lore_template TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 6 story types
INSERT INTO public.epic_story_types (slug, name, description, base_chapters, boss_name_template, boss_theme, boss_lore_template, icon) VALUES
('treasure_hunt', 'Treasure Hunt', 'Seek a legendary cosmic artifact across dangerous territories', 5, 'The Eternal Guardian of {{treasure}}', 'stagnation', 'An ancient sentinel that has guarded the treasure since time began, testing all who seek its power.', '💎'),
('mystery', 'Cosmic Mystery', 'Unravel a supernatural enigma that threatens the balance of stars', 5, 'The Architect of Shadows', 'confusion', 'A mastermind who weaves deception across dimensions, their true form hidden behind layers of illusion.', '🔮'),
('pilgrimage', 'Inner Pilgrimage', 'Journey to a sacred cosmic site to discover your true purpose', 4, 'The Inner Demon', 'doubt', 'A manifestation of your deepest fears and insecurities, the final barrier to enlightenment.', '🧘'),
('heroes_journey', 'Hero''s Journey', 'Answer the call to adventure and transform into a legendary hero', 6, 'The Shadow Self', 'fear', 'Your darkest reflection, embodying everything you fear becoming, the ultimate test of character.', '⚔️'),
('rescue_mission', 'Rescue Mission', 'Save something precious that has been lost to the cosmic void', 4, 'The Void Captor', 'chaos', 'A being of pure entropy that feeds on hope and imprisons light within endless darkness.', '🛡️'),
('exploration', 'Cosmic Exploration', 'Chart unknown territories and discover wonders beyond imagination', 5, 'The Void Sentinel', 'anxiety', 'The guardian of the unknown, representing the fear of what lies beyond the edge of maps.', '🌌');

-- Enable RLS
ALTER TABLE public.epic_story_types ENABLE ROW LEVEL SECURITY;

-- Public read access for story types
CREATE POLICY "Anyone can read story types"
ON public.epic_story_types FOR SELECT
USING (true);

-- Story Universe (user's persistent world)
CREATE TABLE public.story_universe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_name TEXT,
  world_era TEXT,
  prophecy_fragments TEXT[] DEFAULT '{}',
  active_mysteries TEXT[] DEFAULT '{}',
  resolved_mysteries TEXT[] DEFAULT '{}',
  foreshadowing_seeds TEXT[] DEFAULT '{}',
  memorable_moments TEXT[] DEFAULT '{}',
  running_callbacks TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.story_universe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their universe"
ON public.story_universe FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Story Characters (recurring NPCs)
CREATE TABLE public.story_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT,
  archetype TEXT NOT NULL, -- 'wanderer', 'rival', 'lost_one', 'trickster', 'guardian', 'echo'
  visual_description TEXT,
  signature_feature TEXT,
  speech_pattern TEXT,
  catchphrase TEXT,
  core_motivation TEXT,
  greatest_fear TEXT,
  secret_shame TEXT,
  backstory TEXT,
  current_goal TEXT,
  arc_stage TEXT DEFAULT 'introduction', -- 'introduction', 'conflict', 'growth', 'resolution'
  relationship_to_user TEXT,
  relationship_history TEXT[] DEFAULT '{}',
  first_appeared_epic_id UUID,
  first_appeared_chapter INTEGER,
  last_seen_epic_id UUID,
  last_seen_chapter INTEGER,
  times_encountered INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  fate TEXT DEFAULT 'alive', -- 'alive', 'departed', 'transformed', 'sacrificed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their characters"
ON public.story_characters FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Mentor Story Relationship
CREATE TABLE public.mentor_story_relationship (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.mentors(id),
  trust_level INTEGER DEFAULT 1, -- 1-5
  key_moments TEXT[] DEFAULT '{}',
  wisdom_shared TEXT[] DEFAULT '{}',
  mentor_transitions JSONB DEFAULT '[]', -- Track when user changed mentors
  current_since TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.mentor_story_relationship ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their mentor relationship"
ON public.mentor_story_relationship FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Completed Books (Cosmic Library)
CREATE TABLE public.completed_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  book_title TEXT NOT NULL,
  story_type_slug TEXT REFERENCES public.epic_story_types(slug),
  total_chapters INTEGER NOT NULL,
  boss_defeated_name TEXT,
  boss_defeated_at TIMESTAMPTZ,
  companion_name TEXT,
  companion_species TEXT,
  mentor_name TEXT,
  final_wisdom TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(epic_id)
);

ALTER TABLE public.completed_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their books"
ON public.completed_books FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add story fields to epics table
ALTER TABLE public.epics 
ADD COLUMN IF NOT EXISTS story_type_slug TEXT REFERENCES public.epic_story_types(slug),
ADD COLUMN IF NOT EXISTS story_seed JSONB,
ADD COLUMN IF NOT EXISTS book_title TEXT,
ADD COLUMN IF NOT EXISTS total_chapters INTEGER;

-- Add chapter fields to companion_postcards
ALTER TABLE public.companion_postcards
ADD COLUMN IF NOT EXISTS chapter_number INTEGER,
ADD COLUMN IF NOT EXISTS chapter_title TEXT,
ADD COLUMN IF NOT EXISTS clue_text TEXT,
ADD COLUMN IF NOT EXISTS story_content TEXT,
ADD COLUMN IF NOT EXISTS location_revealed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_finale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS characters_featured TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS prophecy_line TEXT,
ADD COLUMN IF NOT EXISTS seeds_planted TEXT[] DEFAULT '{}';