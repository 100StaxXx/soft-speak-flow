function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("companion evolution reveal tracking stores presentation state and owned mark RPC", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260505133000_add_companion_evolution_reveal_tracking.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes("ADD COLUMN IF NOT EXISTS animation_presented_at TIMESTAMPTZ"),
    "Expected companion_evolutions to store reveal presentation timestamp",
  );

  assert(
    source.includes("animation_status = 'succeeded'") &&
      source.includes("NULLIF(BTRIM(animation_video_url), '') IS NOT NULL") &&
      source.includes("SET animation_presented_at = COALESCE("),
    "Expected existing succeeded animations to be backfilled as presented",
  );

  assert(
    source.includes("CREATE OR REPLACE FUNCTION public.mark_companion_evolution_animation_presented") &&
      source.includes("SECURITY DEFINER") &&
      source.includes("uc.user_id = v_user_id") &&
      source.includes("GRANT EXECUTE ON FUNCTION public.mark_companion_evolution_animation_presented(UUID) TO authenticated"),
    "Expected authenticated owned-evolution RPC for marking reveals presented",
  );

  assert(
    source.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_memories_evolution_id") &&
      source.includes("memory_context #>> '{details,evolutionId}'"),
    "Expected companion evolution memories to be idempotent by evolution id",
  );
});
