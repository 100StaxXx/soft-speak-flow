-- Public preview images for badge and reward inventories.
INSERT INTO storage.buckets (id, name, public)
VALUES ('badge-reward-previews', 'badge-reward-previews', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view badge reward preview images" ON storage.objects;
CREATE POLICY "Public can view badge reward preview images"
ON storage.objects FOR SELECT
USING (bucket_id = 'badge-reward-previews');

DROP POLICY IF EXISTS "Service role can upload badge reward preview images" ON storage.objects;
CREATE POLICY "Service role can upload badge reward preview images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'badge-reward-previews' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update badge reward preview images" ON storage.objects;
CREATE POLICY "Service role can update badge reward preview images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'badge-reward-previews' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'badge-reward-previews' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete badge reward preview images" ON storage.objects;
CREATE POLICY "Service role can delete badge reward preview images"
ON storage.objects FOR DELETE
USING (bucket_id = 'badge-reward-previews' AND auth.role() = 'service_role');

