-- Fix function search_path security warnings by replacing functions with CASCADE
DROP FUNCTION IF EXISTS update_prompt_template_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_user_ai_preferences_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_prompt_template_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_ai_preferences_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER set_prompt_template_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_updated_at();

CREATE TRIGGER set_user_ai_preferences_updated_at
  BEFORE UPDATE ON public.user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_preferences_updated_at();