-- Daily Mentor Messages
CREATE TABLE public.daily_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT DEFAULT 'motivation'
);

-- Mentor Chat Messages
CREATE TABLE public.mentor_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habits
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', '5x_week', '3x_week', 'custom')),
  custom_days INTEGER[],
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT max_two_habits CHECK (true)
);

-- Habit Completions
CREATE TABLE public.habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(habit_id, date)
);

-- Challenges
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days IN (7, 14, 30)),
  mentor_id UUID REFERENCES public.mentors(id),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Challenges
CREATE TABLE public.user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Challenge Progress
CREATE TABLE public.challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_challenge_id UUID REFERENCES public.user_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_challenge_id, date)
);

-- Check-Ins
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('morning', 'night')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood INTEGER CHECK (mood BETWEEN 1 AND 5),
  focus_goal TEXT,
  reflection TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type, date)
);

-- Audio Clips
CREATE TABLE public.audio_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lessons
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  category TEXT,
  lesson_number INTEGER,
  total_lessons INTEGER,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lesson Progress
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.daily_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_messages
CREATE POLICY "Anyone can view daily messages" ON public.daily_messages FOR SELECT USING (true);
CREATE POLICY "Admins can manage daily messages" ON public.daily_messages FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for mentor_chats
CREATE POLICY "Users can view own chats" ON public.mentor_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.mentor_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON public.mentor_chats FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for habits
CREATE POLICY "Users can view own habits" ON public.habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for habit_completions
CREATE POLICY "Users can view own completions" ON public.habit_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.habit_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions" ON public.habit_completions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for challenges
CREATE POLICY "Anyone can view challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Admins can manage challenges" ON public.challenges FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for user_challenges
CREATE POLICY "Users can view own challenges" ON public.user_challenges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own challenges" ON public.user_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own challenges" ON public.user_challenges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own challenges" ON public.user_challenges FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for challenge_progress
CREATE POLICY "Users can view own progress" ON public.challenge_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.challenge_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.challenge_progress FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for check_ins
CREATE POLICY "Users can view own check-ins" ON public.check_ins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own check-ins" ON public.check_ins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own check-ins" ON public.check_ins FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for audio_clips
CREATE POLICY "Anyone can view audio clips" ON public.audio_clips FOR SELECT USING (true);
CREATE POLICY "Admins can manage audio clips" ON public.audio_clips FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for lessons
CREATE POLICY "Anyone can view lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Admins can manage lessons" ON public.lessons FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for lesson_progress
CREATE POLICY "Users can view own progress" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_daily_messages_date ON public.daily_messages(date);
CREATE INDEX idx_daily_messages_mentor ON public.daily_messages(mentor_id);
CREATE INDEX idx_mentor_chats_user ON public.mentor_chats(user_id);
CREATE INDEX idx_habits_user ON public.habits(user_id);
CREATE INDEX idx_habit_completions_date ON public.habit_completions(date);
CREATE INDEX idx_user_challenges_user ON public.user_challenges(user_id);
CREATE INDEX idx_check_ins_user_date ON public.check_ins(user_id, date);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id);