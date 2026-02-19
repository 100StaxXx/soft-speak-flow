-- Restore companion evolution uploads by ensuring the evolution-cards bucket exists.
INSERT INTO storage.buckets (id, name, public)
VALUES ('evolution-cards', 'evolution-cards', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view evolution card images" ON storage.objects;
CREATE POLICY "Public can view evolution card images"
ON storage.objects FOR SELECT
USING (bucket_id = 'evolution-cards');

DROP POLICY IF EXISTS "Service role can upload evolution card images" ON storage.objects;
CREATE POLICY "Service role can upload evolution card images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evolution-cards' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update evolution card images" ON storage.objects;
CREATE POLICY "Service role can update evolution card images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evolution-cards' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'evolution-cards' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete evolution card images" ON storage.objects;
CREATE POLICY "Service role can delete evolution card images"
ON storage.objects FOR DELETE
USING (bucket_id = 'evolution-cards' AND auth.role() = 'service_role');
