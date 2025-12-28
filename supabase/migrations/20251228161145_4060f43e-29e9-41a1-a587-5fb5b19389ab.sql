-- Create ai_interactions table to log all AI interactions for learning
CREATE TABLE public.ai_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- 'classify', 'suggest_epic', 'adjust_plan', 'chat', 'orchestrate'
  input_text TEXT,
  detected_intent TEXT, -- 'quest', 'epic', 'habit', 'brain-dump', 'adjustment'
  ai_response JSONB,
  user_action TEXT, -- 'accepted', 'modified', 'rejected', null (pending)
  modifications JSONB, -- What the user changed if they modified
  context_snapshot JSONB, -- State of user's epics/habits/progress at time of interaction
  session_id UUID, -- Group related interactions in a conversation
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_ai_learning table to store learned patterns per user
CREATE TABLE public.user_ai_learning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  preferred_epic_duration INTEGER DEFAULT 30, -- Learned average target days
  preferred_habit_difficulty TEXT DEFAULT 'medium', -- Most commonly accepted difficulty
  preferred_habit_frequency TEXT DEFAULT 'daily', -- Most common frequency
  common_contexts TEXT[] DEFAULT '{}', -- Contexts user frequently mentions
  peak_productivity_times TEXT[] DEFAULT '{}', -- When user is most active
  successful_patterns JSONB DEFAULT '{}', -- Patterns that led to completed epics
  failed_patterns JSONB DEFAULT '{}', -- Patterns that led to abandoned epics
  preference_weights JSONB DEFAULT '{"story_type": {}, "theme_color": {}, "categories": {}}', -- Weighted preferences
  interaction_count INTEGER DEFAULT 0,
  acceptance_rate NUMERIC(5,2) DEFAULT 0, -- Percentage of accepted suggestions
  modification_rate NUMERIC(5,2) DEFAULT 0, -- Percentage of modified suggestions
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_learning ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_interactions
CREATE POLICY "Users can view their own AI interactions"
ON public.ai_interactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI interactions"
ON public.ai_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI interactions"
ON public.ai_interactions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for user_ai_learning
CREATE POLICY "Users can view their own AI learning profile"
ON public.user_ai_learning FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI learning profile"
ON public.user_ai_learning FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI learning profile"
ON public.user_ai_learning FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_ai_interactions_user_id ON public.ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_session_id ON public.ai_interactions(session_id);
CREATE INDEX idx_ai_interactions_type ON public.ai_interactions(interaction_type);
CREATE INDEX idx_ai_interactions_created_at ON public.ai_interactions(created_at DESC);

-- Trigger to update updated_at on user_ai_learning
CREATE TRIGGER update_user_ai_learning_updated_at
BEFORE UPDATE ON public.user_ai_learning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();