import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import {
  COMPANION_CINEMA_PRIVATE_BUCKET,
  DEFAULT_COMPANION_CINEMA_MODEL,
} from "../_shared/companionCinema.ts";
import {
  getCompanionCinemaRolloutConfig,
  isCompanionCinemaUserEligible,
} from "../_shared/companionCinemaRollout.ts";
import { cancelFalKlingRequest } from "../_shared/falKlingVideoClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type InteractionType = "watch" | "hunt" | "forge";
type InteractionTerminalAction = "complete" | "cancel";

interface CinemaStartRpcRow {
  run_id: string;
  event_id: string;
  reused: boolean;
  daily_remaining: number;
  monthly_remaining: number;
}

const INTERACTION_CONFIG: Record<InteractionType, {
  title: string;
  revealCopy: string;
  durationSeconds: number;
  expectedMinutes: number;
}> = {
  watch: {
    title: "The Watch",
    revealCopy: "Your companion has taken its post.",
    durationSeconds: 8,
    expectedMinutes: 25,
  },
  hunt: {
    title: "The Hunt",
    revealCopy: "Your companion has returned with something meant for you.",
    durationSeconds: 12,
    expectedMinutes: 30,
  },
  forge: {
    title: "The Forge",
    revealCopy: "Your companion is ready. What are we taking down?",
    durationSeconds: 12,
    expectedMinutes: 15,
  },
};

const isInteractionType = (value: unknown): value is InteractionType =>
  value === "watch" || value === "hunt" || value === "forge";

export const resolveInteractionTransition = (
  currentStatus: unknown,
  action: InteractionTerminalAction,
): "apply" | "idempotent" | "conflict" => {
  const target = action === "complete" ? "completed" : "cancelled";
  if (currentStatus === target) return "idempotent";
  if (["preparing", "active", "returning"].includes(String(currentStatus))) {
    return "apply";
  }
  return "conflict";
};

const asText = (value: unknown, maxLength = 500): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
};

const insertCinemaEventOnce = async (
  supabase: any,
  payload: Record<string, any>,
): Promise<string> => {
  const { data, error } = await supabase
    .from("companion_cinema_events")
    .insert(payload)
    .select("id")
    .maybeSingle();
  if (!error && data?.id) return data.id as string;
  if (error?.code !== "23505") {
    throw error ?? new Error("Cinema event insert did not return an id");
  }

  // Completion requests are deliberately repairable. If a prior request
  // inserted the reaction and then failed before linking it to the run, reuse
  // that exact event without resetting a ready/revealed render back to queued.
  const { data: existing, error: lookupError } = await supabase
    .from("companion_cinema_events")
    .select("id")
    .eq("companion_id", payload.companion_id)
    .eq("event_type", payload.event_type)
    .eq("event_key", payload.event_key)
    .eq("lineage_revision", payload.lineage_revision)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing?.id) throw error;
  return existing.id as string;
};

export const mapCinemaError = (
  message: string,
): { status: number; message: string } => {
  if (message.includes("cinema_daily_limit_reached")) {
    return {
      status: 429,
      message:
        "That cinematic has reached its daily limit. It will be available again tomorrow.",
    };
  }
  if (message.includes("cinema_monthly_limit_reached")) {
    return {
      status: 429,
      message: "That cinematic has reached its monthly limit.",
    };
  }
  if (message.includes("cinema_interaction_disabled")) {
    return {
      status: 503,
      message: "That cinematic is temporarily unavailable.",
    };
  }
  return { status: 400, message };
};

export const buildHuntReward = (companion: Record<string, unknown>) => {
  const element = asText(companion.core_element, 40) ?? "cosmic";
  const level = typeof companion.current_stage === "number"
    ? companion.current_stage
    : 1;
  const names: Record<string, string> = {
    fire: "Emberbound Fragment",
    ice: "Stillfrost Shard",
    nature: "Verdant Waystone",
    storm: "Stormglass Sigil",
    void: "Astral Echo",
    light: "Dawnforged Crest",
    water: "Tidekeeper Pearl",
  };
  return {
    type: "relic",
    title: names[element.toLowerCase()] ?? "Wayfinder Relic",
    description:
      "A symbolic relic from this Hunt. It is now part of your companion’s history.",
    element,
    level,
    awardedAt: new Date().toISOString(),
  };
};

