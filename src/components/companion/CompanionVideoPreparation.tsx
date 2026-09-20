import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useAccessState } from "@/hooks/useAccessState";
import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";
import { COMPANION_VIDEO_CATEGORIES, WELLBEING_PROMPT_VERSION } from "@/shared/companionWellbeing";
import { requestWellbeingClip } from "@/services/companionWellbeingVideo";

/** Mounted globally: preparation never depends on opening the companion tab.
 * Existing accounts are handled on their next app visit. The server owns the
 * unique appearance/category key, access checks and paid-generation limits.
 */
export function CompanionVideoPreparation() {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { accessState, isLoading } = useAccessState();
  const stage = getCurrentVisualStageBoundaryLevel(companion?.current_stage ?? 0);
  const sourceImageUrl = companion?.current_image_url ?? "";
  useQuery({
    queryKey: ["companion-video-preparation", WELLBEING_PROMPT_VERSION, user?.id, companion?.id, stage, sourceImageUrl],
    enabled: Boolean(user && companion && stage > 0 && sourceImageUrl && !isLoading && accessState.has_access),
    queryFn: async () => {
      const results = await Promise.allSettled(COMPANION_VIDEO_CATEGORIES.map((category) =>
        requestWellbeingClip({ action: "prepare", companionId: companion!.id, category, stage, sourceImageUrl })));
      // A temporary connection failure should not permanently suppress prewarming.
      // Repeating prepare only looks up the same durable jobs; it never retries paid failures.
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      return true;
    },
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    retryDelay: 60_000,
  });
  return null;
}
