function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("hatch animation prewarm rows stay non-claiming until hatch promotion", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260503124500_make_hatch_animation_prewarm_non_claiming.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes(
      "SELECT public.get_highest_valid_claimed_companion_stage(v_companion_id)",
    ),
    "Expected XP accounting to use threshold-valid claimed stages instead of raw max stage",
  );
  assert(
    source.includes(
      "CREATE OR REPLACE FUNCTION public.get_legacy_restorable_companion_stage",
    ) &&
      source.includes("COALESCE(ce.xp_at_evolution, -1) >= et.xp_required"),
    "Expected legacy restoration checks to ignore non-claiming prewarm rows",
  );
  assert(
    source.includes(
      "COALESCE(public.companion_evolutions.xp_at_evolution, -1)",
    ) &&
      source.includes("COALESCE(v_stage_one_threshold, 0)") &&
      source.includes("'hatchPrewarmPromotedAt'"),
    "Expected hatch RPC to promote an existing prewarm evolution row into a valid claimed hatch",
  );
});
