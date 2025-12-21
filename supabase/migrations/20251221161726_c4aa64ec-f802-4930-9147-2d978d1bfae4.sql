-- Store user calendar connections (Google, Outlook, etc.)
CREATE TABLE public.user_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT,
  calendar_email TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Cache external calendar events
CREATE TABLE public.external_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.user_calendar_connections(id) ON DELETE CASCADE,
  external_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  color TEXT,
  source TEXT NOT NULL CHECK (source IN ('google', 'outlook', 'apple')),
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(connection_id, external_event_id)
);

-- Enable RLS
ALTER TABLE public.user_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_calendar_connections
CREATE POLICY "Users can view their own calendar connections"
  ON public.user_calendar_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
  ON public.user_calendar_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
  ON public.user_calendar_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
  ON public.user_calendar_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all connections (for edge functions)
CREATE POLICY "Service role can manage all calendar connections"
  ON public.user_calendar_connections
  FOR ALL
  USING (public.is_service_role());

-- RLS policies for external_calendar_events
CREATE POLICY "Users can view their own external events"
  ON public.external_calendar_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own external events"
  ON public.external_calendar_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own external events"
  ON public.external_calendar_events
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own external events"
  ON public.external_calendar_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all events (for edge functions)
CREATE POLICY "Service role can manage all external events"
  ON public.external_calendar_events
  FOR ALL
  USING (public.is_service_role());

-- Create indexes for performance
CREATE INDEX idx_calendar_connections_user_id ON public.user_calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON public.user_calendar_connections(provider);
CREATE INDEX idx_external_events_user_id ON public.external_calendar_events(user_id);
CREATE INDEX idx_external_events_start_time ON public.external_calendar_events(start_time);
CREATE INDEX idx_external_events_connection_id ON public.external_calendar_events(connection_id);

-- Trigger for updated_at on calendar connections
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.user_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();