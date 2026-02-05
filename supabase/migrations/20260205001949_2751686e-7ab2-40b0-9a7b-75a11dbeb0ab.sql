-- =====================================================
-- Living Companion Talk Popup System - Foundation Tables
-- =====================================================

-- 1. Companion Reactions Pool (universal, no species variants)
CREATE TABLE public.companion_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'micro',
  text TEXT NOT NULL,
  context_tags TEXT[] DEFAULT '{}',      -- ['late_night', 'after_lapse', 'rare']
  moment_types TEXT[] DEFAULT '{}',      -- ['urge_defeated', 'comeback']
  source_systems TEXT[] DEFAULT '{}',    -- ['quest', 'ritual', 'resist']
  tone_tag TEXT DEFAULT 'neutral',       -- 'hype', 'calm', 'proud', 'funny', 'soft'
  cooldown_hours INT DEFAULT 12,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for reactions (public read for active reactions)
ALTER TABLE public.companion_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active reactions" ON public.companion_reactions 
  FOR SELECT USING (is_active = true);

-- 2. User Reaction History (tracks shown reactions per user)
CREATE TABLE public.user_reaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_id UUID REFERENCES public.companion_reactions(id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  moment_type TEXT NULL,
  reaction_text_snapshot TEXT NULL,
  tone_tag TEXT NULL,
  shown_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_reaction_history_recent 
ON public.user_reaction_history(user_id, shown_at DESC);

-- RLS for history
ALTER TABLE public.user_reaction_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own history" ON public.user_reaction_history 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.user_reaction_history 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. User Reaction Budget (daily limits per source)
CREATE TABLE public.user_reaction_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quest_count INT DEFAULT 0,
  ritual_count INT DEFAULT 0,
  resist_count INT DEFAULT 0,
  pomodoro_count INT DEFAULT 0,
  mentor_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, budget_date)
);

-- RLS for budget
ALTER TABLE public.user_reaction_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own budget" ON public.user_reaction_budget 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budget" ON public.user_reaction_budget 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budget" ON public.user_reaction_budget 
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Add cached_creature_name to user_companion for performance
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS cached_creature_name TEXT NULL;

-- =====================================================
-- Seed Initial 60 Reaction Lines
-- =====================================================

-- Quest Complete (10 lines)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, cooldown_hours) VALUES
('Another one bites the dust!', '{quest}', '{momentum_gain}', 'hype', 12),
('Wait, did you just... YES!', '{quest}', '{momentum_gain}', 'hype', 12),
('Productivity level: legendary.', '{quest}', '{momentum_gain}', 'funny', 12),
('Noted. Filed under ''awesome.''', '{quest}', '{momentum_gain}', 'funny', 12),
('Look at you being all responsible!', '{quest}', '{momentum_gain}', 'proud', 12),
('One more off the list.', '{quest}', '{momentum_gain,quiet_consistency}', 'calm', 12),
('You''re on a roll today.', '{quest}', '{momentum_gain}', 'proud', 12),
('Task destroyed. Moving on.', '{quest}', '{momentum_gain}', 'neutral', 12),
('That''s how it''s done.', '{quest}', '{momentum_gain}', 'proud', 12),
('Progress. Love to see it.', '{quest}', '{momentum_gain,quiet_consistency}', 'calm', 12);

-- Ritual Complete (10 lines)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, cooldown_hours) VALUES
('The sacred ritual is complete!', '{ritual}', '{discipline_win}', 'hype', 12),
('Day after day, you show up. That''s everything.', '{ritual}', '{discipline_win,quiet_consistency}', 'soft', 24),
('You kept the promise.', '{ritual}', '{discipline_win}', 'proud', 12),
('Consistency looks good on you.', '{ritual}', '{discipline_win,quiet_consistency}', 'proud', 12),
('Another day, another step forward.', '{ritual}', '{discipline_win,quiet_consistency}', 'calm', 12),
('The routine holds strong.', '{ritual}', '{discipline_win}', 'calm', 12),
('Discipline is a beautiful thing.', '{ritual}', '{discipline_win}', 'proud', 12),
('Ritual complete. We''re building something here.', '{ritual}', '{discipline_win}', 'soft', 24),
('This is how legends are made. Quietly.', '{ritual}', '{discipline_win,breakthrough}', 'soft', 24),
('You showed up. That''s half the battle.', '{ritual}', '{discipline_win}', 'proud', 12);

