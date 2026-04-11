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

SELECT test_security.reset_auth();

UPDATE public.profiles
SET faction = CASE id
  WHEN '10000000-0000-0000-0000-000000000001' THEN 'starfall'
  WHEN '10000000-0000-0000-0000-000000000002' THEN 'void'
  WHEN '10000000-0000-0000-0000-000000000003' THEN 'stellar'
  ELSE faction
END
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

DELETE FROM public.daily_missions
WHERE mission_date IN ('2026-04-09', '2026-04-10')
  AND user_id IN (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
  );

INSERT INTO public.daily_missions (
  user_id,
  mission_type,
  mission_text,
  xp_reward,
  mission_date,
  completed,
  category
)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Starfall mission 1', 10, '2026-04-09', true, 'starfall-1'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Starfall mission 2', 10, '2026-04-09', true, 'starfall-2'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Starfall mission 3', 10, '2026-04-09', false, 'starfall-3'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Starfall mission 4', 10, '2026-04-09', false, 'starfall-4'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Starfall mission 5', 10, '2026-04-09', false, 'starfall-5'),
  ('10000000-0000-0000-0000-000000000002', 'habit', 'Void mission 1', 10, '2026-04-09', true, 'void-1'),
  ('10000000-0000-0000-0000-000000000003', 'habit', 'Stellar mission 1', 10, '2026-04-09', true, 'stellar-1'),
  ('10000000-0000-0000-0000-000000000003', 'habit', 'Stellar mission 2', 10, '2026-04-09', true, 'stellar-2'),
  ('10000000-0000-0000-0000-000000000003', 'habit', 'Stellar mission 3', 10, '2026-04-09', false, 'stellar-3'),
  ('10000000-0000-0000-0000-000000000003', 'habit', 'Stellar mission 4', 10, '2026-04-09', false, 'stellar-4'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Solo mission 1', 10, '2026-04-10', true, 'solo-1'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Solo mission 2', 10, '2026-04-10', false, 'solo-2'),
  ('10000000-0000-0000-0000-000000000001', 'habit', 'Solo mission 3', 10, '2026-04-10', false, 'solo-3');

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');

SELECT is(
  (SELECT caller_faction
   FROM public.get_daily_mission_pulse('2026-04-09')
   LIMIT 1),
  'starfall',
  'daily mission pulse reports the caller faction'
);

SELECT is(
  (SELECT faction_completion_percentage
   FROM public.get_daily_mission_pulse('2026-04-09')
   LIMIT 1),
  40,
  'daily mission pulse computes the caller faction mission completion rate'
);

SELECT is(
  (SELECT network_average_completion_percentage
   FROM public.get_daily_mission_pulse('2026-04-09')
   LIMIT 1),
  75,
  'daily mission pulse benchmarks against the unweighted average of other guilds'
);

SELECT is(
  (SELECT faction_vs_network_average_pp
   FROM public.get_daily_mission_pulse('2026-04-09')
   LIMIT 1),
  -35,
  'daily mission pulse returns the signed percentage-point delta versus the network average'
);

SELECT ok(
  NOT COALESCE((
    SELECT to_jsonb(pulse) ?| ARRAY[
      'faction_participants',
      'faction_completed_users',
      'faction_missions_total',
      'faction_missions_completed',
      'global_participants',
      'global_completed_users',
      'global_completion_percentage',
      'global_missions_total',
      'global_missions_completed'
    ]
    FROM public.get_daily_mission_pulse('2026-04-09') AS pulse
    LIMIT 1
  ), false),
  'daily mission pulse omits raw participant and mission count fields'
);

SELECT is(
  (SELECT network_average_completion_percentage
   FROM public.get_daily_mission_pulse('2026-04-10')
   LIMIT 1),
  33,
  'daily mission pulse falls back to the caller rate when no other guilds are active'
);

SELECT is(
  (SELECT faction_vs_network_average_pp
   FROM public.get_daily_mission_pulse('2026-04-10')
   LIMIT 1),
  0,
  'daily mission pulse reports a zero delta when the caller guild is the only active guild'
);

SELECT * FROM finish();
ROLLBACK;
