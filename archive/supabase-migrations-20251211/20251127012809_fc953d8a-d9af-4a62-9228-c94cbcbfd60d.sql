-- Fix function search path security issue
CREATE OR REPLACE FUNCTION update_premium_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    is_premium = (NEW.status IN ('active', 'trialing')),
    subscription_status = NEW.status,
    subscription_started_at = CASE
      WHEN NEW.status IN ('active', 'trialing') AND OLD.status NOT IN ('active', 'trialing')
      THEN NOW()
      ELSE subscription_started_at
    END,
    subscription_expires_at = NEW.current_period_end,
    trial_ends_at = NEW.trial_ends_at,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;