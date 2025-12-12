-- Enable realtime for companion updates
ALTER TABLE user_companion REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE user_companion;