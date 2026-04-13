import { toast as sonnerToast } from "@/components/ui/sonner";
import { resolveProgressionLevelFromXp } from "@/config/progression";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const MISSION_COMPLETION_UNAVAILABLE_MESSAGE =
  "Mission completion is temporarily unavailable while the app updates. Please try again in a minute.";

export type MissionCompletionSource = "manual" | "auto_complete";

export type CompleteDailyMissionWithXpResult =
  Database["public"]["Functions"]["complete_daily_mission_with_xp"]["Returns"][number];

export class MissionCompletionError extends Error {
  kind: "already_completed" | "failed" | "infrastructure";

  constructor(message: string, kind: "already_completed" | "failed" | "infrastructure") {
    super(message);
    this.name = "MissionCompletionError";
    this.kind = kind;
  }
}

type CompleteDailyMissionWithXpParams = {
  missionId: string;
  completionSource?: MissionCompletionSource;
  progressCurrent?: number | null;
};

type SupabaseRpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const normalizeMissionCompletionErrorSource = (error: SupabaseRpcErrorLike | null | undefined) =>
  [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

export const isMissionCompletionRpcUnavailableError = (
  error: SupabaseRpcErrorLike | null | undefined,
) => {
  if (!error) return false;
  if (error.code === "42883") return true;

  const normalizedSource = normalizeMissionCompletionErrorSource(error);
  return (
    normalizedSource.includes("complete_daily_mission_with_xp")
    && (
      normalizedSource.includes("could not find function")
      || normalizedSource.includes("schema cache")
      || normalizedSource.includes("does not exist")
      || normalizedSource.includes("undefined function")
      || normalizedSource.includes("function not found")
    )
  );
};

const toMissionCompletionError = (error: unknown) => {
  if (error instanceof MissionCompletionError) {
    return error;
  }

  if (isMissionCompletionRpcUnavailableError(error as SupabaseRpcErrorLike | null | undefined)) {
    return new MissionCompletionError(MISSION_COMPLETION_UNAVAILABLE_MESSAGE, "infrastructure");
  }

  if (error instanceof Error) {
    return new MissionCompletionError(error.message, "failed");
  }

  return new MissionCompletionError("Unable to complete this mission right now.", "failed");
};

export const completeDailyMissionWithXp = async ({
  missionId,
  completionSource = "manual",
  progressCurrent = null,
}: CompleteDailyMissionWithXpParams): Promise<CompleteDailyMissionWithXpResult> => {
  const { data, error } = await supabase.rpc("complete_daily_mission_with_xp", {
    p_completion_source: completionSource,
    p_mission_id: missionId,
    p_progress_current: progressCurrent,
  });

  if (error) throw toMissionCompletionError(error);

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    throw new MissionCompletionError("Mission completion returned no data.", "failed");
  }

  return result;
};

export const getMissionCompletionError = (
  result: Pick<CompleteDailyMissionWithXpResult, "status" | "message">,
) => {
  const message =
    result.message
    ?? (result.status === "already_completed"
      ? "XP has already been claimed for this mission."
      : "Unable to complete this mission right now.");

  return new MissionCompletionError(
    message,
    result.status === "already_completed" ? "already_completed" : "failed",
  );
};

export const showMissionRewardFeedback = (
  result: CompleteDailyMissionWithXpResult,
  showXPToast: (xp: number, reason: string) => void,
  displayReason: string,
) => {
  if (result.xp_awarded > 0) {
    showXPToast(result.xp_awarded, displayReason);
  }

  const claimedStage = typeof result.claimed_stage_after === "number"
    ? result.claimed_stage_after
    : 0;
  const earnedLevelBefore = resolveProgressionLevelFromXp(result.xp_before ?? 0);
  const earnedLevelAfter = typeof result.earned_level_after === "number"
    ? result.earned_level_after
    : typeof result.level_after === "number"
      ? result.level_after
      : resolveProgressionLevelFromXp(result.xp_after ?? result.xp_before ?? 0);
  const pendingEvolutionCount = typeof result.pending_evolution_count === "number"
    ? result.pending_evolution_count
    : Math.max(earnedLevelAfter - claimedStage, 0);
  const shouldEvolve = Boolean(result.should_evolve ?? pendingEvolutionCount > 0);

  if (shouldEvolve && earnedLevelAfter > earnedLevelBefore) {
    const nextClaimedLevel = claimedStage + 1;
    const extraReadyCopy = pendingEvolutionCount > 1
      ? ` ${pendingEvolutionCount} evolutions are ready.`
      : "";

    sonnerToast.success(`Ready to evolve to Stage ${nextClaimedLevel}.${extraReadyCopy}`);
  }
};
