import { supabase } from "@/integrations/supabase/client";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import { WELLBEING_PROMPT_VERSION, type CompanionVideoCategory } from "@/shared/companionWellbeing";

export interface WellbeingClip {
  status: "not_generated" | "awaiting_portrait" | "queued" | "submitting" | "processing" | "succeeded" | "failed";
  video_url: string | null;
  scene_image_url?: string | null;
  duration_seconds?: number;
  prompt_version?: number;
  can_retry?: boolean;
  error_code?: string | null;
}
export const WELLBEING_MESSAGES: Record<string, string> = {
  access_required: "An active trial or subscription is needed to prepare new videos. Your activities are still available.",
  upgrade_required: "Update Cosmiq to prepare the new companion moments. Your activities are still available.",
  rate_limited: "New videos can be prepared tomorrow. Your saved videos and activities are still available.",
  appearance_changed: "Your companion has changed. Reopen these ideas to use the new form.",
  service_unavailable: "The animation service is temporarily unavailable. Your activities are still available.",
  portrait_unavailable: "This portrait isn’t ready for video generation. Your activities are still available.",
  budget_blocked: "Video preparation is temporarily paused. Your activities are still available.",
  preparation_timed_out: "Your video is taking longer to prepare. You can check it again without starting a new video.",
};

/** Checking preparation is separate from loading/playing an already-generated video. */
export async function requestWellbeingClip(input: {
  action: "prepare" | "status" | "retry"; companionId: string;
  category: CompanionVideoCategory; stage: number; sourceImageUrl: string;
}): Promise<WellbeingClip> {
  const { data, error } = await supabase.functions.invoke("companion-wellbeing-video", {
    body: { ...input, promptVersion: WELLBEING_PROMPT_VERSION }, timeout: 20000,
  });
  if (error || data?.error) {
    const parsed = error ? await parseFunctionInvokeError(error) : null;
    const code = data?.code ?? parsed?.code;
    const status = parsed?.status;
    if (code === "portrait_pending") return { status: "awaiting_portrait", video_url: null };
    const message = WELLBEING_MESSAGES[code]
      ?? (status === 401 ? "Your session is reconnecting. Try checking the animation again in a moment."
        : status === 403 ? "Video preparation isn’t available for this account right now. Your activities are still available."
        : status === 429 ? WELLBEING_MESSAGES.rate_limited
        : status === 409 ? WELLBEING_MESSAGES.appearance_changed
        : "Couldn't check video preparation. Check your connection and try again. Your activities are still available.");
    throw new Error(message);
  }
  return data?.clip ?? { status: "not_generated", video_url: null };
}
