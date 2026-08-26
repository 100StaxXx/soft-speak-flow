export const COMPANION_CINEMA_PRIVATE_BUCKET = "companion-cinema-private";
export const COMPANION_CINEMA_PROMPT_VERSION = "cosmiq-cinema-v1";
export const DEFAULT_COMPANION_CINEMA_MODEL =
  "fal-ai/kling-video/v3/standard/image-to-video";
export const DEFAULT_COMPANION_CINEMA_DURATION_SECONDS = 12;

export type CompanionCinemaCategory =
  | "ambient"
  | "interaction"
  | "reaction"
  | "milestone"
  | "legendary";

export type CompanionCinemaEventStatus =
  | "waiting_context"
  | "queued"
  | "rendering_portrait"
  | "rendering_video"
  | "ready"
  | "revealed"
  | "failed"
  | "cancelled"
  | "superseded";

export interface CompanionCinemaEventRow {
  id: string;
  user_id: string;
  companion_id: string;
  event_type: string;
  event_key: string;
  category: CompanionCinemaCategory;
  rarity: string;
  status: CompanionCinemaEventStatus;
  boundary_level: number | null;
  previous_boundary_level: number | null;
  lineage_revision: number;
  title: string;
  reveal_copy: string | null;
  source_table: string | null;
  source_record_id: string | null;
  context_snapshot: Record<string, unknown> | null;
  scene_plan: Record<string, unknown> | null;
  start_image_url: string | null;
  canonical_image_bucket: string | null;
  canonical_image_path: string | null;
  canonical_image_focal_x: number | null;
  canonical_image_focal_y: number | null;
  video_bucket: string | null;
  video_path: string | null;
  duration_seconds: number;
  audio_strategy: string;
  provider: string;
  provider_model: string;
  priority: number;
  render_attempt_count: number;
  max_render_attempts: number;
  next_retry_at: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  error_code: string | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  portrait_completed_at: string | null;
  video_completed_at: string | null;
  ready_at: string | null;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
  selected_render_id: string | null;
}

export interface CompanionCinemaRenderRow {
  id: string;
  event_id: string;
  user_id: string;
  companion_id: string;
  candidate_index: number;
  status:
    | "queued"
    | "submitted"
    | "processing"
    | "succeeded"
    | "failed"
    | "rejected"
    | "selected"
    | "cancelled";
  provider: string;
  provider_model: string;
  provider_task_id: string | null;
  provider_status: string | null;
  prompt: string;
  prompt_version: string;
  start_image_url: string;
  end_image_bucket: string;
  end_image_path: string;
  duration_seconds: number;
  generate_audio: boolean;
  video_bucket: string | null;
  video_path: string | null;
  qa_score: number | null;
  qa_payload: Record<string, unknown> | null;
  selected: boolean;
  retry_count: number;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const redactCompanionCinemaText = (value: unknown): string =>
  asText(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\bhttps?:\/\/\S+/gi, "[link]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone]");

const compactText = (value: unknown, maxLength = 240): string =>
  redactCompanionCinemaText(value).replace(/\s+/g, " ").slice(0, maxLength);

const summarizeNamedRecords = (
  value: unknown,
  fields: string[],
  limit: number,
): string[] =>
  asArray(value)
    .slice(0, limit)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      return fields
        .map((field) => compactText(record[field], 160))
        .filter(Boolean)
        .join(": ");
    })
    .filter(Boolean);

