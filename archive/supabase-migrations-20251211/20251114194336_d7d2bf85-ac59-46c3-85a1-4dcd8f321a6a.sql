-- Add new mentor personality fields
ALTER TABLE mentors 
ADD COLUMN IF NOT EXISTS style TEXT,
ADD COLUMN IF NOT EXISTS themes TEXT[],
ADD COLUMN IF NOT EXISTS target_user_type TEXT,
ADD COLUMN IF NOT EXISTS identity_description TEXT,
ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Create questionnaire responses table
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer_tags TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for questionnaire_responses
CREATE POLICY "Users can view own responses"
  ON questionnaire_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own responses"
  ON questionnaire_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses"
  ON questionnaire_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses"
  ON questionnaire_responses FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_questionnaire_responses_updated_at
  BEFORE UPDATE ON questionnaire_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();