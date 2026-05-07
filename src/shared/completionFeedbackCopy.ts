export type CompletionFeedbackCopyTone =
  | "proud"
  | "locked_in"
  | "recovery"
  | "calm"
  | "hype";

export type CompletionFeedbackCopyBucket =
  | "all_rituals_complete"
  | "ritual_campaign"
  | "overdue_recovery"
  | "late_night_hard"
  | "first_win"
  | "momentum_run"
  | "overloaded_day"
  | "campaign_quest"
  | "generic";

export interface CompletionFeedbackCopyContext {
  taskId?: string | null;
  title?: string | null;
  campaignTitle?: string | null;
  completedAt?: string | null;
  completionSource?: "quest" | "ritual" | "inbox" | null;
  isRitual?: boolean;
  completedAllRituals?: boolean;
  wasOverdue?: boolean;
  isLateNight?: boolean;
  isDifficult?: boolean;
  firstCompletionToday?: boolean;
  isBuildingMomentum?: boolean;
  isOverloaded?: boolean;
}

export interface CompletionFeedbackCopy {
  message: string;
  tone: CompletionFeedbackCopyTone;
  bucket: CompletionFeedbackCopyBucket;
  generationSource: "fallback";
}

interface CompletionTemplateContext {
  title: string;
  campaign: string | null;
}

interface CompletionTemplatePool {
  tone: CompletionFeedbackCopyTone;
  templates: Array<(context: CompletionTemplateContext) => string>;
}