const buildContextSnapshot = async ({
  supabase,
  companion,
  interactionType,
  intention,
}: {
  supabase: any;
  companion: Record<string, any>;
  interactionType: InteractionType;
  intention: string | null;
}) => {
  const [memories, traits, mutations, legacy] = await Promise.all([
    supabase.from("companion_memories")
      .select("memory_type, memory_date, memory_context")
      .eq("companion_id", companion.id)
      .order("memory_date", { ascending: false })
      .limit(12),
    supabase.from("companion_traits")
      .select("trait_key, display_name, confidence")
      .eq("companion_id", companion.id)
      .eq("active", true)
      .order("confidence", { ascending: false })
      .limit(4),
    supabase.from("companion_visual_mutations")
      .select("mutation_key, display_name, mutation_type, visual_description")
      .eq("companion_id", companion.id)
      .eq("active", true)
      .order("acquired_at", { ascending: true }),
    supabase.from("companion_legacy_achievements")
      .select("legacy_key, title, description, importance")
      .eq("companion_id", companion.id)
      .order("importance", { ascending: false })
      .limit(6),
  ]);
  for (const result of [memories, traits, mutations, legacy]) {
    if (result.error) throw result.error;
  }

  return {
    capturedAt: new Date().toISOString(),
    interactionType,
    intention,
    currentStage: companion.current_stage,
    currentXp: companion.current_xp,
    spiritAnimal: companion.spirit_animal,
    coreElement: companion.core_element,
    favoriteColor: companion.favorite_color,
    storyTone: companion.story_tone,
    bondLevel: companion.bond_level,
    personalityProfile: companion.cinema_personality_profile ?? {},
    memories: (memories.data ?? []).map((memory: Record<string, unknown>) => ({
      type: memory.memory_type,
      date: memory.memory_date,
      context: memory.memory_context,
    })),
    traits: (traits.data ?? []).map((trait: Record<string, unknown>) => ({
      key: trait.trait_key,
      name: trait.display_name,
      confidence: trait.confidence,
    })),
    mutations: (mutations.data ?? []).map((
      mutation: Record<string, unknown>,
    ) => ({
      key: mutation.mutation_key,
      name: mutation.display_name,
      type: mutation.mutation_type,
      visualDescription: mutation.visual_description,
    })),
    legacy: legacy.data ?? [],
  };
};

