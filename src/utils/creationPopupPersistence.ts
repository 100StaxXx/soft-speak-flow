import type { EpicSuggestion } from "@/hooks/useEpicSuggestions";
import type { EpicTemplate } from "@/hooks/useEpicTemplates";
import type { ClarifyingQuestion } from "@/hooks/useIntentClassifier";
import type { JourneyRitual, JourneySchedule } from "@/hooks/useJourneySchedule";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import {
  getCampaignBuilderDraftStorageKey,
  getCreationPopupMarkerStorageKey,
} from "@/utils/accountLocalState";
import { safeLocalStorage } from "@/utils/storage";

export const CAMPAIGN_BUILDER_DRAFT_VERSION = 1 as const;

export type CreationPopupSurface = "quest" | "campaign";
export type CreationPopupRoute = "/journeys" | "/campaigns";
export type CampaignBuilderDraftStep = "goal" | "timeline" | "suggestions" | "review";

export interface CreationPopupMarker {
  surface: CreationPopupSurface;
  route: CreationPopupRoute;
  selectedDate: string | null;
  updatedAt: string;
}

export interface CampaignBuilderDraftSnapshot {
  version: typeof CAMPAIGN_BUILDER_DRAFT_VERSION;
  step: CampaignBuilderDraftStep;
  goalInput: string;
  deadline: string | null;
  timelineContext: string;
  epicTitle: string;
  epicWhy: string;
  storyType: StoryTypeSlug | null;
  themeColor: string;
  customHabits: EpicSuggestion[];
  selectedTemplate: EpicTemplate | null;
  schedule: JourneySchedule | null;
  originalRituals: JourneyRitual[];
  localClarificationAnswers: Record<string, string | number>;
  localEpicContext: string | null;
  showClarification: boolean;
  clarificationQuestions: ClarifyingQuestion[];
  updatedAt: string;
}

type CampaignBuilderDraftSnapshotInput =
  Omit<CampaignBuilderDraftSnapshot, "version" | "updatedAt"> & { updatedAt?: string };

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const isStringNumberRecord = (value: unknown): value is Record<string, string | number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).every((entry) => (
    typeof entry === "string" || typeof entry === "number"
  ));
};

const isCreationPopupSurface = (value: unknown): value is CreationPopupSurface =>
  value === "quest" || value === "campaign";

const isCreationPopupRoute = (value: unknown): value is CreationPopupRoute =>
  value === "/journeys" || value === "/campaigns";

const isCampaignBuilderDraftStep = (value: unknown): value is CampaignBuilderDraftStep =>
  value === "goal" || value === "timeline" || value === "suggestions" || value === "review";

const hasStringField = (value: unknown, field: string): boolean => {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Record<string, unknown>)[field] === "string";
};

const hasIdAndTitle = (value: unknown): boolean =>
  hasStringField(value, "id") && hasStringField(value, "title");

const hasIdAndName = (value: unknown): boolean =>
  hasStringField(value, "id") && hasStringField(value, "name");

const isIdTitleArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every(hasIdAndTitle);

const isClarifyingQuestionArray = (value: unknown): value is ClarifyingQuestion[] =>
  Array.isArray(value)
  && value.every((entry) => (
    hasStringField(entry, "id")
    && hasStringField(entry, "question")
    && hasStringField(entry, "type")
    && typeof (entry as Record<string, unknown>).required === "boolean"
  ));

const isJourneyScheduleLike = (value: unknown): value is JourneySchedule => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.phases)
    && candidate.phases.every(hasIdAndName)
    && isIdTitleArray(candidate.milestones)
    && isIdTitleArray(candidate.rituals)
  );
};

const isCreationPopupMarker = (value: unknown): value is CreationPopupMarker => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    isCreationPopupSurface(candidate.surface)
    && isCreationPopupRoute(candidate.route)
    && (candidate.selectedDate === null || typeof candidate.selectedDate === "string")
    && typeof candidate.updatedAt === "string"
  );
};

const isCampaignBuilderDraftSnapshot = (value: unknown): value is CampaignBuilderDraftSnapshot => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === CAMPAIGN_BUILDER_DRAFT_VERSION
    && isCampaignBuilderDraftStep(candidate.step)
    && typeof candidate.goalInput === "string"
    && (candidate.deadline === null || typeof candidate.deadline === "string")
    && typeof candidate.timelineContext === "string"
    && typeof candidate.epicTitle === "string"
    && typeof candidate.epicWhy === "string"
    && (candidate.storyType === null || typeof candidate.storyType === "string")
    && typeof candidate.themeColor === "string"
    && isIdTitleArray(candidate.customHabits)
    && (candidate.selectedTemplate === null || hasIdAndName(candidate.selectedTemplate))
    && (candidate.schedule === null || isJourneyScheduleLike(candidate.schedule))
    && isIdTitleArray(candidate.originalRituals)
    && isStringNumberRecord(candidate.localClarificationAnswers)
    && (candidate.localEpicContext === null || typeof candidate.localEpicContext === "string")
    && typeof candidate.showClarification === "boolean"
    && isClarifyingQuestionArray(candidate.clarificationQuestions)
    && typeof candidate.updatedAt === "string"
  );
};

export const readCreationPopupMarker = (
  userId: string | null | undefined,
): CreationPopupMarker | null => {
  if (!userId) return null;

  const parsed = parseJson<unknown>(safeLocalStorage.getItem(getCreationPopupMarkerStorageKey(userId)));
  return isCreationPopupMarker(parsed) ? parsed : null;
};

export const writeCreationPopupMarker = (
  userId: string | null | undefined,
  marker: Omit<CreationPopupMarker, "updatedAt"> & { updatedAt?: string },
): boolean => {
  if (!userId) return false;

  const nextMarker: CreationPopupMarker = {
    ...marker,
    updatedAt: marker.updatedAt ?? new Date().toISOString(),
  };
  return safeLocalStorage.setItem(getCreationPopupMarkerStorageKey(userId), JSON.stringify(nextMarker));
};

export const clearCreationPopupMarker = (
  userId: string | null | undefined,
  expectedSurface?: CreationPopupSurface,
): boolean => {
  if (!userId) return false;

  if (expectedSurface) {
    const currentMarker = readCreationPopupMarker(userId);
    if (currentMarker && currentMarker.surface !== expectedSurface) return true;
  }

  return safeLocalStorage.removeItem(getCreationPopupMarkerStorageKey(userId));
};

export const readCampaignBuilderDraftSnapshot = (
  userId: string | null | undefined,
): CampaignBuilderDraftSnapshot | null => {
  if (!userId) return null;

  const parsed = parseJson<unknown>(safeLocalStorage.getItem(getCampaignBuilderDraftStorageKey(userId)));
  return isCampaignBuilderDraftSnapshot(parsed) ? parsed : null;
};

export const writeCampaignBuilderDraftSnapshot = (
  userId: string | null | undefined,
  snapshot: CampaignBuilderDraftSnapshotInput,
): boolean => {
  if (!userId) return false;

  const nextSnapshot: CampaignBuilderDraftSnapshot = {
    version: CAMPAIGN_BUILDER_DRAFT_VERSION,
    ...snapshot,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
  };
  return safeLocalStorage.setItem(getCampaignBuilderDraftStorageKey(userId), JSON.stringify(nextSnapshot));
};

export const clearCampaignBuilderDraftSnapshot = (
  userId: string | null | undefined,
): boolean => {
  if (!userId) return false;

  return safeLocalStorage.removeItem(getCampaignBuilderDraftStorageKey(userId));
};
