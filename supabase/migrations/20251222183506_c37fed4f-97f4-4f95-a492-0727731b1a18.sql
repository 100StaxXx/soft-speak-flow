-- =====================================================
-- Phase 2: Configurable Commission Rates & Retry Mechanism
-- =====================================================

-- 1. Create referral_config table for flexible commission rates
CREATE TABLE public.referral_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit config (service role bypasses RLS)
CREATE POLICY "Admins can view referral config"
  ON public.referral_config
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update referral config"
  ON public.referral_config
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default configuration
INSERT INTO public.referral_config (config_key, config_value, description) VALUES
  ('commission_rates', '{
    "default": {
      "monthly_percent": 50,
      "yearly_percent": 20
    },
    "tiers": {
      "bronze": { "min_conversions": 0, "monthly_percent": 50, "yearly_percent": 20 },
      "silver": { "min_conversions": 10, "monthly_percent": 55, "yearly_percent": 22 },
      "gold": { "min_conversions": 25, "monthly_percent": 60, "yearly_percent": 25 },
      "platinum": { "min_conversions": 50, "monthly_percent": 65, "yearly_percent": 30 }
    }
  }', 'Commission rates by tier based on total conversions'),
  
  ('payout_settings', '{
    "minimum_threshold": 50,
    "auto_approve_threshold": 100,
    "max_retry_attempts": 3,
    "retry_delay_hours": 24
  }', 'Payout processing settings'),
  
  ('trusted_influencers', '{
    "auto_approve_after_payouts": 3,
    "codes": []
  }', 'Trusted influencer settings for auto-approval');

-- 2. Add retry tracking columns to referral_payouts
ALTER TABLE public.referral_payouts
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- 3. Add tier column to referral_codes for tracking influencer tier
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze';

-- 4. Create function to get current commission rate for a referral code
CREATE OR REPLACE FUNCTION public.get_commission_rate(p_referral_code_id UUID, p_plan TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_conversions INTEGER;
  v_config JSONB;
  v_tiers JSONB;
  v_rate NUMERIC;
  v_tier_key TEXT;
  v_tier JSONB;
BEGIN
  -- Get total conversions for this referral code
  SELECT COALESCE(total_conversions, 0) INTO v_total_conversions
  FROM referral_codes
  WHERE id = p_referral_code_id;

  -- Get commission config
  SELECT config_value INTO v_config
  FROM referral_config
  WHERE config_key = 'commission_rates';

  IF v_config IS NULL THEN
    -- Fallback to hardcoded defaults
    IF p_plan = 'yearly' THEN
      RETURN 20;
    ELSE
      RETURN 50;
    END IF;
  END IF;

  v_tiers := v_config->'tiers';
  
  -- Find the best matching tier (highest min_conversions that user qualifies for)
  v_rate := (v_config->'default'->>(p_plan || '_percent'))::NUMERIC;
  
  FOR v_tier_key IN SELECT jsonb_object_keys(v_tiers)
  LOOP
    v_tier := v_tiers->v_tier_key;
    IF v_total_conversions >= (v_tier->>'min_conversions')::INTEGER THEN
      v_rate := (v_tier->>(p_plan || '_percent'))::NUMERIC;
    END IF;
  END LOOP;

  RETURN v_rate;
END;
$$;

-- 5. Create function to update referral code tier
CREATE OR REPLACE FUNCTION public.update_referral_code_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config JSONB;
  v_tiers JSONB;
  v_new_tier TEXT := 'bronze';
  v_tier_key TEXT;
  v_tier JSONB;
  v_max_conversions INTEGER := -1;
BEGIN
  -- Get commission config
  SELECT config_value INTO v_config
  FROM referral_config
  WHERE config_key = 'commission_rates';

  IF v_config IS NOT NULL THEN
    v_tiers := v_config->'tiers';
    
    -- Find the best matching tier
    FOR v_tier_key IN SELECT jsonb_object_keys(v_tiers)
    LOOP
      v_tier := v_tiers->v_tier_key;
      IF NEW.total_conversions >= (v_tier->>'min_conversions')::INTEGER 
         AND (v_tier->>'min_conversions')::INTEGER > v_max_conversions THEN
        v_max_conversions := (v_tier->>'min_conversions')::INTEGER;
        v_new_tier := v_tier_key;
      END IF;
    END LOOP;
  END IF;

  NEW.tier := v_new_tier;
  RETURN NEW;
END;
$$;

-- Create trigger for tier updates
DROP TRIGGER IF EXISTS update_referral_tier_trigger ON public.referral_codes;
CREATE TRIGGER update_referral_tier_trigger
  BEFORE UPDATE OF total_conversions ON public.referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_referral_code_tier();

-- 6. Create index for retry processing
CREATE INDEX IF NOT EXISTS idx_referral_payouts_retry 
  ON public.referral_payouts (status, next_retry_at) 
  WHERE status = 'failed' AND retry_count < 3;

-- 7. Add updated_at trigger for referral_config
CREATE TRIGGER update_referral_config_updated_at
  BEFORE UPDATE ON public.referral_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();