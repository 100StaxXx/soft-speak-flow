-- Create adaptive_push_settings table
CREATE TABLE public.adaptive_push_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mentor_id UUID REFERENCES public.mentors(id),
  primary_category TEXT,
  frequency TEXT CHECK (frequency IN ('daily','3_per_week','weekly','random','event_based')),
  time_window TEXT CHECK (time_window IN ('morning','midday','evening','night','any')),
  intensity TEXT CHECK (intensity IN ('soft','balanced','strong')),
  emotional_triggers TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create adaptive_push_queue table
CREATE TABLE public.adaptive_push_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mentor_id UUID,
  message TEXT,
  scheduled_for TIMESTAMPTZ,
  delivered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adaptive_push_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_push_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for adaptive_push_settings
CREATE POLICY "Users can view own settings"
  ON public.adaptive_push_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.adaptive_push_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.adaptive_push_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON public.adaptive_push_settings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for adaptive_push_queue
CREATE POLICY "Users can view own queued pushes"
  ON public.adaptive_push_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pushes"
  ON public.adaptive_push_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_adaptive_push_settings_updated_at
  BEFORE UPDATE ON public.adaptive_push_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();