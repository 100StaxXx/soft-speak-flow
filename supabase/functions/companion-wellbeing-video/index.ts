import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUserOrInternalRequest, jsonResponse } from "../_shared/auth.ts";
import { resolveUserProductMode } from "../_shared/notificationProduct.ts";
import { createCostGuardrailSession, isCostGuardrailBlockedError } from "../_shared/costGuardrails.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";
import {
  submitFalKlingVideo, getFalKlingQueueStatus, getFalKlingQueueResult, downloadFalVideo,
  COMPANION_ANIMATION_VIDEO_BUCKET, DEFAULT_FAL_KLING_MODEL,
} from "../_shared/falKlingVideoClient.ts";
import { buildWellbeingVideoPrompt, isWellbeingCategory, WELLBEING_PROMPT_VERSION, WELLBEING_VIDEO_SECONDS } from "../../../src/shared/companionWellbeing.ts";
import { getCurrentVisualStageBoundaryLevel } from "../../../src/config/progression.ts";

const TABLE = "cosmiq_wellbeing_videos";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-internal-key" };
const PUBLIC_COLUMNS = "id,status,video_url,category,stage,source_image_url,error_code";
const STATUS_COLUMNS = `${PUBLIC_COLUMNS},retry_count,provider_task_id`;
const reply = (status: number, body: Record<string, unknown>) => jsonResponse(status, body, cors);
const dbClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function trustedSourceImage(value: unknown, supabaseUrl: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const image = new URL(value);
    return image.protocol === "https:" && image.origin === new URL(supabaseUrl).origin
      && /^\/storage\/v1\/object\/public\/(companion-images|companion-presets)\/.+/.test(image.pathname)
      && !image.search && !image.hash;
  } catch { return false; }
}

