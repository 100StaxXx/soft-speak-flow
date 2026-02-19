-- Allow INSERT ... ON CONFLICT DO UPDATE under RLS for push_device_tokens.
-- Upsert performs an UPDATE on conflicts, so an explicit UPDATE policy is required.
DROP POLICY IF EXISTS "Users can update their own device tokens" ON public.push_device_tokens;
CREATE POLICY "Users can update their own device tokens"
  ON public.push_device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
