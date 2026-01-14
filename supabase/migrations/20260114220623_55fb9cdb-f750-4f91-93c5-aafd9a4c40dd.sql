-- Add image_url column to daily_tasks table
ALTER TABLE public.daily_tasks 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Create storage bucket for quest attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('quest-attachments', 'quest-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users can upload quest attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quest-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own attachments
CREATE POLICY "Users can view quest attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quest-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete quest attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quest-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);