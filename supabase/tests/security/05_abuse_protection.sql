\set ON_ERROR_STOP 1

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT no_plan();

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.consume_abuse_subject(
      'auth.sign_in',
      'ip',
      '127.0.0.1',
      20,
      600,
      900,
      now()
    )
    WHERE allowed IS TRUE
      AND blocked_reason IS NULL
      AND remaining = 19
      AND cooldown_until IS NULL
  ),
  'consume_abuse_subject returns an allowed row without cooldown ambiguity'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.consume_abuse_protection(
      'auth.sign_in',
      'auth-gateway.sign_in_password',
      NULL,
      '127.0.0.1',
      'security-test@example.com',
      gen_random_uuid(),
      '{}'::jsonb
    )
    WHERE allowed IS TRUE
      AND code = 'allowed'
      AND matched_profile = 'auth.sign_in'
  ),
  'consume_abuse_protection succeeds for auth sign-in probes'
);

SELECT * FROM finish();
ROLLBACK;
