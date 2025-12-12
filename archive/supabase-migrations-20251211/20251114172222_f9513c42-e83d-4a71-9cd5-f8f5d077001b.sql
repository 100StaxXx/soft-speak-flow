-- Create storage buckets for organized content
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('audio-pep-talks', 'audio-pep-talks', true),
  ('video-pep-talks', 'video-pep-talks', true),
  ('quotes-json', 'quotes-json', true),
  ('mentors-avatars', 'mentors-avatars', true),
  ('voice-samples', 'voice-samples', true),
  ('playlists-assets', 'playlists-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio-pep-talks
CREATE POLICY "Public can view audio pep talks"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-pep-talks');

CREATE POLICY "Admins can upload audio pep talks"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update audio pep talks"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'audio-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete audio pep talks"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for video-pep-talks
CREATE POLICY "Public can view video pep talks"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-pep-talks');

CREATE POLICY "Admins can upload video pep talks"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'video-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update video pep talks"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'video-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete video pep talks"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'video-pep-talks' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for quotes-json
CREATE POLICY "Public can view quotes"
ON storage.objects FOR SELECT
USING (bucket_id = 'quotes-json');

CREATE POLICY "Admins can upload quotes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quotes-json' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update quotes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'quotes-json' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete quotes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quotes-json' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for mentors-avatars
CREATE POLICY "Public can view mentor avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'mentors-avatars');

CREATE POLICY "Admins can upload mentor avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'mentors-avatars' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update mentor avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'mentors-avatars' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete mentor avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'mentors-avatars' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for voice-samples
CREATE POLICY "Public can view voice samples"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-samples');

CREATE POLICY "Admins can upload voice samples"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voice-samples' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update voice samples"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'voice-samples' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete voice samples"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'voice-samples' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for playlists-assets
CREATE POLICY "Public can view playlist assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'playlists-assets');

CREATE POLICY "Admins can upload playlist assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'playlists-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update playlist assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'playlists-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete playlist assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'playlists-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);