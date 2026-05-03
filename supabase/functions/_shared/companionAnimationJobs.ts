// Helper for enqueueing Kling image-to-video jobs after a companion evolution.
// The job source image MUST be the page/scenic current_image_url, never the
// launcher icon — Kling needs the full scenic frame to produce a believable
// reveal animation.

const COMPANION_KLING_LIFETIME_CAP = 10;

export interface MaybeEnqueueArgs {
  supabase: any;
  companionId: string;
  evolutionId: string | null;
  userId: string;
  sourceImageUrl: string | null;
  portraitRegenerated: boolean;
  stage: number;
  prompt?: string | null;
  info?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
}

function isFeatureEnabled(): boolean {
  // Default OFF — operators must explicitly opt in once FAL_KEY is provisioned.
  const raw = (Deno.env.get("COMPANION_KLING_ENABLED") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function maybeEnqueueCompanionAnimationJob(args: MaybeEnqueueArgs): Promise<void> {
  const {
    supabase,
    companionId,
    evolutionId,
    userId,
    sourceImageUrl,
    portraitRegenerated,
    stage,
    prompt,
    info = () => {},
    warn = () => {},
  } = args;

  try {
    if (!isFeatureEnabled()) {
      info("[CompanionAnimation] Kling feature disabled; skipping enqueue", { companionId, stage });
      return;
    }

    if (!sourceImageUrl) {
      warn("[CompanionAnimation] Missing source image; skipping enqueue", { companionId, stage });
      return;
    }

    // Eligibility: only when a brand-new portrait actually exists (boundary
    // stages 1/16/31/...) so we never burn Kling cycles on reused art.
    const eligible = portraitRegenerated || stage === 1;
    if (!eligible) {
      info("[CompanionAnimation] Stage not eligible for animation", {
        companionId,
        stage,
        portraitRegenerated,
      });
      return;
    }

    // Hard 10-video lifetime cap per companion. Counts every job ever queued
    // for the companion, regardless of outcome (succeeded/failed/skipped).
    const { count, error: countError } = await supabase
      .from("companion_animation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("companion_id", companionId);
    if (countError) {
      warn("[CompanionAnimation] Failed to count existing jobs", {
        companionId,
        message: countError.message,
      });
      return;
    }
    if ((count ?? 0) >= COMPANION_KLING_LIFETIME_CAP) {
      info("[CompanionAnimation] Lifetime cap reached", {
        companionId,
        count,
        cap: COMPANION_KLING_LIFETIME_CAP,
      });
      return;
    }

    // Mirror the pending state to companion_evolutions immediately so the UI
    // can subscribe and swap to video the moment the cron drainer finishes.
    if (evolutionId) {
      const { error: evoError } = await supabase
        .from("companion_evolutions")
        .update({
          animation_status: "pending",
          animation_provider: "fal-kling-v3",
          animation_error: null,
        })
        .eq("id", evolutionId);
      if (evoError) {
        warn("[CompanionAnimation] Failed to mark evolution pending", {
          evolutionId,
          message: evoError.message,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("companion_animation_jobs")
      .insert({
        companion_id: companionId,
        evolution_id: evolutionId,
        user_id: userId,
        source_image_url: sourceImageUrl,
        prompt: prompt ?? null,
        provider: "fal-kling-v3",
        provider_model: "fal-ai/kling-video/v3/standard/image-to-video",
        status: "pending",
      });

    if (insertError) {
      // Unique-violation on evolution_id means the job already exists — that's a no-op.
      if (typeof insertError.code === "string" && insertError.code === "23505") {
        info("[CompanionAnimation] Job already exists for evolution", { evolutionId });
        return;
      }
      warn("[CompanionAnimation] Failed to enqueue job", {
        companionId,
        evolutionId,
        message: insertError.message,
      });
      return;
    }

    info("[CompanionAnimation] Job enqueued", { companionId, evolutionId, stage });
  } catch (error) {
    // Never let an enqueue failure bubble up — the evolution itself must succeed.
    const message = error instanceof Error ? error.message : String(error);
    warn("[CompanionAnimation] Unexpected enqueue error", { companionId, message });
  }
}

export const __testables = {
  COMPANION_KLING_LIFETIME_CAP,
  isFeatureEnabled,
};
