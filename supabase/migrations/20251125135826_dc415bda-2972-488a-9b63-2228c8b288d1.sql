-- Allow users to insert evolution records for their own companions
CREATE POLICY "Users can insert evolutions for their own companions"
ON public.companion_evolutions
FOR INSERT
WITH CHECK (
  companion_id IN (
    SELECT id FROM public.user_companion 
    WHERE user_id = auth.uid()
  )
);