export const buildCompanionMythologyPromptBlock = (
  contextSnapshot: unknown,
): string => {
  const context = asRecord(contextSnapshot) ?? {};
  const traits = summarizeNamedRecords(context.traits, ["name"], 4);
  const mutations = summarizeNamedRecords(
    context.mutations,
    ["name", "visualDescription"],
    8,
  );
  const legacy = summarizeNamedRecords(
    context.legacy,
    ["title", "description"],
    6,
  );
  const memories = asArray(context.memories)
    .slice(0, 8)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return "";
      const memoryContext = asRecord(record.context);
      const memoryText = memoryContext
        ? compactText(
          memoryContext.summary ?? memoryContext.title ??
            memoryContext.description ?? memoryContext.goal,
          220,
        )
        : "";
      return [compactText(record.type, 80), memoryText].filter(Boolean).join(
        ": ",
      );
    })
    .filter(Boolean);

  const lines = [
    `Bond level: ${Number(context.bondLevel ?? 0) || 0}`,
    compactText(context.intention, 240)
      ? `User-named intention for this scene: ${
        compactText(context.intention, 240)
      }`
      : "",
    compactText(context.currentGoal ?? context.goal, 240)
      ? `Current goal: ${compactText(context.currentGoal ?? context.goal, 240)}`
      : "",
    compactText(context.reactionKind, 100)
      ? `Reaction cue: ${compactText(context.reactionKind, 100)}`
      : "",
    traits.length > 0 ? `Observed traits: ${traits.join("; ")}` : "",
    mutations.length > 0
      ? `Permanent visual mutations that MUST remain visible: ${
        mutations.join("; ")
      }`
      : "",
    legacy.length > 0
      ? `Legacy achievements to express symbolically: ${legacy.join("; ")}`
      : "",
    memories.length > 0
      ? `Meaningful shared history: ${memories.join("; ")}`
      : "",
  ].filter(Boolean);

  return lines.length > 0
    ? [
      "Personal mythology for this exact companion:",
      ...lines.map((line) => `- ${line}`),
      "Use this history through restrained visual storytelling. Do not add text to the image.",
    ].join("\n")
    : "";
};

export const buildCompanionCinemaScenePlan = ({
  event,
  element,
  species,
}: {
  event: CompanionCinemaEventRow;
  element?: string | null;
  species?: string | null;
}): Record<string, unknown> => {
  const boundary = event.boundary_level ?? 1;
  const prestige = boundary >= 56
    ? "legendary, monumental, and emotionally restrained"
    : boundary >= 21
    ? "powerful, mythic, and assured"
    : "intimate, wondrous, and clearly transformative";

  const reactionKind = compactText(
    (event.context_snapshot ?? {}).reactionKind,
    100,
  );
  const beats = event.event_type === "reaction"
    ? {
      openingBeat:
        "Hold the exact canonical portrait, then let the companion recognize that the user's protected work is complete.",
      transformationBeat: reactionKind === "watch_completed"
        ? "The companion gently releases its elemental guard, offers a brief proud acknowledgment, and lets the protected space become calm again."
        : "The companion gives a brief, emotionally readable acknowledgment through restrained elemental motion.",
      revealBeat:
        "The companion returns exactly to the supplied canonical portrait for a seamless handoff.",
    }
    : event.event_type === "watch"
    ? {
      openingBeat:
        "Hold the exact canonical portrait, then let the companion become alert to the user's intention.",
      transformationBeat:
        "The companion assumes a disciplined guarding posture and shapes a restrained elemental perimeter around the work space.",
      revealBeat:
        "The companion settles into a calm watchful stance, then returns exactly to the supplied canonical portrait.",
    }
    : event.event_type === "hunt"
    ? {
      openingBeat:
        "Hold the exact canonical portrait, then let the companion sense a distant signal connected to the user's ambition.",
      transformationBeat:
        "The companion crosses a dramatic elemental threshold, retrieves a symbolic relic, and returns with controlled power.",
      revealBeat:
        "The companion presents the relic toward camera, then resolves exactly into the supplied canonical portrait.",
    }
    : event.event_type === "forge"
    ? {
      openingBeat:
        "Hold the exact canonical portrait while the companion recognizes the challenge the user has named.",
      transformationBeat:
        "The companion prepares for the challenge in an elemental forge ritual: gathering energy, testing armor or natural defenses, and focusing its intent.",
      revealBeat:
        "The companion faces forward, fully prepared, then resolves exactly into the supplied canonical portrait.",
    }
    : {
      openingBeat:
        "Hold the exact prior canonical portrait long enough to establish recognition.",
      transformationBeat:
        "The surrounding elemental atmosphere gathers around the companion and conceals only the moment of transformation.",
      revealBeat:
        "The evolved form emerges with controlled confidence, then settles into the exact supplied ending portrait.",
    };

  return {
    schemaVersion: 1,
    promptVersion: COMPANION_CINEMA_PROMPT_VERSION,
    narrativePurpose: event.event_type === "evolution"
      ? `Reveal the same companion reaching Level ${boundary}`
      : event.title,
    emotionalTone: prestige,
    species: species ?? null,
    element: element ?? null,
    ...beats,
    camera:
      "One continuous cinematic shot, slow deliberate push-in, stable framing, no cuts unless a multi-shot provider is explicitly selected.",
    continuity:
      "Opening and ending endpoint images are immutable. Preserve individual identity, species, markings, palette, face, and illustration language.",
    finalHoldSeconds: 1.25,
  };
};

