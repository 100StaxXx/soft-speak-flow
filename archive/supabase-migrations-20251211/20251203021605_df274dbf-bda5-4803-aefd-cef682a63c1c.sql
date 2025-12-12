
-- Epic Templates table for curated epic experiences
CREATE TABLE public.epic_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  theme_color TEXT NOT NULL DEFAULT 'heroic',
  target_days INTEGER NOT NULL DEFAULT 21,
  difficulty_tier TEXT NOT NULL DEFAULT 'intermediate',
  habits JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_icon TEXT,
  badge_name TEXT,
  popularity_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Guild Rivalries - track rival relationships within epics
CREATE TABLE public.guild_rivalries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rival_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(epic_id, user_id)
);

-- Guild Shouts - premade messages between guild members
CREATE TABLE public.guild_shouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shout_type TEXT NOT NULL,
  message_key TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.epic_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_shouts ENABLE ROW LEVEL SECURITY;

-- Epic Templates policies (anyone can view, admins can manage)
CREATE POLICY "Anyone can view epic templates" ON public.epic_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage epic templates" ON public.epic_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Guild Rivalries policies
CREATE POLICY "Users can view rivalries in their epics" ON public.guild_rivalries
  FOR SELECT USING (
    epic_id IN (SELECT epic_id FROM epic_members WHERE user_id = auth.uid())
    OR epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create their own rivalries" ON public.guild_rivalries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rivalries" ON public.guild_rivalries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rivalries" ON public.guild_rivalries
  FOR DELETE USING (auth.uid() = user_id);

-- Guild Shouts policies
CREATE POLICY "Users can view shouts in their epics" ON public.guild_shouts
  FOR SELECT USING (
    epic_id IN (SELECT epic_id FROM epic_members WHERE user_id = auth.uid())
    OR epic_id IN (SELECT id FROM epics WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send shouts" ON public.guild_shouts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update shouts (mark read)" ON public.guild_shouts
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Seed initial epic templates
INSERT INTO public.epic_templates (name, description, theme_color, target_days, difficulty_tier, habits, badge_icon, badge_name, is_featured) VALUES
('Detox Warrior', 'Break free from dopamine addiction. Reclaim your focus and mental clarity through intentional digital boundaries.', 'heroic', 21, 'advanced', '[{"title": "No phone after 9 PM", "frequency": "daily", "difficulty": "hard"}, {"title": "No social media scrolling", "frequency": "daily", "difficulty": "hard"}, {"title": "10 min meditation", "frequency": "daily", "difficulty": "medium"}]', '⚔️', 'Detox Warrior', true),
('Dawn Champion', 'Master your mornings, master your life. Build an unstoppable morning routine that sets you up for daily wins.', 'solar', 30, 'intermediate', '[{"title": "Wake up by 6 AM", "frequency": "daily", "difficulty": "hard"}, {"title": "Morning exercise (20 min)", "frequency": "daily", "difficulty": "medium"}, {"title": "Healthy breakfast", "frequency": "daily", "difficulty": "easy"}]', '🌅', 'Dawn Champion', true),
('Iron Mind', 'Forge unbreakable mental toughness through daily discomfort and reflection.', 'heroic', 14, 'advanced', '[{"title": "Cold shower (2 min)", "frequency": "daily", "difficulty": "hard"}, {"title": "Journal for 10 min", "frequency": "daily", "difficulty": "medium"}]', '🧠', 'Iron Mind', true),
('Body Forge', 'Transform your physical form through consistent movement and hydration.', 'nature', 30, 'intermediate', '[{"title": "Workout session", "frequency": "daily", "difficulty": "hard"}, {"title": "Drink 8 glasses of water", "frequency": "daily", "difficulty": "easy"}, {"title": "10,000 steps", "frequency": "daily", "difficulty": "medium"}]', '💪', 'Body Forge', true),
('Mindful Master', 'Cultivate inner peace and presence through meditation and digital minimalism.', 'mystic', 21, 'beginner', '[{"title": "Meditate 15 min", "frequency": "daily", "difficulty": "medium"}, {"title": "No social media before noon", "frequency": "daily", "difficulty": "medium"}]', '🧘', 'Mindful Master', true),
('Sleep Sovereign', 'Optimize your sleep for peak performance and recovery.', 'mystic', 14, 'beginner', '[{"title": "In bed by 10 PM", "frequency": "daily", "difficulty": "medium"}, {"title": "No screens 1 hour before bed", "frequency": "daily", "difficulty": "hard"}, {"title": "No caffeine after 2 PM", "frequency": "daily", "difficulty": "medium"}]', '😴', 'Sleep Sovereign', false),
('Scholar''s Path', 'Expand your mind through daily learning and reading habits.', 'solar', 30, 'beginner', '[{"title": "Read for 30 min", "frequency": "daily", "difficulty": "medium"}, {"title": "Learn something new", "frequency": "daily", "difficulty": "easy"}]', '📚', 'Scholar''s Path', false),
('Clean Machine', 'Reset your nutrition and fuel your body right.', 'nature', 7, 'beginner', '[{"title": "No junk food", "frequency": "daily", "difficulty": "hard"}, {"title": "Eat vegetables with every meal", "frequency": "daily", "difficulty": "medium"}]', '🥗', 'Clean Machine', false),
('Digital Minimalist', 'Reclaim your time and attention from endless scrolling.', 'heroic', 21, 'intermediate', '[{"title": "Screen time under 2 hours", "frequency": "daily", "difficulty": "hard"}, {"title": "No phone in bedroom", "frequency": "daily", "difficulty": "medium"}, {"title": "Check email only twice daily", "frequency": "daily", "difficulty": "medium"}]', '📵', 'Digital Minimalist', false),
('Social Butterfly', 'Strengthen your connections and spread positivity.', 'nature', 14, 'beginner', '[{"title": "Call or text a friend/family", "frequency": "daily", "difficulty": "easy"}, {"title": "Random act of kindness", "frequency": "daily", "difficulty": "easy"}]', '🦋', 'Social Butterfly', false);

-- Enable realtime for shouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_shouts;
