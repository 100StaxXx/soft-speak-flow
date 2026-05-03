function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("companion animation migration provisions jobs, metadata, policies, guardrails, and deletion coverage", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "../../migrations/20260502121000_add_companion_animation_videos.sql",
      import.meta.url,
    ),
  );

  assert(
    source.includes("ADD COLUMN IF NOT EXISTS animation_video_url TEXT") &&
      source.includes(
        "ADD COLUMN IF NOT EXISTS animation_provider_task_id TEXT",
      ) &&
      source.includes(
        "ADD COLUMN IF NOT EXISTS animation_completed_at TIMESTAMPTZ",
      ),
    "Expected companion_evolutions to store animation metadata",
  );
  assert(
    source.includes(
      "CREATE TABLE IF NOT EXISTS public.companion_animation_jobs",
    ) &&
      source.includes(
        "evolution_id UUID NOT NULL REFERENCES public.companion_evolutions(id) ON DELETE CASCADE",
      ) &&
      source.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_animation_jobs_evolution",
      ),
    "Expected companion animation jobs to be tied one-to-one to companion evolutions",
  );
  assert(
    source.includes(
      "VALUES ('companion-animation-videos', 'companion-animation-videos', true)",
    ) &&
      source.includes("Public can view companion animation videos") &&
      source.includes("Service role can manage companion animation videos"),
    "Expected public companion-animation-videos bucket with service role write policy",
  );
  assert(
    source.includes("'provider', 'fal'") &&
      source.includes("'feature', 'ai_companion_animation'") &&
      source.includes("'endpoint', 'process-companion-animation-job'"),
    "Expected fal animation cost guardrail config",
  );
  assert(
    source.includes("cron.schedule(") &&
      source.includes("'process-companion-animation-job'") &&
      source.includes(
        "invoke_edge_function_with_internal_secret('process-companion-animation-job'",
      ),
    "Expected companion animation worker to be scheduled for internal queue processing",
  );
  assert(
    source.includes("'companion_animation_video'::TEXT AS source_kind") &&
      source.includes("companion-animation-videos") &&
      source.includes(
        "bucket_id IN (''quest-attachments'', ''mentors-avatars'', ''journey-paths'', ''companion-images'', ''companion-animation-videos'')",
      ),
    "Expected animation videos to be included in storage ledger backfill and account deletion fallback",
  );
});
