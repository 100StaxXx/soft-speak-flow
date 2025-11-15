-- Fix search_path for all public functions to prevent mutable warnings
-- This ensures functions execute with a stable, secure search path

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$function$;

-- Update ensure_single_featured function
CREATE OR REPLACE FUNCTION public.ensure_single_featured()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.is_featured = true THEN
    UPDATE public.pep_talks
    SET is_featured = false
    WHERE id != NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$function$;