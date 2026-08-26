import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export type DailyEncouragementEvent = "opened" | "started" | "progress" | "completed";

const log = logger.scope("DailyEncouragementHistory");

export const DAILY_ENCOURAGEMENT_PROGRESS_MILESTONES = [0.25, 0.5, 0.8] as const;

export const getNextDailyEncouragementMilestone = (
  progress: number,
  recordedMilestones: ReadonlySet<number>,
): number | null => {
  if (!Number.isFinite(progress) || progress <= 0) return null;

  for (const milestone of DAILY_ENCOURAGEMENT_PROGRESS_MILESTONES) {
    if (progress >= milestone && !recordedMilestones.has(milestone)) {
      return milestone;
    }
  }

  return null;
};

export const recordDailyEncouragementProgress = async (
  dailyPepTalkId: string,
  event: DailyEncouragementEvent,
  progress = 0,
): Promise<boolean> => {
  if (!dailyPepTalkId) return false;

  const normalizedProgress = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;

  const { error } = await supabase.rpc("record_daily_encouragement_progress", {
    p_daily_pep_talk_id: dailyPepTalkId,
    p_event: event,
    p_progress: normalizedProgress,
  });

  if (error) {
    log.warn("Unable to record daily encouragement progress", {
      dailyPepTalkId,
      event,
      progress: normalizedProgress,
      error: error.message,
    });
    return false;
  }

  return true;
};