export const handleManageCompanionCinemaInteraction = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth
      .getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = asText(body.action, 30) ?? "start";
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const cinemaAvailable = isCompanionCinemaUserEligible(user.id);

    if (action === "reveal") {
      const eventId = asText(body.eventId, 80);
      if (!eventId) throw new Error("eventId is required");
      const { data: event, error } = await supabase
        .from("companion_cinema_events")
        .select(
          "id, status, title, reveal_copy, video_bucket, video_path, duration_seconds, event_type, source_record_id, user_companion!inner(product_mode)",
        )
        .eq("id", eventId)
        .eq("user_id", user.id)
        .eq("user_companion.product_mode", "cosmiq")
        .maybeSingle();
      if (error) throw error;
      if (!event) throw new Error("Cinema event not found");
      if (!["ready", "revealed"].includes(event.status) || !event.video_path) {
        return new Response(
          JSON.stringify({
            eventId,
            status: event.status,
            ready: false,
          }),
          {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const bucket = event.video_bucket ?? COMPANION_CINEMA_PRIVATE_BUCKET;
      const { data: signed, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(event.video_path, 60 * 60);
      if (signError || !signed?.signedUrl) {
        throw signError ?? new Error("Video unavailable");
      }
      const eventUpdate: Record<string, unknown> = {
        status: "revealed",
        updated_at: new Date().toISOString(),
      };
      if (event.status !== "revealed") {
        eventUpdate.revealed_at = new Date().toISOString();
      }
      const { error: revealUpdateError } = await supabase
        .from("companion_cinema_events")
        .update(eventUpdate)
        .eq("id", eventId);
      if (revealUpdateError) throw revealUpdateError;
      let reward: Record<string, unknown> | null = null;
      if (event.source_record_id) {
        const { data: sourceRun, error: sourceRunError } = await supabase
          .from("companion_interaction_runs")
          .select("reward")
          .eq("id", event.source_record_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (sourceRunError) throw sourceRunError;
        reward = sourceRun?.reward && Object.keys(sourceRun.reward).length > 0
          ? sourceRun.reward as Record<string, unknown>
          : null;
      }
      return new Response(
        JSON.stringify({
          eventId,
          status: "revealed",
          ready: true,
          eventType: event.event_type,
          title: event.title,
          revealCopy: event.reveal_copy,
          durationSeconds: event.duration_seconds,
          videoUrl: signed.signedUrl,
          reward,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "status") {
      const runId = asText(body.runId, 80);
      if (!runId) throw new Error("runId is required");
      const { data: run, error } = await supabase
        .from("companion_interaction_runs")
        .select(
          "id, interaction_type, status, title, intention, reward, cinema_event_id, completion_cinema_event_id, expected_complete_at, completed_at, user_companion!inner(product_mode), start_event:companion_cinema_events!companion_interaction_runs_cinema_event_id_fkey(id,status,ready_at,reveal_copy,title), completion_event:companion_cinema_events!companion_interaction_runs_completion_cinema_event_id_fkey(id,status,ready_at,reveal_copy,title)",
        )
        .eq("id", runId)
        .eq("user_id", user.id)
        .eq("user_companion.product_mode", "cosmiq")
        .maybeSingle();
      if (error) throw error;
      return new Response(
        JSON.stringify({
          available: cinemaAvailable,
          run: run ?? null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "history") {
      const { data: runs, error } = await supabase
        .from("companion_interaction_runs")
        .select(
          "id, interaction_type, status, title, intention, reward, cinema_event_id, completion_cinema_event_id, expected_complete_at, completed_at, created_at, user_companion!inner(product_mode), start_event:companion_cinema_events!companion_interaction_runs_cinema_event_id_fkey(id,status,ready_at,revealed_at,reveal_copy,title), completion_event:companion_cinema_events!companion_interaction_runs_completion_cinema_event_id_fkey(id,status,ready_at,revealed_at,reveal_copy,title)",
        )
        .eq("user_id", user.id)
        .eq("user_companion.product_mode", "cosmiq")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return new Response(
        JSON.stringify({
          available: cinemaAvailable,
          runs: runs ?? [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "complete" || action === "cancel") {
      const runId = asText(body.runId, 80);
      if (!runId) throw new Error("runId is required");
      const outcome = body.outcome && typeof body.outcome === "object"
        ? body.outcome
        : {};
      const { data: existingRun, error: existingRunError } = await supabase
        .from("companion_interaction_runs")
        .select(
          "*, user_companion!inner(product_mode,core_element,current_stage,current_image_url,initial_image_url,cinema_lineage_revision)",
        )
        .eq("id", runId)
        .eq("user_id", user.id)
        .eq("user_companion.product_mode", "cosmiq")
        .maybeSingle();
      if (existingRunError) throw existingRunError;
      if (!existingRun) throw new Error("Cinema interaction not found");

      const transition = resolveInteractionTransition(
        existingRun.status,
        action,
      );
      if (transition === "conflict") {
        const targetStatus = action === "complete" ? "completed" : "cancelled";
        return new Response(
          JSON.stringify({
            error:
              `This cinematic is already ${existingRun.status} and cannot become ${targetStatus}.`,
            code: "cinema_interaction_transition_conflict",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const companionRelation = Array.isArray(existingRun.user_companion)
        ? existingRun.user_companion[0]
        : existingRun.user_companion;
      const existingReward = existingRun.reward &&
          Object.keys(existingRun.reward).length > 0
        ? existingRun.reward
        : null;
      const reward = action === "complete" &&
          existingRun.interaction_type === "hunt"
        ? existingReward ?? buildHuntReward(
          companionRelation as Record<string, unknown>,
        )
        : existingRun.reward ?? {};
      let run: Record<string, any> | null = transition === "idempotent"
        ? {
          id: existingRun.id,
          interaction_type: existingRun.interaction_type,
          status: existingRun.status,
          cinema_event_id: existingRun.cinema_event_id,
          completion_cinema_event_id: existingRun.completion_cinema_event_id,
          reward: existingRun.reward,
        }
        : null;
      if (transition === "apply") {
        const { data: updatedRun, error } = await supabase
          .from("companion_interaction_runs")
          .update({
            status: action === "complete" ? "completed" : "cancelled",
            outcome,
            reward,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", runId)
          .eq("user_id", user.id)
          .in("status", ["preparing", "active", "returning"])
          .select(
            "id, interaction_type, status, cinema_event_id, completion_cinema_event_id, reward",
          )
          .maybeSingle();
        if (error) throw error;
        run = updatedRun;
        if (!run) {
          return new Response(
            JSON.stringify({
              error:
                "The cinematic changed while this request was being handled. Refresh and try again.",
              code: "cinema_interaction_transition_conflict",
            }),
            {
              status: 409,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
      }
      if (action === "cancel" && existingRun.cinema_event_id) {
        const { error: cancellationError } = await supabase
          .from("companion_cinema_events")
          .update({
            status: "cancelled",
            error_code: "interaction_cancelled",
            error_message:
              "The user cancelled before the cinematic was revealed",
            lease_token: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRun.cinema_event_id)
          .eq("user_id", user.id)
          .in("status", [
            "waiting_context",
            "queued",
            "rendering_portrait",
            "rendering_video",
          ]);
        if (cancellationError) throw cancellationError;
        const { data: activeRenders, error: renderLookupError } = await supabase
          .from("companion_cinema_renders")
          .select("id,provider_model,provider_task_id")
          .eq("event_id", existingRun.cinema_event_id)
          .in("status", ["queued", "submitted", "processing"]);
        if (renderLookupError) throw renderLookupError;
        const falKey = Deno.env.get("FAL_KEY")?.trim();
        await Promise.all((activeRenders ?? []).map(async (render: {
          id: string;
          provider_model: string;
          provider_task_id: string | null;
        }) => {
          let cancellationStatus = "cancelled";
          let cancellationErrorMessage: string | null = null;
          if (render.provider_task_id && !falKey) {
            cancellationStatus = "failed";
            cancellationErrorMessage =
              "FAL_KEY is unavailable; provider cancellation could not be confirmed";
          } else if (render.provider_task_id && falKey) {
            try {
              await cancelFalKlingRequest({
                fetchFn: fetch,
                apiKey: falKey,
                model: render.provider_model,
                requestId: render.provider_task_id,
              });
            } catch (providerCancelError) {
              cancellationStatus = "failed";
              cancellationErrorMessage = providerCancelError instanceof Error
                ? providerCancelError.message
                : String(providerCancelError);
            }
          }
          const { error: renderCancelError } = await supabase
            .from("companion_cinema_renders")
            .update({
              status: cancellationStatus,
              error_code: cancellationErrorMessage
                ? "provider_cancel_failed"
                : "interaction_cancelled",
              error_message: cancellationErrorMessage,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", render.id);
          if (renderCancelError) throw renderCancelError;
        }));
      }

      if (action === "complete" && existingRun.interaction_type === "hunt") {
        const rewardRecord = reward as Record<string, unknown>;
        const { error: legacyError } = await supabase
          .from("companion_legacy_achievements")
          .upsert({
            user_id: user.id,
            companion_id: existingRun.companion_id,
            legacy_key: `hunt_${existingRun.id}`,
            title: rewardRecord.title ?? "Wayfinder Relic",
            description: rewardRecord.description ??
              "A relic recovered during a companion Hunt.",
            achievement_type: "hunt_relic",
            importance: 2,
            source_table: "companion_interaction_runs",
            source_record_id: existingRun.id,
            context_snapshot: { reward: rewardRecord, outcome },
          }, { onConflict: "companion_id,legacy_key" });
        if (legacyError) throw legacyError;
      }

      let queuedCompletionEventId: string | null = null;
      if (action === "complete" && existingRun.interaction_type === "hunt") {
        const { count: huntCount, error: huntCountError } = await supabase
          .from("companion_interaction_runs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("companion_id", existingRun.companion_id)
          .eq("interaction_type", "hunt")
          .eq("status", "completed");
        if (huntCountError) throw huntCountError;
        if (
          cinemaAvailable &&
          huntCount && huntCount % 5 === 0 &&
          !existingRun.completion_cinema_event_id
        ) {
          const companion = companionRelation as Record<string, unknown>;
          const mutationKey = `hunt_mastery_${huntCount}`;
          const rewardRecord = reward as Record<string, unknown>;
          const { error: mutationError } = await supabase
            .from("companion_visual_mutations")
            .upsert({
              user_id: user.id,
              companion_id: existingRun.companion_id,
              mutation_key: mutationKey,
              display_name: `${rewardRecord.title ?? "Wayfinder"} Mark`,
              mutation_type: "relic",
              visual_description:
                "A restrained elemental relic-mark carried on the companion’s armor or natural silhouette.",
              source_event_type: "hunt_milestone",
              source_event_id: existingRun.cinema_event_id,
              applied_from_level: Number(companion.current_stage ?? 1) + 1,
              metadata: { huntCount, reward: rewardRecord },
            }, { onConflict: "companion_id,mutation_key" });
          if (mutationError) throw mutationError;
          queuedCompletionEventId = await insertCinemaEventOnce(supabase, {
            user_id: user.id,
            companion_id: existingRun.companion_id,
            event_type: "ascension",
            event_key: mutationKey,
            category: "legendary",
            rarity: "legendary",
            status: "queued",
            lineage_revision: companion.cinema_lineage_revision ?? 1,
            title: `Hunt Mastery ${huntCount}`,
            reveal_copy:
              "A relic-mark has joined your companion’s permanent mythology.",
            source_table: "companion_interaction_runs",
            source_record_id: existingRun.id,
            context_snapshot: {
              ...(existingRun.context_snapshot ?? {}),
              reactionKind: "hunt_milestone",
              huntCount,
              reward: rewardRecord,
            },
            start_image_url: companion.current_image_url ??
              companion.initial_image_url,
            duration_seconds: 10,
            audio_strategy: "native",
            provider: "fal",
            provider_model: Deno.env.get("COSMIQ_CINEMA_VIDEO_MODEL")
              ?.trim() || DEFAULT_COMPANION_CINEMA_MODEL,
            priority: 175,
            max_render_attempts: 2,
            queued_at: new Date().toISOString(),
          });
        }
      }

      if (
        cinemaAvailable && action === "complete" &&
        existingRun.interaction_type === "watch" &&
        !existingRun.completion_cinema_event_id
      ) {
        const companion = companionRelation as Record<string, unknown>;
        const completionContext = {
          ...(existingRun.context_snapshot ?? {}),
          reactionKind: "watch_completed",
          outcome,
        };
        queuedCompletionEventId = await insertCinemaEventOnce(supabase, {
          user_id: user.id,
          companion_id: existingRun.companion_id,
          event_type: "reaction",
          event_key: `watch_complete_${existingRun.id}`,
          category: "reaction",
          rarity: "uncommon",
          status: "queued",
          lineage_revision: companion.cinema_lineage_revision ?? 1,
          title: "The Watch — Complete",
          reveal_copy: "The work is done. Your companion lowers its guard.",
          source_table: "companion_interaction_runs",
          source_record_id: existingRun.id,
          context_snapshot: completionContext,
          start_image_url: companion.current_image_url ??
            companion.initial_image_url,
          duration_seconds: 6,
          audio_strategy: "native",
          provider: "fal",
          provider_model: Deno.env.get("COSMIQ_CINEMA_VIDEO_MODEL")?.trim() ||
            DEFAULT_COMPANION_CINEMA_MODEL,
          priority: 160,
          max_render_attempts: 2,
          queued_at: new Date().toISOString(),
        });
      }
      if (queuedCompletionEventId) {
        const { error: completionLinkError } = await supabase
          .from("companion_interaction_runs")
          .update({ completion_cinema_event_id: queuedCompletionEventId })
          .eq("id", existingRun.id);
        if (completionLinkError) throw completionLinkError;
        await fetch(
          `${supabaseUrl}/functions/v1/process-companion-cinema-event`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              ...(Deno.env.get("INTERNAL_FUNCTION_SECRET")
                ? {
                  "x-internal-key": Deno.env.get(
                    "INTERNAL_FUNCTION_SECRET",
                  )!,
                }
                : { Authorization: authHeader }),
            },
            body: JSON.stringify({ eventId: queuedCompletionEventId }),
          },
        ).catch(() => null);
      }
      return new Response(
        JSON.stringify({
          run: run
            ? {
              ...run,
              completion_cinema_event_id: queuedCompletionEventId ??
                run.completion_cinema_event_id,
            }
            : null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action !== "start") throw new Error("Unsupported action");
    if (!cinemaAvailable) {
      const rolloutConfig = getCompanionCinemaRolloutConfig();
      return new Response(
        JSON.stringify({
          error: "Companion cinema is not available for this account yet.",
          code: rolloutConfig.enabled
            ? "cosmiq_cinema_rollout_ineligible"
            : "cosmiq_cinema_disabled",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!isInteractionType(body.interactionType)) {
      throw new Error("interactionType must be watch, hunt, or forge");
    }
    const interactionType = body.interactionType;
    const config = INTERACTION_CONFIG[interactionType];
    const intention = asText(body.intention, 500);
    if (interactionType === "forge" && !intention) {
      throw new Error("The Forge requires a named challenge");
    }

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("*")
      .eq("user_id", user.id)
      .eq("product_mode", "cosmiq")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (companionError) throw companionError;
    if (!companion || companion.current_stage < 1) {
      throw new Error("A hatched Cosmiq companion is required");
    }

    const { error: traitRefreshError } = await supabase.rpc(
      "refresh_companion_observed_traits_internal",
      { p_user_id: user.id, p_companion_id: companion.id },
    );
    if (traitRefreshError) throw traitRefreshError;

    const expectedMinutes = typeof body.expectedMinutes === "number" &&
        Number.isFinite(body.expectedMinutes)
      ? Math.max(1, Math.min(24 * 60, Math.round(body.expectedMinutes)))
      : config.expectedMinutes;
    const expectedCompleteAt = new Date(
      Date.now() + expectedMinutes * 60 * 1000,
    ).toISOString();
    const contextSnapshot = await buildContextSnapshot({
      supabase,
      companion,
      interactionType,
      intention,
    });
    const { data: startRows, error: startError } = await supabase.rpc(
      "start_companion_cinema_interaction_internal",
      {
        p_user_id: user.id,
        p_companion_id: companion.id,
        p_interaction_type: interactionType,
        p_title: config.title,
        p_reveal_copy: config.revealCopy,
        p_intention: intention,
        p_context_snapshot: contextSnapshot,
        p_expected_complete_at: expectedCompleteAt,
        p_duration_seconds: config.durationSeconds,
        p_provider_model: Deno.env.get("COSMIQ_CINEMA_VIDEO_MODEL")?.trim() ||
          DEFAULT_COMPANION_CINEMA_MODEL,
      },
    );
    if (startError) throw startError;
    const started = (startRows?.[0] ?? null) as CinemaStartRpcRow | null;
    if (!started) throw new Error("Cinema interaction did not start");
    const [{ data: run, error: runError }, { data: event, error: eventError }] =
      await Promise.all([
        supabase.from("companion_interaction_runs")
          .select(
            "id, interaction_type, status, title, intention, expected_complete_at, cinema_event_id, reward",
          )
          .eq("id", started.run_id)
          .single(),
        supabase.from("companion_cinema_events")
          .select("id, status, event_type, title, reveal_copy")
          .eq("id", started.event_id)
          .single(),
      ]);
    if (runError) throw runError;
    if (eventError) throw eventError;

    const processorResponse = await fetch(
      `${supabaseUrl}/functions/v1/process-companion-cinema-event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          ...(Deno.env.get("INTERNAL_FUNCTION_SECRET")
            ? { "x-internal-key": Deno.env.get("INTERNAL_FUNCTION_SECRET")! }
            : { Authorization: authHeader }),
        },
        body: JSON.stringify({ eventId: event.id }),
      },
    ).catch(() => null);

    return new Response(
      JSON.stringify({
        run,
        event,
        reused: started.reused,
        quota: {
          dailyRemaining: started.daily_remaining,
          monthlyRemaining: started.monthly_remaining,
        },
        processorStarted: processorResponse?.ok === true,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const mapped = mapCinemaError(message);
    console.error("manage-companion-cinema-interaction failed", error);
    return new Response(JSON.stringify({ error: mapped.message }), {
      status: mapped.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

if (import.meta.main) serve(handleManageCompanionCinemaInteraction);
