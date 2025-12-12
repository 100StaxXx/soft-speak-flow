-- Add DELETE policy for user_daily_horoscopes so edge function can clean up incomplete records
CREATE POLICY "Service can delete incomplete horoscopes"
  ON public.user_daily_horoscopes
  FOR DELETE
  USING (is_service_role());