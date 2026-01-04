-- Add communication learning columns to user_ai_preferences
ALTER TABLE user_ai_preferences 
ADD COLUMN IF NOT EXISTS avg_message_length INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS uses_emojis BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prefers_formal_language BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS prefers_direct_answers BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS engagement_patterns JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learning_updated_at TIMESTAMPTZ DEFAULT now();

-- Create mentor chat feedback table for explicit feedback
CREATE TABLE IF NOT EXISTS mentor_chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_content TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'too_long', 'too_short', 'too_formal', 'too_casual')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE mentor_chat_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON mentor_chat_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON mentor_chat_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_chat_feedback_user_id ON mentor_chat_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_chat_feedback_type ON mentor_chat_feedback(feedback_type);