export async function imageKey(url: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function retryMode(job: { status: string; retry_count?: number; error_code?: string; provider_task_id?: string | null }): "queued" | "processing" | null {
  if (job.status !== "failed" || (job.retry_count ?? 0) >= 1) return null;
  if (job.error_code === "preparation_timed_out" && job.provider_task_id) return "processing";
  if (["provider_failed", "video_unavailable", "budget_blocked"].includes(job.error_code ?? "")) return "queued";
  return null;
}
const publicClip = (job: any) => {
  const { provider_task_id: _provider, retry_count: _retries, ...clip } = job;
  return { ...clip, can_retry: retryMode(job) !== null };
};

export const deps = {
  authenticate: requireUserOrInternalRequest, database: dbClient,
  product: resolveUserProductMode, env: (name: string) => Deno.env.get(name),
  now: () => Date.now(), fetch: fetch,
  submit: submitFalKlingVideo, status: getFalKlingQueueStatus, result: getFalKlingQueueResult,
  download: downloadFalVideo, ledger: registerUserStorageAsset, guardrails: createCostGuardrailSession,
};
type Dependencies = typeof deps;

async function processOne(db: any, d: Dependencies) {
  const { data, error } = await db.rpc("claim_cosmiq_wellbeing_video");
  if (error) throw error;
  const job = data?.[0];
  if (!job) return;
  const save = async (patch: Record<string, unknown>) => {
    const { data: saved, error } = await db.from(TABLE).update({ ...patch, updated_at: new Date(d.now()).toISOString() })
      .eq("id", job.id).eq("lease_token", job.lease_token).select("id").maybeSingle();
    if (error || !saved) throw new Error("Lost wellbeing job lease");
  };
  const finish = (patch: Record<string, unknown>) => save({ ...patch, lease_until: null, lease_token: null });
  // A worker can die after a paid POST but before storing the request id. Never blindly resubmit.
  if (job.status === "submitting" && !job.provider_task_id) {
    await finish({ status: "failed", error_code: "submission_needs_review" });
    return;
  }
  if (d.now() > Date.parse(job.deadline_at)) {
    await finish({ status: "failed", error_code: "preparation_timed_out" });
    return;
  }
  try {
    if (await d.product(db, job.user_id) !== "cosmiq") {
      await finish({ status: "failed", error_code: "wrong_product" }); return;
    }
    const apiKey = d.env("FAL_KEY") || d.env("FAL_API_KEY");
    if (!apiKey) { await finish({ status: "failed", error_code: "video_unavailable" }); return; }
    const fetchFn: typeof fetch = (input, init) => d.fetch(input, { ...init, signal: AbortSignal.timeout(40_000) });
    if (!job.provider_task_id) {
      const { data: companion, error } = await db.from("user_companion").select("current_stage,current_image_url,product_mode")
        .eq("id", job.companion_id).eq("user_id", job.user_id).maybeSingle();
      if (error) throw error;
      if (!companion || companion.product_mode === "graceward"
        || getCurrentVisualStageBoundaryLevel(companion.current_stage) !== job.stage
        || companion.current_image_url !== job.source_image_url) {
        await finish({ status: "failed", error_code: "appearance_changed" }); return;
      }
      const guard = d.guardrails({ supabase: db, userId: job.user_id, endpointKey: "companion-wellbeing-video", featureKey: "cosmiq_wellbeing_video" });
      await save({ status: "submitting" });
      job.status = "submitting";
      const submitted = await d.submit({ fetchFn: guard.wrapFetch(fetchFn), apiKey, model: job.provider_model,
        imageUrl: job.source_image_url, prompt: job.prompt, durationSeconds: WELLBEING_VIDEO_SECONDS });
      // Persist the task id before any subsequent network work.
      await finish({ status: "processing", provider_task_id: submitted.requestId,
        next_poll_at: new Date(d.now() + 30_000).toISOString() });
      return;
    }
    const args = { fetchFn, apiKey, model: job.provider_model, requestId: job.provider_task_id };
    const status = await d.status(args);
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      await finish({ status: "failed", error_code: "provider_failed" }); return;
    }
    if (status.status !== "COMPLETED") {
      await finish({ status: "processing", next_poll_at: new Date(d.now() + 30_000).toISOString() }); return;
    }
    const result = await d.result(args);
    if (!result.videoUrl) throw new Error("Video not available yet");
    const { bytes, contentType } = await d.download({ fetchFn, videoUrl: result.videoUrl });
    if (!contentType.startsWith("video/") || bytes.byteLength > 30 * 1024 * 1024) throw new Error("Invalid video asset");
    const path = `${job.user_id}/wellbeing/${job.id}.mp4`;
    const { error: uploadError } = await db.storage.from(COMPANION_ANIMATION_VIDEO_BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;
    await d.ledger({ supabase: db, userId: job.user_id, bucketId: COMPANION_ANIMATION_VIDEO_BUCKET,
      storagePath: path, sourceKind: "cosmiq_wellbeing_video", sourceRecordTable: TABLE, sourceRecordId: job.id });
    const { data: publicAsset } = db.storage.from(COMPANION_ANIMATION_VIDEO_BUCKET).getPublicUrl(path);
    await finish({ status: "succeeded", video_url: publicAsset.publicUrl, error_code: null });
  } catch (error) {
    // Only reads/uploads may retry automatically. A paid submission is at-most-once.
    await finish(job.status === "submitting" && !job.provider_task_id
      ? { status: "failed", error_code: isCostGuardrailBlockedError(error) ? "budget_blocked" : "submission_needs_review" }
      : { next_poll_at: new Date(d.now() + 60_000).toISOString() });
  }
}

export async function handleWellbeingVideo(req: Request, d: Dependencies = deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const auth = await d.authenticate(req, cors);
  if (auth instanceof Response) return auth;
  try {
    const db = d.database();
    if (auth.isInternal) {
      await Promise.all(Array.from({ length: 3 }, () => processOne(db, d)));
      return reply(200, { ok: true });
    }
    if (await d.product(db, auth.userId) !== "cosmiq") return reply(403, { error: "This feature belongs to Cosmiq." });
    let body;
    try { body = await req.json(); } catch { return reply(400, { error: "Invalid request" }); }
    if (!body || typeof body.companionId !== "string" || !isWellbeingCategory(body.category)) return reply(400, { error: "Choose Mind, Body, or Soul." });
    const { data: companion, error } = await db.from("user_companion")
      .select("id,current_stage,current_image_url,core_element,product_mode").eq("id", body.companionId).eq("user_id", auth.userId).maybeSingle();
    if (error) throw error;
    if (!companion) return reply(404, { error: "Companion not found" });
    if (companion.product_mode === "graceward") return reply(403, { error: "This feature belongs to Cosmiq." });
    const stage = getCurrentVisualStageBoundaryLevel(companion.current_stage);
    if (!stage || stage !== body.stage || companion.current_image_url !== body.sourceImageUrl) return reply(409, { error: "Your companion changed. Reopen this selection." });
    if (!trustedSourceImage(companion.current_image_url, d.env("SUPABASE_URL")!)) return reply(409, { error: "Your companion portrait is not ready for video yet." });
    const sourceKey = await imageKey(companion.current_image_url);
    const lookup = () => db.from(TABLE).select(STATUS_COLUMNS).eq("user_id", auth.userId).eq("companion_id", companion.id)
      .eq("stage", stage).eq("category", body.category).eq("source_key", sourceKey).eq("prompt_version", WELLBEING_PROMPT_VERSION).maybeSingle();
    const existing = await lookup();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const mode = retryMode(existing.data);
      if (body.action === "retry" && mode) {
        // Compare-and-swap makes concurrent retry taps a single retry. Poll timeouts
        // retain their provider id; only definitively failed/unsubmitted work can resubmit.
        const { error } = await db.from(TABLE).update({ status: mode, retry_count: 1, error_code: null,
          ...(mode === "queued" ? { provider_task_id: null } : {}),
          deadline_at: new Date(d.now() + 30 * 60_000).toISOString(), next_poll_at: new Date(d.now()).toISOString(),
        }).eq("id", existing.data.id).eq("user_id", auth.userId).eq("status", "failed").eq("retry_count", 0);
        if (error) throw error;
        const retried = await lookup();
        if (retried.error || !retried.data) throw new Error("Retry status unavailable");
        return reply(200, { clip: publicClip(retried.data) });
      }
      return reply(200, { clip: publicClip(existing.data) });
    }
    if (body.action === "status") return reply(200, { clip: null });
    if (body.action !== "prepare") return reply(400, { error: "Invalid action" });
    if (!(d.env("FAL_KEY") || d.env("FAL_API_KEY"))) return reply(503, { error: "Animations are temporarily unavailable. Your activities still work." });
    const { count, error: countError } = await db.from(TABLE).select("id", { count: "exact", head: true }).eq("user_id", auth.userId)
      .gte("created_at", new Date(d.now() - 86400_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 6) return reply(429, { error: "Your next animations can be prepared tomorrow. Saved clips still play." });
    const { error: insertError } = await db.from(TABLE).upsert({ user_id: auth.userId, companion_id: companion.id,
      stage, category: body.category, source_image_url: companion.current_image_url, source_key: sourceKey,
      prompt_version: WELLBEING_PROMPT_VERSION, provider_model: DEFAULT_FAL_KLING_MODEL,
      prompt: buildWellbeingVideoPrompt(stage, body.category, companion.core_element ?? ""),
    }, { onConflict: "companion_id,stage,category,source_key,prompt_version", ignoreDuplicates: true });
    if (insertError) throw insertError;
    const saved = await lookup();
    if (saved.error || !saved.data) throw new Error("Queue save failed");
    return reply(200, { clip: publicClip(saved.data) });
  } catch {
    return reply(503, { error: "Animations are temporarily unavailable. Your activities still work." });
  }
}

if (import.meta.main) serve((req) => handleWellbeingVideo(req));
