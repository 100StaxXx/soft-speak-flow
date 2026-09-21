-- Production grants execute to anon/authenticated through default privileges.
-- These RPCs are confirmation executors and must only be callable by the
-- service role behind companion-agent-action.

REVOKE ALL ON FUNCTION public.create_cosmiq_agent_campaign(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_cosmiq_agent_day_plan(uuid, date, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_cosmiq_agent_campaign(uuid, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_cosmiq_agent_day_plan(uuid, date, jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
