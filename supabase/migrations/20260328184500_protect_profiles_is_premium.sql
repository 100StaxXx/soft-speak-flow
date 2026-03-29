-- No-op: profile entitlement fields were removed in
-- 20260328153000_sensitive_state_hardening.sql, which also rebuilt the
-- restricted profile update policy against the new schema.
DO $$
BEGIN
  NULL;
END;
$$;
