import type {
  CompletionCompanionTone,
  CompletionFeedbackEvent,
  CompletionFeedbackGenerationSource,
  CompletionFeedbackResponse,
} from "@/types/completionFeedback";
import { buildCompletionFeedbackCopy } from "@/shared/completionFeedbackCopy";

const VALID_TONES = new Set<CompletionCompanionTone>([
  "proud",
  "locked_in",
  "recovery",
  "calm",
  "hype",
]);

const VALID_GENERATION_SOURCES = new Set<CompletionFeedbackGenerationSource>([
  "fallback",
  "ai",
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
  const feedback = buildCompletionFeedbackCopy({
    taskId: event.taskId,
    title,
    campaignTitle: campaign,
    completedAt: event.completedAt ?? now.toISOString(),
    completionSource: source,
    isRitual: source === "ritual",
    completedAllRituals: event.completedAllRituals === true,
    wasOverdue: overdue,
    isLateNight: lateNight,
    isDifficult: difficult,
    firstCompletionToday: event.firstCompletionToday === true,
    isBuildingMomentum: event.isBuildingMomentum === true,
    isOverloaded: event.isOverloaded === true,
  });

  return {
    companion: {
      message: trimCompletionFeedbackLine(feedback.message),
      tone: feedback.tone,
    },
    generationSource: feedback.generationSource,
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
  const generationSource = typeof root?.generationSource === "string"
    && VALID_GENERATION_SOURCES.has(root.generationSource as CompletionFeedbackGenerationSource)
    ? root.generationSource as CompletionFeedbackGenerationSource
    : undefined;

  return {
    companion: {
      message: trimCompletionFeedbackLine(message),
      tone: tone as CompletionCompanionTone,
    },
    ...(mentor ? { mentor } : {}),
    ...(followUpLabel && followUpAction
      ? { followUp: { label: followUpLabel, action: followUpAction } }
      : {}),
    ...(generationSource ? { generationSource } : {}),
  };
};
