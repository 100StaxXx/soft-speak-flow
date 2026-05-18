function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("shared campaign path marker migration scopes members, rituals, and progress", async () => {
  const source = await Deno.readTextFile(
    new URL("../../migrations/20260517190000_shared_campaign_path_markers.sql", import.meta.url),
  );

  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.get_shared_epic_path_markers"),
    "Expected migration to define the shared path marker RPC",
  );
  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.is_current_user_epic_member") &&
      source.includes("SECURITY DEFINER") &&
      source.includes("CREATE POLICY \"Members can view joined epics\"") &&
      source.includes("USING (public.is_current_user_epic_member(epics.id))"),
    "Expected joined campaign members to read shared epics without recursive RLS policy lookups",
  );
  assert(
    source.includes("DROP CONSTRAINT IF EXISTS epic_milestones_epic_id_milestone_percent_key") &&
      source.includes("UNIQUE (epic_id, user_id, milestone_percent)"),
    "Expected epic milestone uniqueness to be scoped by user for copied member milestones",
  );
  assert(
    source.includes("RETURNS TABLE") &&
      source.includes("companion_image_url text") &&
      source.includes("is_current_user boolean"),
    "Expected marker RPC to return display-safe companion fields",
  );
  assert(
    source.includes("v_epic.user_id <> v_caller") &&
      source.includes("FROM public.epic_members em") &&
      source.includes("em.user_id = v_caller"),
    "Expected marker RPC to authorize owners and joined campaign members",
  );
  assert(
    source.includes("MAX(milestone.milestone_percent)::numeric") &&
      source.includes("milestone.completed_at IS NOT NULL"),
    "Expected marker progress to prefer the highest completed milestone percent",
  );
  assert(
    source.includes("JOIN public.habits h ON h.id = eh.habit_id") &&
      source.includes("AND h.user_id = v_epic.user_id"),
    "Expected join flow to copy only the owner's source rituals",
  );
  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.copy_shared_epic_planner_structure") &&
      source.includes("PERFORM public.copy_shared_epic_planner_structure"),
    "Expected join flow and backfill to copy user-scoped phases and milestones",
  );
  assert(
    source.includes("INSERT INTO public.journey_phases") &&
      source.includes("SELECT\n    source_phase.epic_id,\n    p_target_user_id,"),
    "Expected phase copies to map source epic_id and target user_id in column order",
  );
  assert(
    source.includes("h.user_id = auth.uid()") &&
      source.includes("FROM public.epic_members em") &&
      source.includes("em.user_id = auth.uid()"),
    "Expected epic_habits policies to allow joined members to read and link their own copied rituals",
  );
});
