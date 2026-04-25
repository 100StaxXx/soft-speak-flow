INSERT INTO public.abuse_protection_config (
  profile_key,
  description,
  user_limit,
  user_window_seconds,
  ip_limit,
  ip_window_seconds,
  email_limit,
  email_window_seconds,
  cooldown_seconds,
  severity
) VALUES
  (
    'companion_agent',
    'Companion agent text chat (planner & journeys)',
    20,
    900,
    60,
    900,
    NULL,
    NULL,
    600,
    'medium'
  ),
  (
    'companion_agent_action',
    'Companion agent pending-action confirm/cancel',
    20,
    900,
    60,
    900,
    NULL,
    NULL,
    600,
    'medium'
  )
ON CONFLICT (profile_key) DO UPDATE
SET
  description = EXCLUDED.description,
  user_limit = EXCLUDED.user_limit,
  user_window_seconds = EXCLUDED.user_window_seconds,
  ip_limit = EXCLUDED.ip_limit,
  ip_window_seconds = EXCLUDED.ip_window_seconds,
  email_limit = EXCLUDED.email_limit,
  email_window_seconds = EXCLUDED.email_window_seconds,
  cooldown_seconds = EXCLUDED.cooldown_seconds,
  severity = EXCLUDED.severity,
  updated_at = NOW();