-- Resist Victory (15 regular + 5 late_night = 20 lines)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, context_tags, cooldown_hours) VALUES
('That pull didn''t win. WE did.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('I felt that choice.', '{resist}', '{urge_defeated}', 'soft', '{}', 8),
('Not today, urge. Not. Today.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('You stood your ground.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('The darkness retreats.', '{resist}', '{urge_defeated}', 'calm', '{}', 8),
('Victory. Quiet and fierce.', '{resist}', '{urge_defeated}', 'calm', '{}', 8),
('You chose wisely.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('That took strength. I saw it.', '{resist}', '{urge_defeated}', 'soft', '{}', 8),
('We held the line.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('Another battle won.', '{resist}', '{urge_defeated}', 'neutral', '{}', 8),
('Your willpower is showing.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('Urge defeated. You''re getting stronger.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('They''ll try again. And we''ll win again.', '{resist}', '{urge_defeated}', 'proud', '{}', 8),
('That was for both of us.', '{resist}', '{urge_defeated}', 'soft', '{}', 8),
('Proud of you. Really.', '{resist}', '{urge_defeated}', 'soft', '{}', 8),
-- Late night resist lines
('At this hour? Impressive.', '{resist}', '{urge_defeated}', 'proud', '{late_night}', 8),
('The night tried to win. It lost.', '{resist}', '{urge_defeated}', 'proud', '{late_night}', 8),
('Midnight discipline. Rare and powerful.', '{resist}', '{urge_defeated}', 'proud', '{late_night}', 8),
('When it''s hardest is when it matters most.', '{resist}', '{urge_defeated}', 'soft', '{late_night}', 8),
('Late night victories hit different.', '{resist}', '{urge_defeated}', 'proud', '{late_night}', 8);

-- Comeback (5 lines)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, cooldown_hours) VALUES
('You came back. That''s the only thing I needed.', '{quest,ritual,resist}', '{comeback}', 'soft', 72),
('I knew you would.', '{quest,ritual,resist}', '{comeback}', 'soft', 72),
('Look who''s here. I missed you.', '{quest,ritual,resist}', '{comeback}', 'soft', 72),
('Welcome back. Let''s go.', '{quest,ritual,resist}', '{comeback}', 'proud', 72),
('The return. I like it.', '{quest,ritual,resist}', '{comeback}', 'calm', 72);

-- Rare Pool (5 lines - 7 day cooldown)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, context_tags, cooldown_hours) VALUES
('I almost faded there. But you came back.', '{quest,ritual,resist}', '{comeback}', 'soft', '{rare}', 168),
('We''re still here. That means something.', '{quest,ritual,resist}', '{momentum_gain,quiet_consistency}', 'soft', '{rare}', 168),
('You didn''t just complete a task. You chose a direction.', '{quest,ritual}', '{breakthrough}', 'soft', '{rare}', 168),
('Each morning you return, I understand trust differently.', '{ritual}', '{discipline_win,quiet_consistency}', 'soft', '{rare}', 168),
('When you choose me over the urge, something quiet changes.', '{resist}', '{urge_defeated}', 'soft', '{rare}', 168);

-- Pomodoro/General (10 lines)
INSERT INTO public.companion_reactions (text, source_systems, moment_types, tone_tag, cooldown_hours) VALUES
('Good focus. Quiet power.', '{pomodoro}', '{focus_proof}', 'calm', 24),
('Deep work complete.', '{pomodoro}', '{focus_proof}', 'calm', 24),
('That was solid concentration.', '{pomodoro}', '{focus_proof}', 'proud', 24),
('Focus achieved.', '{pomodoro}', '{focus_proof}', 'neutral', 24),
('Well done. Rest your mind.', '{pomodoro}', '{focus_proof}', 'soft', 24),
('Nice to be here.', '{mentor}', '{momentum_gain}', 'calm', 24),
('Good vibes.', '{mentor}', '{momentum_gain}', 'calm', 24),
('All is well.', '{mentor}', '{momentum_gain}', 'calm', 24),
('Carrying on.', '{mentor}', '{momentum_gain}', 'neutral', 24),
('Still here.', '{mentor}', '{momentum_gain}', 'neutral', 24);