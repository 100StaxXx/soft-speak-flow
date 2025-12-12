-- Create storage bucket for mentor audio if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-audio', 'mentor-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view mentor audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload mentor audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage mentor audio" ON storage.objects;

-- Create RLS policies for mentor-audio bucket
CREATE POLICY "Anyone can view mentor audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'mentor-audio');

CREATE POLICY "Authenticated users can upload mentor audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mentor-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage mentor audio"
ON storage.objects FOR ALL
USING (bucket_id = 'mentor-audio' AND auth.role() = 'service_role');