const cleanCopyText = (value: string | null | undefined, fallback = ""): string => {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const stableIndex = (seed: string, length: number): number => {
  if (length <= 1) return 0;

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % length;
};

const buildSeed = (
  context: CompletionFeedbackCopyContext,
  bucket: CompletionFeedbackCopyBucket,
  title: string,
  campaign: string | null,
): string =>
  [
    bucket,
    cleanCopyText(context.taskId, title),
    cleanCopyText(context.completedAt, "no-completed-at"),
    campaign ?? "no-campaign",
  ].join(":");

export const selectCompletionFeedbackBucket = (
  context: CompletionFeedbackCopyContext,
): CompletionFeedbackCopyBucket => {
  const campaign = cleanCopyText(context.campaignTitle);
  const isRitual = context.isRitual === true || context.completionSource === "ritual";

  if (context.completedAllRituals === true && campaign) return "all_rituals_complete";
  if (isRitual && campaign) return "ritual_campaign";
  if (context.wasOverdue === true) return "overdue_recovery";
  if (context.isLateNight === true && context.isDifficult === true) return "late_night_hard";
  if (context.firstCompletionToday === true) return "first_win";
  if (context.isBuildingMomentum === true) return "momentum_run";
  if (context.isOverloaded === true) return "overloaded_day";
  if (campaign) return "campaign_quest";
  return "generic";
};

const TEMPLATE_POOLS: Record<CompletionFeedbackCopyBucket, CompletionTemplatePool> = {
  all_rituals_complete: {
    tone: "hype",
    templates: [
      ({ campaign }) => `${campaign} is clear for today. That is a clean sweep.`,
      ({ campaign }) => `All rituals for ${campaign} are handled. Momentum is on your side.`,
      ({ campaign }) => `${campaign} just got a full set. Strong rhythm.`,
      ({ campaign }) => `Every ritual for ${campaign} is complete. The day has weight now.`,
      ({ campaign }) => `${campaign} is fully fed today. Keep that signal alive.`,
      ({ campaign }) => `Full ritual chain complete for ${campaign}. That is real traction.`,
      ({ campaign }) => `${campaign} has no loose rituals left today. Clean work.`,
      ({ campaign }) => `That closes the ritual loop for ${campaign}. The campaign feels sharper.`,
    ],
  },
  ritual_campaign: {
    tone: "locked_in",
    templates: [
      ({ title, campaign }) => `${title} is complete. ${campaign} gained ground.`,
      ({ title, campaign }) => `${title} landed. ${campaign} is a little more real now.`,
      ({ title, campaign }) => `${title} is done. ${campaign} has another brick in place.`,
      ({ title, campaign }) => `${title} checked off. ${campaign} kept its pulse.`,
      ({ title, campaign }) => `${title} is complete. ${campaign} moved forward.`,
      ({ title, campaign }) => `${title} is handled. ${campaign} stayed in motion.`,
      ({ title, campaign }) => `${title} is done. That keeps ${campaign} honest.`,
      ({ title, campaign }) => `${title} cleared. ${campaign} has more gravity now.`,
      ({ title, campaign }) => `${title} is in the books. ${campaign} held the line.`,
      ({ title, campaign }) => `${title} is complete. ${campaign} just got steadier.`,
    ],
  },
  overdue_recovery: {
    tone: "recovery",
    templates: [
      ({ title, campaign }) => campaign
        ? `${title} is back on track for ${campaign}. That counts.`
        : `${title} is back on track. That counts.`,
      ({ title, campaign }) => campaign
        ? `You recovered ${title} for ${campaign}. Strong save.`
        : `You recovered ${title}. Strong save.`,
      ({ title, campaign }) => campaign
        ? `${title} slipped, then got handled. ${campaign} stays alive.`
        : `${title} slipped, then got handled. Good recovery.`,
      ({ title }) => `${title} is done after the delay. No drama, just progress.`,
      ({ title, campaign }) => campaign
        ? `${title} is complete. ${campaign} did not lose the thread.`
        : `${title} is complete. You did not lose the thread.`,
      ({ title }) => `Late is not lost. ${title} is complete.`,
      ({ title, campaign }) => campaign
        ? `${title} is off the recovery list. ${campaign} can breathe.`
        : `${title} is off the recovery list. Breathe easier.`,
      ({ title }) => `${title} got pulled back into orbit. Solid reset.`,
    ],
  },
  late_night_hard: {
    tone: "locked_in",
    templates: [
      ({ title }) => `Late-night discipline on ${title}. That standard is visible.`,
      ({ title }) => `${title} is done at the hard hour. Quiet power.`,
      ({ title }) => `You handled ${title} when it would have been easy to fold.`,
      ({ title }) => `${title} is complete. That is late-night resolve.`,
      ({ title }) => `Hard task, late hour, still done. ${title} counts double in spirit.`,
      ({ title }) => `${title} cleared under low light. That is the standard showing up.`,
      ({ title }) => `You stayed with ${title}. The night did not get the last word.`,
      ({ title }) => `${title} is done. Discipline kept the room lit.`,
    ],
  },
  first_win: {
    tone: "proud",
    templates: [
      ({ title, campaign }) => campaign
        ? `First win of the day: ${title}. ${campaign} has a pulse.`
        : `First win of the day: ${title}. Clean start.`,
      ({ title }) => `${title} is done. The day has its first signal.`,
      ({ title, campaign }) => campaign
        ? `${title} opens the day. ${campaign} is awake.`
        : `${title} opens the day. Good first spark.`,
      ({ title }) => `First completion locked: ${title}. Now the day knows you are here.`,
      ({ title, campaign }) => campaign
        ? `${title} is complete. First mark on ${campaign} today.`
        : `${title} is complete. First mark on the board.`,
      ({ title }) => `${title} landed first. Nice way to take the wheel.`,
      ({ title }) => `The day starts with proof: ${title} is done.`,
      ({ title, campaign }) => campaign
        ? `${title} is handled. ${campaign} starts with momentum.`
        : `${title} is handled. Momentum has an opening.`,
    ],
  },
  momentum_run: {
    tone: "locked_in",
    templates: [
      ({ title }) => `${title} is done. The run is starting to look intentional.`,
      ({ title }) => `${title} cleared. That completion streak has a pulse.`,
      ({ title }) => `${title} is complete. Momentum is getting harder to ignore.`,
      ({ title }) => `Another one down: ${title}. The rhythm is real.`,
      ({ title }) => `${title} is handled. You are stacking evidence now.`,
      ({ title }) => `${title} landed. The day is starting to tilt your way.`,
      ({ title }) => `${title} is done. Keep this current moving.`,
      ({ title }) => `${title} cleared. The pattern is getting stronger.`,
    ],
  },
  overloaded_day: {
    tone: "calm",
    templates: [
      ({ title }) => `${title} is off the board. One less thing pulling at you.`,
      ({ title }) => `${title} is done. The day just got a little quieter.`,
      ({ title }) => `${title} cleared. More space, less noise.`,
      ({ title }) => `${title} is complete. That load is lighter now.`,
      ({ title }) => `You took ${title} out of the pile. Good pressure release.`,
      ({ title }) => `${title} is handled. The list lost some teeth.`,
      ({ title }) => `${title} is done. The day has more room to breathe.`,
      ({ title }) => `${title} cleared. Keep making the field simpler.`,
    ],
  },
  campaign_quest: {
    tone: "proud",
    templates: [
      ({ title, campaign }) => `${title} is done. Quiet progress toward ${campaign}.`,
      ({ title, campaign }) => `${title} landed. ${campaign} is taking shape.`,
      ({ title, campaign }) => `${title} is complete. ${campaign} has another signal.`,
      ({ title, campaign }) => `${title} is handled. ${campaign} feels closer.`,
      ({ title, campaign }) => `${title} cleared. ${campaign} kept its direction.`,
      ({ title, campaign }) => `${title} is done. ${campaign} got a little more real.`,
      ({ title, campaign }) => `${title} is complete. Good pressure on ${campaign}.`,
      ({ title, campaign }) => `${title} landed. ${campaign} has more structure now.`,
      ({ title, campaign }) => `${title} is off the board. ${campaign} stays in motion.`,
      ({ title, campaign }) => `${title} is done. Another clean mark for ${campaign}.`,
    ],
  },
  generic: {
    tone: "proud",
    templates: [
      ({ title }) => `${title} is done. That is real progress.`,
      ({ title }) => `${title} landed. Good work staying with it.`,
      ({ title }) => `${title} is complete. Another signal that you follow through.`,
      ({ title }) => `${title} cleared. The day is stronger for it.`,
      ({ title }) => `${title} is handled. Keep the line moving.`,
      ({ title }) => `${title} is off the board. Solid finish.`,
      ({ title }) => `${title} is done. Proof beats intention.`,
      ({ title }) => `${title} landed. That one counts.`,
      ({ title }) => `${title} is complete. Clean, steady progress.`,
      ({ title }) => `${title} cleared. You made it real.`,
    ],
  },
};

export const buildCompletionFeedbackCopy = (
  context: CompletionFeedbackCopyContext,
): CompletionFeedbackCopy => {
  const title = cleanCopyText(context.title, "this quest");
  const campaign = cleanCopyText(context.campaignTitle) || null;
  const bucket = selectCompletionFeedbackBucket(context);
  const pool = TEMPLATE_POOLS[bucket];
  const seed = buildSeed(context, bucket, title, campaign);
  const template = pool.templates[stableIndex(seed, pool.templates.length)] ?? pool.templates[0];

  return {
    message: template({ title, campaign }),
    tone: pool.tone,
    bucket,
    generationSource: "fallback",
  };
};
