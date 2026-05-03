function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("pep talk generation migration provisions global idempotency and daily uniqueness", async () => {
  const migration = await Deno.readTextFile(
    new URL(
      "../migrations/20260425183000_add_pep_talk_generation_idempotency.sql",
      import.meta.url,
    ),
  );

  assert(
    migration.includes(
      "CREATE TABLE IF NOT EXISTS public.pep_talk_generation_requests",
    ),
    "Expected migration to create pep_talk_generation_requests",
  );
  assert(
    migration.includes(
      "CREATE UNIQUE INDEX IF NOT EXISTS pep_talk_generation_requests_key_idx",
    ) &&
      migration.includes("ON public.pep_talk_generation_requests(request_key)"),
    "Expected generation idempotency to be global by request_key",
  );
  assert(
    migration.includes(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_pep_talks_mentor_date_unique",
    ) &&
      migration.includes("ON public.daily_pep_talks(mentor_slug, for_date)"),
    "Expected daily_pep_talks to enforce one row per mentor/date",
  );
  assert(
    migration.includes("UPDATE public.user_daily_pushes") &&
      migration.includes(
        "DROP INDEX IF EXISTS public.idx_user_daily_pushes_user_pep_unique",
      ) &&
      migration.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_daily_pushes_user_pep_unique",
      ) &&
      migration.includes("DELETE FROM public.daily_pep_talks"),
    "Expected migration to re-point and de-dupe push rows before removing duplicate daily pep talks",
  );
  assert(
    migration.includes("begin_pep_talk_generation_request") &&
      migration.includes("complete_pep_talk_generation_request"),
    "Expected migration to create begin/complete idempotency RPCs",
  );
  assert(
    migration.includes("interval '3 minutes'") &&
      migration.includes("interval '30 minutes'") &&
      migration.includes("DELETE FROM public.pep_talk_generation_requests"),
    "Expected stale, replay, and cleanup windows to match the hardened companion-image pattern",
  );
});

Deno.test("single daily pep talk generation uses idempotency and uniqueness conflict recovery", async () => {
  const source = await Deno.readTextFile(
    new URL("./generate-single-daily-pep-talk/index.ts", import.meta.url),
  );

  assert(
    source.includes("beginPepTalkGenerationRequest") &&
      source.includes("completePepTalkGenerationRequestBestEffort"),
    "Expected generate-single-daily-pep-talk to use request-level idempotency",
  );
  assert(
    source.includes("buildPepTalkRequestKey") &&
      source.includes("daily:${mentorSlug}:${forDate}"),
    "Expected request keys to be based on the shared mentor/date daily pep talk",
  );
  assert(
    source.includes("PEP_TALK_REQUEST_IN_PROGRESS") &&
      source.includes("PEP_TALK_REQUEST_IN_PROGRESS_STATUS"),
    "Expected in-flight duplicate requests to return a structured in-progress response",
  );
  assert(
    source.includes("isUniqueViolation") &&
      source.includes("existingAfterConflict"),
    "Expected unique daily row conflicts to refetch the winning pep talk instead of failing",
  );
  assert(
    source.includes("isReplayPepTalkPayloadUsable") &&
      source.includes("Completed replay audio URL was unavailable"),
    "Expected completed idempotency replay payloads to validate cached audio before reuse",
  );
  assert(
    source.indexOf("// Check if already generated for today") <
      source.indexOf("createCostGuardrailSession({"),
    "Expected existing daily pep talks to return before expensive guardrail checks",
  );
  assert(
    source.includes("normalizePipelineFailureStatus") &&
      source.includes("status === 429") &&
      source.includes("AUDIO_PIPELINE_FAILED"),
    "Expected upstream audio rate limits to be reported as pipeline failures instead of user request throttling",
  );
  assert(
    source.includes("reuseMostRecentDailyPepTalkForDate") &&
      source.includes("reused_fallback") &&
      source.includes("audio_rate_limited"),
    "Expected provider rate limits to reuse the latest working pep talk as today's daily row",
  );
});

Deno.test("mentor audio retries ElevenLabs before falling back to OpenAI", async () => {
  const audioSource = await Deno.readTextFile(
    new URL("./generate-mentor-audio/index.ts", import.meta.url),
  );
  const fullAudioSource = await Deno.readTextFile(
    new URL("./generate-full-mentor-audio/index.ts", import.meta.url),
  );

  assert(
    audioSource.includes("ELEVENLABS_FIRST_ATTEMPT_TIMEOUT_MS") &&
      audioSource.includes("ELEVENLABS_RETRY_TIMEOUT_MS") &&
      audioSource.includes("isRetriableElevenLabsError"),
    "Expected ElevenLabs to get a bounded first-path retry for transient failures",
  );
  assert(
    audioSource.includes("retrying primary voice") &&
      audioSource.includes("trying OpenAI TTS fallback as last resort"),
    "Expected logs to distinguish primary retry from last-resort fallback",
  );
  assert(
    audioSource.includes("status === 429"),
    "Expected ElevenLabs rate limits to retry and fall back through the same transient path",
  );
  assert(
    audioSource.includes("storagePath: filePath") &&
      fullAudioSource.includes("audioStoragePath"),
    "Expected audio storage path to flow through the pipeline for replay diagnostics",
  );
  assert(
    fullAudioSource.includes("shouldUseFallbackScript") &&
      fullAudioSource.includes("buildFallbackMentorScript") &&
      fullAudioSource.includes("scriptFallback"),
    "Expected script-provider throttling to use a local fallback script and continue to audio generation",
  );
});
