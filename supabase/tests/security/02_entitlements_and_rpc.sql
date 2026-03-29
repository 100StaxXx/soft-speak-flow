\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name IN (
       'is_premium',
       'stripe_customer_id',
       'subscription_status',
       'subscription_started_at',
       'subscription_expires_at',
       'trial_started_at',
       'trial_ends_at'
     )),
  0,
  'legacy premium and billing fields are no longer stored on profiles'
);

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT is(
  (SELECT status
   FROM public.redeem_promo_code_secure(
     '10000000-0000-0000-0000-000000000002',
     'SECURITYPROMO'
   )
   LIMIT 1),
  'unauthorized',
  'promo redemption rejects cross-user attempts'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.promo_code_redemptions
   WHERE user_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user promo redemption attempts do not create redemptions'
);

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT ok(
  (SELECT success
   FROM public.redeem_promo_code_secure(
     '10000000-0000-0000-0000-000000000001',
     'SECURITYPROMO'
   )
   LIMIT 1),
  'users can redeem promo codes for their own account'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT source
   FROM public.account_entitlements
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  'promo_code',
  'promo redemption records the entitlement source'
);

SELECT is(
  (SELECT status
   FROM public.account_entitlements
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  'active',
  'promo redemption activates the entitlement snapshot'
);

SELECT is(
  (SELECT plan
   FROM public.account_entitlements
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  'promo',
  'promo redemption records the promo entitlement plan'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.promo_code_redemptions
   WHERE user_id = '10000000-0000-0000-0000-000000000001'
     AND redeemed_code = 'SECURITYPROMO'),
  1,
  'promo redemption creates exactly one redemption record'
);

SELECT * FROM finish();
ROLLBACK;
