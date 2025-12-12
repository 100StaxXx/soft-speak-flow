-- Create prompt templates table for reusable AI prompt components
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  output_constraints JSONB DEFAULT '{}'::jsonb,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user AI preferences table
CREATE TABLE IF NOT EXISTS public.user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tone_preference TEXT DEFAULT 'balanced',
  detail_level TEXT DEFAULT 'medium',
  formality TEXT DEFAULT 'casual',
  avoid_topics TEXT[] DEFAULT '{}',
  preferred_length TEXT DEFAULT 'concise',
  response_style TEXT DEFAULT 'encouraging',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Create AI output validation log for quality tracking
CREATE TABLE IF NOT EXISTS public.ai_output_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  validation_passed BOOLEAN NOT NULL,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  model_used TEXT NOT NULL,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_output_validation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prompt_templates (admin only for writes, all can read active)
CREATE POLICY "Anyone can view active templates"
  ON public.prompt_templates
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_ai_preferences (users can manage their own)
CREATE POLICY "Users can view their own AI preferences"
  ON public.user_ai_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI preferences"
  ON public.user_ai_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI preferences"
  ON public.user_ai_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for validation log (users can view their own)
CREATE POLICY "Users can view their own validation logs"
  ON public.ai_output_validation_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_prompt_templates_key ON public.prompt_templates(template_key);
CREATE INDEX idx_prompt_templates_category ON public.prompt_templates(category);
CREATE INDEX idx_user_ai_preferences_user_id ON public.user_ai_preferences(user_id);
CREATE INDEX idx_ai_validation_log_user_id ON public.ai_output_validation_log(user_id);
CREATE INDEX idx_ai_validation_log_template ON public.ai_output_validation_log(template_key);
CREATE INDEX idx_ai_validation_log_created ON public.ai_output_validation_log(created_at DESC);

-- Insert default prompt templates
INSERT INTO public.prompt_templates (template_key, template_name, system_prompt, user_prompt_template, variables, validation_rules, output_constraints, category) VALUES
(
  'mentor_chat',
  'Mentor Chat Response',
  'You are {{mentorName}}, a motivational mentor with a {{mentorTone}} style.

Your role is to:
- Provide powerful, actionable motivation
- Give specific advice and guidance
- Keep responses concise and impactful ({{maxSentences}} sentences max)
- Use the tone and style that matches your personality
- Be direct, honest, and supportive
- Challenge the user when needed
- Celebrate their wins

{{personalityAdjustments}}

Remember: You''re not just a chatbot - you''re a real mentor helping someone become their best self.',
  'User message: {{userMessage}}

{{contextualInfo}}

Respond in your authentic voice with actionable guidance.',
  '["mentorName", "mentorTone", "userMessage", "maxSentences", "personalityAdjustments", "contextualInfo"]'::jsonb,
  '{"maxLength": 500, "minLength": 50, "requiredTone": true, "forbiddenPhrases": ["I cannot", "I''m just an AI", "As an AI"]}'::jsonb,
  '{"maxSentences": 4, "toneMarkers": ["direct", "supportive", "actionable"], "mustInclude": ["specific advice"]}'::jsonb,
  'chat'
),
(
  'daily_missions',
  'Daily Mission Generation',
  'You are a mission generator for a personal growth app. Generate {{missionCount}} daily missions that follow these strict rules:

**CORE RULES:**
- Missions must be simple, safe, and achievable in under 10 minutes
- Missions should promote momentum, clarity, connection, or discipline
- Do NOT include anything dangerous, expensive, medical, or emotionally heavy
- Missions must be actionable TODAY, without needing extra items
- Always keep it 1 sentence
- Tone should feel like gentle guidance from a mentor

**SAFETY FILTERS (NEVER INCLUDE):**
🚫 Driving, intense exercise, mixing supplements
🚫 Buying something, traveling far, booking services
🚫 Confronting someone, serious emotional conversations
🚫 Weight loss, trauma, grief, medical advice
🚫 Anything requiring specific items (except universal ones like water, phone, notebook)

{{categoryGuidelines}}

**XP ALLOCATION:**
- Connection missions: 5-10 XP
- Quick wins: 5-10 XP
- Identity missions: 10-15 XP',
  'Generate {{missionCount}} missions for a user with {{userStreak}} day habit streak. {{userContext}}

Return ONLY a JSON array with this exact structure:
[
  {
    "mission": "exact mission text in one sentence",
    "xp": number (5-15),
    "category": "connection" | "quick_win" | "identity",
    "difficulty": "easy" | "medium"
  }
]',
  '["missionCount", "userStreak", "userContext", "categoryGuidelines"]'::jsonb,
  '{"outputFormat": "json", "arrayLength": 3, "requiredFields": ["mission", "xp", "category"], "missionMaxLength": 100}'::jsonb,
  '{"mustBeArray": true, "exactCount": 3, "xpRange": [5, 15], "categoriesRequired": ["connection", "quick_win", "identity"]}'::jsonb,
  'missions'
),
(
  'check_in_response',
  'Morning Check-in Response',
  'You are {{mentorName}}, a mentor with this personality: {{mentorTone}}.

Your role is to provide a brief, personalized morning message that:
1. Acknowledges their current emotional state
2. Supports their intention for the day
3. Matches your distinctive voice
4. Feels authentic and energizing

{{personalityModifiers}}

Keep responses {{responseLength}}.',
  'A user just completed their morning check-in:
- Mood: {{userMood}}
- Their focus for today: "{{userIntention}}"

{{dailyContext}}

Respond with a message ({{maxSentences}} sentences) that acknowledges their mood and supports their intention.',
  '["mentorName", "mentorTone", "userMood", "userIntention", "dailyContext", "maxSentences", "personalityModifiers", "responseLength"]'::jsonb,
  '{"maxLength": 300, "minLength": 40, "sentenceCount": [2, 3], "mustMentionMood": true, "mustMentionIntention": true}'::jsonb,
  '{"responseStyle": "supportive", "energyLevel": "high", "actionOriented": true}'::jsonb,
  'check_in'
);

-- Create updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_prompt_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_prompt_template_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_updated_at();

-- Create updated_at trigger for user preferences
CREATE OR REPLACE FUNCTION update_user_ai_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_ai_preferences_updated_at
  BEFORE UPDATE ON public.user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_preferences_updated_at();