export const buildCompanionCinemaVideoPrompt = ({
  event,
  scenePlan,
  candidateIndex,
}: {
  event: CompanionCinemaEventRow;
  scenePlan: Record<string, unknown>;
  candidateIndex: number;
}): string => {
  const context = event.context_snapshot ?? {};
  const mythology = buildCompanionMythologyPromptBlock(context);
  const variation = candidateIndex === 1
    ? "Direction A: favor a slow, majestic energy build and an emotionally clear reveal."
    : "Direction B: favor a stronger environmental surge, then resolve into a calm, powerful final hold.";

  return [
    `COSMIQ CINEMA ENGINE ${COMPANION_CINEMA_PROMPT_VERSION}.`,
    `Create a ${event.duration_seconds}-second premium illustrated companion ${event.event_type} cinematic.`,
    `Narrative purpose: ${compactText(scenePlan.narrativePurpose, 300)}.`,
    `Emotional tone: ${compactText(scenePlan.emotionalTone, 240)}.`,
    compactText(scenePlan.openingBeat, 400),
    compactText(scenePlan.transformationBeat, 500),
    compactText(scenePlan.revealBeat, 500),
    compactText(scenePlan.camera, 400),
    compactText(scenePlan.continuity, 500),
    variation,
    mythology,
    "The supplied start image is the exact opening frame. The supplied end image is the exact final frame.",
    "Hold on the supplied end image for the final 1.25 seconds so the app can hand off invisibly to the canonical portrait.",
    "Preserve the premium 2D anime/storybook illustration style. Never become live action, photoreal, CGI, or 3D.",
    "No captions, logos, UI, extra characters, extra limbs, anatomy errors, identity drift, style drift, camera shake, or hard cuts.",
  ].filter(Boolean).join(" ");
};

export const resolveCinemaRenderQaScore = (
  render: Pick<
    CompanionCinemaRenderRow,
    "qa_score" | "qa_payload" | "candidate_index"
  >,
): number => {
  if (typeof render.qa_score === "number" && Number.isFinite(render.qa_score)) {
    return render.qa_score;
  }

  const payload = render.qa_payload ?? {};
  const endpointLocked = payload.endpointLocked === true ? 10 : 0;
  const providerCompleted = payload.providerCompleted === true ? 5 : 0;
  const containerValid = payload.containerValid === true ? 25 : 0;
  const videoTrackPresent = payload.videoTrackPresent === true ? 20 : 0;
  const audioExpected = payload.audioExpected === true;
  const audioTrackPresent = payload.audioTrackPresent === true;
  const audioIntegrity = audioExpected ? (audioTrackPresent ? 15 : -30) : 5;
  const durationMatch = payload.durationWithinTolerance === true ? 15 : 0;
  const visualQaScore = typeof payload.visualQaScore === "number"
    ? Math.min(10, Math.max(0, payload.visualQaScore / 10))
    : 0;
  const deterministicTieBreak = Math.max(0, 5 - render.candidate_index);
  return endpointLocked + providerCompleted + containerValid +
    videoTrackPresent + audioIntegrity + durationMatch + visualQaScore +
    deterministicTieBreak;
};

export const selectBestCinemaRender = (
  renders: CompanionCinemaRenderRow[],
): CompanionCinemaRenderRow | null => {
  const eligible = renders.filter((render) => render.status === "succeeded");
  if (eligible.length === 0) return null;

  return [...eligible].sort((left, right) => {
    const scoreDelta = resolveCinemaRenderQaScore(right) -
      resolveCinemaRenderQaScore(left);
    return scoreDelta !== 0
      ? scoreDelta
      : left.candidate_index - right.candidate_index;
  })[0] ?? null;
};
