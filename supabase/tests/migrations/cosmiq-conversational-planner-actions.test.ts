function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test("Cosmiq conversational planner actions stay confirmation-gated and atomic", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260810010000_cosmiq_conversational_planner_actions.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes(
      "CREATE OR REPLACE FUNCTION public.create_cosmiq_agent_campaign",
    ) &&
      source.includes(
        "CREATE OR REPLACE FUNCTION public.apply_cosmiq_agent_day_plan",
      ),
    "Expected dedicated campaign and day-plan RPCs",
  );
  assert(
    source.match(/SECURITY DEFINER/g)?.length === 2 &&
      source.match(/v_caller_id = p_user_id OR public\.is_service_role\(\)/g)
          ?.length === 2,
    "Expected both RPCs to authorize only the caller or service role",
  );
  assert(
    source.includes("INSERT INTO public.epics") &&
      source.includes("INSERT INTO public.habits") &&
      source.includes("INSERT INTO public.epic_habits"),
    "Expected campaign creation to persist the campaign and linked rituals in one function",
  );
  assert(
    source.includes("UPDATE public.daily_tasks") &&
      source.includes("INSERT INTO public.daily_tasks") &&
      source.includes("INSERT INTO public.daily_plans") &&
      source.includes("ON CONFLICT (user_id, plan_date)"),
    "Expected day-plan application to update existing tasks, create new tasks, and commit the canonical plan",
  );
  assert(
    source.includes("FROM PUBLIC, anon, authenticated") &&
      source.includes(
        "GRANT EXECUTE ON FUNCTION public.create_cosmiq_agent_campaign(uuid, jsonb) TO service_role",
      ) &&
      source.includes(
        "GRANT EXECUTE ON FUNCTION public.apply_cosmiq_agent_day_plan(uuid, date, jsonb) TO service_role",
      ),
    "Expected both confirmation-gated RPCs to be callable only by the service role",
  );
  assert(
    source.includes("WHERE id = v_epic_id AND user_id = p_user_id") &&
      source.includes(
        "WHERE id = v_habit_source_id AND user_id = p_user_id",
      ),
    "Expected referenced campaigns and rituals to be owned by the user",
  );

  const lockdownSource = await Deno.readTextFile(
    new URL(
      "../../migrations/20260810010500_lock_down_cosmiq_conversational_planner_actions.sql",
      import.meta.url,
    ),
  );
  assert(
    lockdownSource.match(/FROM PUBLIC, anon, authenticated/g)?.length === 2 &&
      lockdownSource.match(/TO service_role/g)?.length === 2,
    "Expected the production follow-up to remove inherited client execution grants",
  );
});
