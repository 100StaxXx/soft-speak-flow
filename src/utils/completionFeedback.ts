import type {
  CompletionCompanionTone,
  CompletionFeedbackEvent,
  CompletionFeedbackResponse,
} from "@/types/completionFeedback";

const VALID_TONES = new Set<CompletionCompanionTone>([
  "proud",
  "locked_in",
  "recovery",
  "calm",
  "hype",
]);

const cleanText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

export const trimCompletionFeedbackLine = (value: string, maxLength = 150): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}.`;
};

const parseMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const isProbablyOverdue = (event: CompletionFeedbackEvent, now = new Date()): boolean => {
  const today = now.toISOString().slice(0, 10);
  if (event.taskDate && event.taskDate < today) return true;
  if (event.taskDate && event.taskDate > today) return false;

  const scheduledMinutes = parseMinutes(event.scheduledTime);
  if (scheduledMinutes === null) return false;

  const completedMinutes = now.getHours() * 60 + now.getMinutes();
  return completedMinutes - scheduledMinutes >= 45;
};

export const buildCompletionFeedbackFallback = (
  event: CompletionFeedbackEvent,
  now = new Date(),
): CompletionFeedbackResponse => {
  const title = cleanText(event.taskTitle) ?? "this quest";
  const campaign = cleanText(event.epicTitle);
  const source = event.completionSource ?? (event.habitSourceId ? "ritual" : "quest");
  const lateNight = now.getHours() >= 22 || now.getHours() < 5;
  const difficult = event.difficulty?.toLowerCase() === "hard";
  const overdue = isProbablyOverdue(event, now);

  let tone: CompletionCompanionTone = "proud";
  let message: string;

  if (event.completedAllRituals && campaign) {
    tone = "hype";
    message = `All rituals for ${campaign} are handled. That is momentum you can feel.`;
  } else if (source === "ritual" && campaign) {
    tone = "locked_in";
    message = `${title} is complete. ${campaign} just moved forward.`;
  } else if (overdue && campaign) {
    tone = "recovery";
    message = `You brought ${title} back on track for ${campaign}. That counts.`;
  } else if (overdue) {
    tone = "recovery";
    message = `You got ${title} done even after it slipped. Strong recovery.`;
  } else if (lateNight && difficult) {
    tone = "locked_in";
    message = `Late-night discipline on ${title}. That is the standard showing up.`;
  } else if (campaign) {
    tone = "proud";
    message = `${title} is done. Quiet progress toward ${campaign}.`;
  } else {
    tone = "proud";
    message = `${title} is done. That is real progress.`;
  }

  return {
    companion: {
      message: trimCompletionFeedbackLine(message),
      tone,
    },
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const normalizeCompletionFeedbackResponse = (
  value: unknown,
): CompletionFeedbackResponse | null => {
  const root = asRecord(value);
  const companion = asRecord(root?.companion);
  const message = cleanText(companion?.message);
  const tone = companion?.tone;

  if (!message || typeof tone !== "string" || !VALID_TONES.has(tone as CompletionCompanionTone)) {
    return null;
  }

  const mentorRecord = asRecord(root?.mentor);
  const mentorMessage = cleanText(mentorRecord?.message);
  const mentorPersonality = cleanText(mentorRecord?.personality);
  const mentor = mentorRecord?.show === true && mentorMessage && mentorPersonality
    ? {
        show: true,
        personality: trimCompletionFeedbackLine(mentorPersonality, 72),
        message: trimCompletionFeedbackLine(mentorMessage),
      }
    : undefined;

  const followUpRecord = asRecord(root?.followUp);
  const followUpLabel = cleanText(followUpRecord?.label);
  const followUpAction = cleanText(followUpRecord?.action);

  return {
    companion: {
      message: trimCompletionFeedbackLine(message),
      tone: tone as CompletionCompanionTone,
    },
    ...(mentor ? { mentor } : {}),
    ...(followUpLabel && followUpAction
      ? { followUp: { label: followUpLabel, action: followUpAction } }
      : {}),
  };
};
