import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompanionCinemaScenePlan,
  buildCompanionCinemaVideoPrompt,
  buildCompanionMythologyPromptBlock,
  type CompanionCinemaEventRow,
  type CompanionCinemaRenderRow,
  redactCompanionCinemaText,
  resolveCinemaRenderQaScore,
  selectBestCinemaRender,
} from "./companionCinema.ts";

const event = {
  id: "event-1",
  user_id: "user-1",
  companion_id: "companion-1",
  event_type: "evolution",
  event_key: "level_13",
  source_table: null,
  source_record_id: null,
  category: "milestone",
  rarity: "epic",
  status: "queued",
  boundary_level: 13,
  previous_boundary_level: 5,
  lineage_revision: 1,
  title: "Level 13 Evolution",
  reveal_copy: "Your companion wants to see you.",
  context_snapshot: {
    bondLevel: 7,
    traits: [{ name: "Relentless" }],
    mutations: [{ name: "Ember scar", visualDescription: "a fine gold seam" }],
    legacy: [{ title: "First Campaign", description: "crossed the threshold" }],
    memories: [{
      type: "victory",
      context: { summary: "finished the hard week" },
    }],
  },
  scene_plan: {},
  start_image_url: "https://example.com/start.png",
  canonical_image_bucket: null,
  canonical_image_path: null,
  canonical_image_focal_x: null,
  canonical_image_focal_y: null,
  video_bucket: null,
  video_path: null,
  duration_seconds: 12,
  audio_strategy: "native",
  provider: "fal",
  provider_model: "fal-ai/kling-video/v3/standard/image-to-video",
  priority: 100,
  render_attempt_count: 0,
  max_render_attempts: 2,
  next_retry_at: null,
  lease_token: null,
  lease_expires_at: null,
  error_code: null,
  error_message: null,
  queued_at: null,
  started_at: null,
  portrait_completed_at: null,
  video_completed_at: null,
  ready_at: null,
  revealed_at: null,
  created_at: "2026-08-19T00:00:00.000Z",
  updated_at: "2026-08-19T00:00:00.000Z",
  selected_render_id: null,
} satisfies CompanionCinemaEventRow;

const render = (
  candidateIndex: number,
  qaScore: number | null,
): CompanionCinemaRenderRow => ({
  id: `render-${candidateIndex}`,
  event_id: event.id,
  user_id: event.user_id,
  companion_id: event.companion_id,
  candidate_index: candidateIndex,
  status: "succeeded",
  provider: "fal",
  provider_model: event.provider_model,
  provider_task_id: null,
  provider_status: "COMPLETED",
  prompt: "cinematic",
  prompt_version: "cosmiq-cinema-v1",
  start_image_url: event.start_image_url!,
  end_image_bucket: "companion-cinema-private",
  end_image_path: "user/companion/event/end.png",
  duration_seconds: 12,
  generate_audio: true,
  video_bucket: "companion-cinema-private",
  video_path: `user/companion/event/candidate-${candidateIndex}.mp4`,
  qa_score: qaScore,
  qa_payload: {
    endpointLocked: true,
    providerCompleted: true,
    containerValid: true,
    videoTrackPresent: true,
    audioExpected: true,
    audioTrackPresent: true,
    durationWithinTolerance: true,
  },
  selected: false,
  retry_count: 0,
  next_retry_at: null,
  error_code: null,
  error_message: null,
  submitted_at: null,
  completed_at: "2026-08-19T00:01:00.000Z",
  created_at: "2026-08-19T00:00:00.000Z",
  updated_at: "2026-08-19T00:01:00.000Z",
});

Deno.test("cinema text redaction strips direct contact data before prompts", () => {
  assertEquals(
    redactCompanionCinemaText(
      "Email me@example.com, call +1 (415) 555-1212, visit https://private.test/a and use 123456789",
    ),
    "Email [email], call [phone], visit [link] and use [number]",
  );
});

Deno.test("forge intention is explicit in personal mythology", () => {
  const mythology = buildCompanionMythologyPromptBlock({
    intention: "Prepare me to present the launch plan",
    currentGoal: "Ship the beta",
  });
  assertStringIncludes(mythology, "Prepare me to present the launch plan");
  assertStringIncludes(mythology, "Ship the beta");
});

Deno.test("cinema mythology carries durable user history into the render prompt", () => {
  const mythology = buildCompanionMythologyPromptBlock(event.context_snapshot);
  assertStringIncludes(mythology, "Relentless");
  assertStringIncludes(mythology, "Ember scar: a fine gold seam");
  assertStringIncludes(mythology, "First Campaign: crossed the threshold");
  assertStringIncludes(mythology, "victory: finished the hard week");
});

Deno.test("evolution scene plan and video prompt lock both endpoint frames", () => {
  const scenePlan = buildCompanionCinemaScenePlan({
    event,
    element: "fire",
    species: "fox",
  });
  const prompt = buildCompanionCinemaVideoPrompt({
    event,
    scenePlan,
    candidateIndex: 2,
  });

  assertEquals(scenePlan.finalHoldSeconds, 1.25);
  assertStringIncludes(prompt, "exact opening frame");
  assertStringIncludes(prompt, "exact final frame");
  assertStringIncludes(prompt, "final 1.25 seconds");
  assertStringIncludes(prompt, "Direction B");
  assertStringIncludes(prompt, "Never become live action");
});

Deno.test("watch completion receives a dedicated return reaction", () => {
  const scenePlan = buildCompanionCinemaScenePlan({
    event: {
      ...event,
      event_type: "reaction",
      context_snapshot: { reactionKind: "watch_completed" },
    },
    element: "fire",
    species: "fox",
  });
  assertStringIncludes(
    String(scenePlan.transformationBeat),
    "releases its elemental guard",
  );
});

Deno.test("cinema render selection chooses the highest QA candidate", () => {
  const first = render(1, 72);
  const second = render(2, 91);
  assertEquals(selectBestCinemaRender([first, second])?.id, second.id);
  assert(resolveCinemaRenderQaScore(render(1, null)) > 0);
  assertEquals(selectBestCinemaRender([{ ...second, status: "failed" }]), null);
});
