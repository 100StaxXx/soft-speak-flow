-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.ensure_single_featured()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_featured = true THEN
    UPDATE public.pep_talks
    SET is_featured = false
    WHERE id != NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$;