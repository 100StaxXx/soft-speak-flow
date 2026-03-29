\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

\ir _support/helpers.sql

SELECT test_security.seed_fixtures();

SELECT ok(to_regclass('public.account_entitlements') IS NOT NULL, 'account_entitlements table exists');

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.profiles
   WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user profile reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.push_device_tokens
   WHERE user_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user push token reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.user_companion
   WHERE user_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user companion reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.mentor_chats
   WHERE user_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user mentor chat reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.referral_payouts),
  0,
  'cross-user referral payout reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.subscriptions
   WHERE user_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'cross-user subscription reads are denied'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM public.account_entitlements
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'service-managed account entitlements are not directly readable by authenticated users'
);

SELECT is(
  test_security.exec_row_count($sql$
    UPDATE public.profiles
    SET timezone = 'UTC'
    WHERE id = '10000000-0000-0000-0000-000000000001'
  $sql$),
  1,
  'safe profile fields remain client-editable'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT timezone
   FROM public.profiles
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  'UTC',
  'safe profile field update persists'
);

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT ok(
  test_security.attempt_sql($sql$
    UPDATE public.profiles
    SET streak_freezes_available = 99
    WHERE id = '10000000-0000-0000-0000-000000000001'
  $sql$) IS NOT NULL,
  'protected profile fields reject client edits'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT COALESCE(streak_freezes_available, 0)::INTEGER
   FROM public.profiles
   WHERE id = '10000000-0000-0000-0000-000000000001'),
  1,
  'protected profile state stays unchanged after illicit update attempts'
);

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT is(
  test_security.exec_row_count($sql$
    UPDATE public.profiles
    SET timezone = 'Europe/Berlin'
    WHERE id = '10000000-0000-0000-0000-000000000002'
  $sql$),
  0,
  'cross-user profile updates are denied'
);

SELECT is(
  test_security.exec_row_count($sql$
    UPDATE public.user_companion
    SET favorite_color = 'purple'
    WHERE user_id = '10000000-0000-0000-0000-000000000002'
  $sql$),
  0,
  'cross-user companion updates are denied'
);

SELECT is(
  test_security.exec_row_count($sql$
    UPDATE public.push_device_tokens
    SET device_token = repeat('c', 64)
    WHERE user_id = '10000000-0000-0000-0000-000000000002'
  $sql$),
  0,
  'cross-user push token updates are denied'
);

SELECT ok(
  test_security.attempt_sql($sql$
    UPDATE public.user_companion
    SET current_xp = 999999
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  $sql$) IS NOT NULL,
  'protected companion progression fields reject client edits'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT current_xp
   FROM public.user_companion
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'companion progression state stays unchanged after illicit updates'
);

SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT ok(
  test_security.attempt_sql($sql$
    UPDATE public.account_entitlements
    SET is_active = true
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  $sql$) IS NOT NULL,
  'premium entitlements cannot be forged through direct table writes'
);

SELECT test_security.reset_auth();
SELECT is(
  (SELECT is_active::TEXT
   FROM public.account_entitlements
   WHERE user_id = '10000000-0000-0000-0000-000000000001'),
  'false',
  'direct entitlement write attempts do not activate premium access'
);

SELECT test_security.set_auth('service_role');
SELECT is(
  (SELECT public::TEXT
   FROM storage.buckets
   WHERE id = 'quest-attachments'),
  'false',
  'quest attachments bucket stays private in production-like config'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT is(
  (SELECT COUNT(*)::INTEGER
   FROM storage.objects
   WHERE bucket_id = 'quest-attachments'),
  1,
  'users can list their own quest attachment objects'
);

SELECT is(
  test_security.insert_storage_object(
    '28000000-0000-0000-0000-000000000002',
    'quest-attachments',
    '10000000-0000-0000-0000-000000000001/new-upload.txt',
    '10000000-0000-0000-0000-000000000001'
  ),
  1,
  'users can upload inside their own quest attachment folder'
);

SELECT ok(
  test_security.try_insert_storage_object(
    '28000000-0000-0000-0000-000000000003',
    'quest-attachments',
    '10000000-0000-0000-0000-000000000002/hijack.txt',
    '10000000-0000-0000-0000-000000000001'
  ) IS NOT NULL,
  'users cannot upload into another user quest attachment folder'
);

SELECT ok(
  test_security.try_insert_storage_object(
    '28000000-0000-0000-0000-000000000004',
    'pep-talk-audio',
    'uploads/hijack.mp3',
    '10000000-0000-0000-0000-000000000001'
  ) IS NOT NULL,
  'normal users cannot upload to admin-only storage buckets'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('service_role');
SELECT is(
  test_security.insert_storage_object(
    '28000000-0000-0000-0000-000000000005',
    'pep-talk-audio',
    'generated/admin-only.mp3',
    '10000000-0000-0000-0000-000000000003'
  ),
  1,
  'service role can manage admin-only storage buckets'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000001');
SELECT ok(
  test_security.attempt_sql($sql$
    INSERT INTO public.quotes (id, text, author, category)
    VALUES (
      '29000000-0000-0000-0000-000000000001',
      'blocked quote write',
      'security suite',
      'security'
    )
  $sql$) IS NOT NULL,
  'admin-only content writes are blocked for normal users'
);

SELECT test_security.reset_auth();
SELECT test_security.set_auth('authenticated', '10000000-0000-0000-0000-000000000003');
SELECT is(
  test_security.exec_row_count($sql$
    INSERT INTO public.quotes (id, text, author, category)
    VALUES (
      '29000000-0000-0000-0000-000000000002',
      'allowed quote write',
      'security suite',
      'security'
    )
  $sql$),
  1,
  'admin users can perform admin-only content writes'
);

SELECT test_security.reset_auth();
SELECT * FROM finish();
ROLLBACK;
