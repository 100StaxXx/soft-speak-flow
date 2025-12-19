-- Fix overly permissive storage policies on pep-talk-audio bucket

-- Drop the permissive policies that allow anyone to upload/update/delete
DROP POLICY IF EXISTS "Anyone can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete audio files" ON storage.objects;

-- Add admin-only restrictions for pep-talk-audio bucket
CREATE POLICY "Admins can upload to pep-talk-audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pep-talk-audio' AND
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can update pep-talk-audio"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pep-talk-audio' AND
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete from pep-talk-audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pep-talk-audio' AND
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );