import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Check,
  ChevronRight,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Send,
  Waves,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import {
  CompanionImage,
  CompanionPortraitShell,
} from "@/components/CompanionImage";
import { CompanionStructuredResponseCards } from "@/components/companion/CompanionStructuredResponseCards";
import { DayPlanCard } from "@/components/companion/DayPlanCard";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CompanionAssistantMessage,
  useCompanionAssistant,
} from "@/hooks/useCompanionAssistant";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn, stripMarkdown } from "@/lib/utils";
import type { QuestComposerPrefillDraft } from "@/features/quests/types";
import { buildQuestPrefillFromNaturalLanguage } from "@/features/quests/utils/voiceQuestPrefill";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type { CompanionChatThreadSummary } from "@/types/companionConversation";
import type {
  CompanionAgentFollowUp,
  CompanionAgentProposedAction,
} from "@/types/companionAgent";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerProposal,
} from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
  onQuestProposalEditHandoff?: (
    proposal: CompanionPlannerProposal,
  ) => Promise<{ saved: boolean; savedTitle?: string | null }>;
}

type JourneysCompanionDrawerLayout = {
  shellHeight: number;
  bottomInset: number;
};

const MOBILE_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_DRAWER_HEIGHT_MAX_PX = 736;
const MOBILE_DRAWER_HANDLE_SPACE_PX = 22;
const MOBILE_DRAWER_VIEWPORT_OFFSET_PX = 24;
const TRANSCRIPT_BOTTOM_THRESHOLD_PX = 96;

const formatProposedActionType = (type: string) =>
  type.trim().replace(/[._-]+/g, " ") || "suggestion";

const normalizeProposedActionType = (type: string) =>
  type
    .trim()
    .toLowerCase()
    .replace(/[.\s-]+/g, "_");

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stripUndefinedValues = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );

const getProposedActionPayloadSource = (
  action: CompanionAgentProposedAction,
) => ({
  ...action,
  ...(asRecord(action.normalizedPayload) ?? {}),
});

const readFirstString = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const readFirstNullableString = (
  source: Record<string, unknown>,
  keys: string[],
): string | null | undefined => {
  for (const key of keys) {
    if (!(key in source)) continue;
    const value = source[key];
    if (value === null) return null;
    if (typeof value === "string") return value.trim() || undefined;
  }
  return undefined;
};

const readFirstNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      const durationMatch = trimmed.match(
        /^(\d+(?:\.\d+)?)\s*(?:m|min|minutes)?$/i,
      );
      const parsed = durationMatch ? Number(durationMatch[1]) : Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const readFirstNullableNumber = (
  source: Record<string, unknown>,
  keys: string[],
): number | null | undefined => {
  for (const key of keys) {
    if (!(key in source)) continue;
    const value = source[key];
    if (value === null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = readFirstNumber(source, [key]);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
};

const readFirstBoolean = (
  source: Record<string, unknown>,
  keys: string[],
): boolean | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return undefined;
};

const readStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      const record = asRecord(entry);
      if (!record) return "";
      return (
        readFirstString(record, ["title", "task_text", "name", "text"]) ?? ""
      );
    })
    .filter((entry) => entry.length > 0);
};

const readFirstStringList = (
  source: Record<string, unknown>,
  keys: string[],
): string[] => {
  for (const key of keys) {
    const entries = readStringList(source[key]);
    if (entries.length > 0) return entries;
  }
  return [];
};

const normalizeProposedQuestTitle = (value: string) => {
  let next = value
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();

  for (let index = 0; index < 4; index += 1) {
    const unwrapped = next
      .replace(
        /^create\s+(?:a\s+)?(?:quest|task)\s+for\s+["'“”]?(.+?)["'“”]?$/i,
        "$1",
      )
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();
    if (unwrapped === next) break;
    next = unwrapped;
  }

  return next;
};

const getProposedActionPayloadTitle = (
  action: CompanionAgentProposedAction,
) => {
  const actionType = normalizeProposedActionType(action.type);
  if (
    ![
      "quest_create",
      "task_create",
      "quest_update",
      "task_update",
      "quest_move",
      "task_move",
      "reminder_create",
      "campaign_start",
    ].includes(actionType)
  ) {
    return null;
  }

  const title = readFirstString(asRecord(action.normalizedPayload) ?? {}, [
    "initialGoal",
    "initial_goal",
    "goal",
    "title",
    "task_text",
    "name",
    "text",
  ]);
  return title ? normalizeProposedQuestTitle(title) : null;
};

const isCreateQuestProposedActionType = (actionType: string) =>
  actionType === "quest_create" || actionType === "task_create";

const isCampaignStartProposedAction = (action: CompanionAgentProposedAction) =>
  normalizeProposedActionType(action.type) === "campaign_start";

const isDraftableProposedAction = (action: CompanionAgentProposedAction) =>
  [
    "quest_create",
    "task_create",
    "quest_update",
    "task_update",
    "quest_move",
    "task_move",
    "ritual_create",
    "habit_create",
    "reminder_create",
    "campaign_update",
    "goal_update",
    "campaign_adjust",
    "goal_adjust",
    "journal_entry",
    "reflection_create",
    "campaign_start",
  ].includes(normalizeProposedActionType(action.type));

const getProposedActionTitle = (action: CompanionAgentProposedAction) => {
  const actionType = normalizeProposedActionType(action.type);
  const payloadTitle = getProposedActionPayloadTitle(action);
  const actionTitle = action.title
    ? normalizeProposedQuestTitle(action.title)
    : null;

  return (
    (isCreateQuestProposedActionType(actionType)
      ? payloadTitle || actionTitle
      : actionTitle || payloadTitle) ||
    action.summary?.trim() ||
    formatProposedActionType(action.type)
  );
};

const getProposedActionSummary = (action: CompanionAgentProposedAction) => {
  const title = getProposedActionTitle(action);
  const summary = action.summary?.trim();
  return summary && summary !== title ? summary : null;
};

const getProposedActionKey = (action: CompanionAgentProposedAction) =>
  [
    normalizeProposedActionType(action.type),
    getProposedActionTitle(action),
    getProposedActionSummary(action) ?? "",
    action.reason?.trim() ?? "",
  ].join("::");

const getCampaignStartInitialGoal = (action: CompanionAgentProposedAction) => {
  const source = getProposedActionPayloadSource(action);
  return (
    readFirstString(source, [
      "initialGoal",
      "initial_goal",
      "goal",
      "title",
      "description",
      "summary",
      "message",
    ]) ?? getProposedActionTitle(action)
  );
};

const PLAN_DAY_QUEST_CONSENT_QUESTION_ID = "plan_day_quest_consent";

const getFollowUpMetadataString = (
  followUp: CompanionAgentFollowUp | null | undefined,
  key: string,
) => {
  const value = followUp?.metadata?.[key];
  return typeof value === "string" ? value : null;
};

const getFollowUpKey = (
  followUp: CompanionAgentFollowUp | null | undefined,
) => {
  if (!followUp) return null;

  return [
    followUp.question.trim().toLowerCase(),
    getFollowUpMetadataString(followUp, "questionId") ?? "",
    getFollowUpMetadataString(followUp, "sourceStarterIntent") ?? "",
    getFollowUpMetadataString(followUp, "consentKind") ?? "",
    getFollowUpMetadataString(followUp, "sourceMessage") ?? "",
  ].join("::");
};

const isPlanDayQuestConsentFollowUp = (
  followUp: CompanionAgentFollowUp | null | undefined,
) => {
  if (!followUp) return false;

  const questionId = getFollowUpMetadataString(followUp, "questionId");
  const consentKind = getFollowUpMetadataString(followUp, "consentKind");
  const sourceStarterIntent = getFollowUpMetadataString(
    followUp,
    "sourceStarterIntent",
  );

  if (questionId === PLAN_DAY_QUEST_CONSENT_QUESTION_ID) {
    return consentKind === null || consentKind === "quest";
  }

  return (
    followUp.metadata?.planningLauncherConsent === true &&
    consentKind === "quest" &&
    sourceStarterIntent === "plan_day"
  );
};

const isAffirmativeFollowUpOption = (option: string) =>
  /^(yes|yep|yeah|sure|ok|okay|please)\b/i.test(option.trim());

const isConfirmationOnlyMessage = (content: string) =>
  /^(yes|yep|yeah|sure|ok|okay|please|no|nope|nah)\b[.!?]*$/i.test(
    content.trim(),
  );

const resolveQuestConsentSourceText = (
  followUp: CompanionAgentFollowUp,
  messages: CompanionAssistantMessage[],
) => {
  const metadataSource = getFollowUpMetadataString(
    followUp,
    "sourceMessage",
  )?.trim();
  if (metadataSource) return stripMarkdown(metadataSource).trim();

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;

    const content = stripMarkdown(message.content).trim();
    if (!content || isConfirmationOnlyMessage(content)) continue;
    return content;
  }

  return "";
};

const buildCreateQuestProposalFromDraft = (
  draft: QuestComposerPrefillDraft,
): CompanionPlannerProposal => {
  const taskText = draft.text?.trim() ?? "";
  const proposalId = `plan-day-quest-handoff-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return {
    id: proposalId,
    kind: "create_quest",
    title: taskText || "New quest",
    summary: taskText
      ? `Review "${taskText}" before saving.`
      : "Review this quest before saving.",
    payload: {
      taskText,
      taskDate: draft.taskDate ?? null,
      difficulty: draft.difficulty ?? "medium",
      scheduledTime: draft.scheduledTime ?? null,
      estimatedDuration: draft.estimatedDuration ?? 30,
      recurrencePattern: draft.recurrencePattern ?? null,
      recurrenceDays: draft.recurrenceDays ?? [],
      recurrenceMonthDays: draft.recurrenceMonthDays ?? [],
      recurrenceCustomPeriod: draft.recurrenceCustomPeriod ?? null,
      reminderEnabled: draft.reminderEnabled ?? false,
      reminderMinutesBefore: draft.reminderMinutesBefore ?? 15,
      notes: draft.moreInformation ?? null,
      location: draft.location ?? null,
      subtasks: draft.subtasks ?? [],
    },
    status: "pending",
    readyToConfirm: true,
  };
};

const buildQuestConsentCreateProposal = (sourceText: string) => {
  const cleanedSourceText = sourceText.trim();
  const prefillDraft = cleanedSourceText
    ? buildQuestPrefillFromNaturalLanguage(cleanedSourceText, "nlp")
    : ({ creationSource: "nlp" } satisfies QuestComposerPrefillDraft);

  return buildCreateQuestProposalFromDraft(prefillDraft);
};

type ProposedActionQuestProposalResult =
  | { status: "ready"; proposal: CompanionPlannerProposal }
  | { status: "invalid"; message: string }
  | { status: "unsupported" };

const createProposedActionProposalId = (
  actionType: string,
  action: CompanionAgentProposedAction,
) =>
  `proposed-${actionType}-${getProposedActionKey(action)}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const getProposedActionSubtasks = (source: Record<string, unknown>) => {
  const directSubtasks = readFirstStringList(source, [
    "subtasks",
    "subtaskTitles",
    "subtask_titles",
  ]);
  if (directSubtasks.length > 0) return directSubtasks;

  const subtaskPlan =
    asRecord(source.subtaskPlan) ?? asRecord(source.subtask_plan);
  return readFirstStringList(subtaskPlan ?? {}, ["titles", "subtasks"]);
};

const buildCreateQuestProposalFromProposedAction = (
  action: CompanionAgentProposedAction,
  actionType: string,
): ProposedActionQuestProposalResult => {
  const source = getProposedActionPayloadSource(action);
  const title = getProposedActionTitle(action);
  const taskText = title.trim();

  if (!taskText) {
    return {
      status: "invalid",
      message: "Couldn't open that quest draft right now.",
    };
  }

  return {
    status: "ready",
    proposal: {
      id: createProposedActionProposalId(actionType, action),
      kind: "create_quest",
      title: taskText,
      summary: action.summary?.trim() || `Review "${taskText}" before saving.`,
      reasoning: action.reason?.trim() || null,
      payload: {
        taskText,
        taskDate:
          readFirstNullableString(source, ["taskDate", "task_date", "date"]) ??
          null,
        difficulty: readFirstString(source, ["difficulty"]) ?? "medium",
        scheduledTime:
          readFirstNullableString(source, [
            "scheduledTime",
            "scheduled_time",
            "startTime",
            "time",
          ]) ?? null,
        estimatedDuration:
          readFirstNumber(source, [
            "estimatedDuration",
            "estimated_duration",
            "durationMinutes",
            "duration_minutes",
            "duration",
          ]) ?? 30,
        recurrencePattern:
          readFirstNullableString(source, [
            "recurrencePattern",
            "recurrence_pattern",
          ]) ?? null,
        recurrenceDays: source.recurrenceDays ?? source.recurrence_days ?? [],
        recurrenceMonthDays:
          source.recurrenceMonthDays ?? source.recurrence_month_days ?? [],
        recurrenceCustomPeriod:
          readFirstNullableString(source, [
            "recurrenceCustomPeriod",
            "recurrence_custom_period",
          ]) ?? null,
        reminderEnabled:
          readFirstBoolean(source, ["reminderEnabled", "reminder_enabled"]) ??
          false,
        reminderMinutesBefore:
          readFirstNumber(source, [
            "reminderMinutesBefore",
            "reminder_minutes_before",
          ]) ?? 15,
        notes:
          readFirstNullableString(source, ["notes", "note", "description"]) ??
          null,
        location: readFirstNullableString(source, ["location"]) ?? null,
        subtasks: getProposedActionSubtasks(source),
      },
      status: "pending",
      readyToConfirm: true,
    },
  };
};

const buildUpdateQuestProposalFromProposedAction = (
  action: CompanionAgentProposedAction,
  actionType: string,
): ProposedActionQuestProposalResult => {
  const payloadSource = asRecord(action.normalizedPayload) ?? {};
  const source = getProposedActionPayloadSource(action);
  const taskId = readFirstString(source, ["taskId", "task_id", "id"]);

  if (!taskId) {
    return {
      status: "invalid",
      message: "Couldn't find the quest tied to that edit.",
    };
  }

  const updates = stripUndefinedValues({
    task_text:
      readFirstNullableString(payloadSource, [
        "task_text",
        "title",
        "name",
        "text",
      ]) ?? readFirstNullableString(source, ["task_text", "name", "text"]),
    task_date: readFirstNullableString(source, [
      "task_date",
      "taskDate",
      "date",
    ]),
    difficulty: readFirstNullableString(source, ["difficulty"]),
    scheduled_time: readFirstNullableString(source, [
      "scheduled_time",
      "scheduledTime",
      "startTime",
      "time",
    ]),
    estimated_duration: readFirstNullableNumber(source, [
      "estimated_duration",
      "estimatedDuration",
      "durationMinutes",
      "duration_minutes",
      "duration",
    ]),
    recurrence_pattern: readFirstNullableString(source, [
      "recurrence_pattern",
      "recurrencePattern",
    ]),
    recurrence_days: source.recurrence_days ?? source.recurrenceDays,
    recurrence_month_days:
      source.recurrence_month_days ?? source.recurrenceMonthDays,
    recurrence_custom_period: readFirstNullableString(source, [
      "recurrence_custom_period",
      "recurrenceCustomPeriod",
    ]),
    reminder_enabled: readFirstBoolean(source, [
      "reminder_enabled",
      "reminderEnabled",
    ]),
    reminder_minutes_before: readFirstNullableNumber(source, [
      "reminder_minutes_before",
      "reminderMinutesBefore",
    ]),
    category: readFirstNullableString(source, ["category"]),
    notes: readFirstNullableString(source, ["notes", "note", "description"]),
    image_url: readFirstNullableString(source, ["image_url", "imageUrl"]),
    location: readFirstNullableString(source, ["location"]),
  });
  const subtaskTitles = getProposedActionSubtasks(source);
  const rawSubtaskPlan =
    asRecord(source.subtaskPlan) ?? asRecord(source.subtask_plan);
  const rawMode = readFirstString(rawSubtaskPlan ?? source, [
    "mode",
    "subtaskPlanMode",
    "subtask_plan_mode",
  ]);
  const subtaskPlanMode = rawMode === "replace" ? "replace" : "append";

  return {
    status: "ready",
    proposal: {
      id: createProposedActionProposalId(actionType, action),
      kind: "update_quest",
      title: getProposedActionTitle(action),
      summary: action.summary?.trim() || "Review this quest edit.",
      reasoning: action.reason?.trim() || null,
      payload: stripUndefinedValues({
        taskId,
        updates,
        subtaskPlan:
          subtaskTitles.length > 0
            ? {
                mode: subtaskPlanMode,
                titles: subtaskTitles,
              }
            : undefined,
      }),
      status: "pending",
      readyToConfirm: true,
    },
  };
};

const isQuestReminderTargetType = (value: string | undefined) => {
  if (!value) return false;
  return ["quest", "task", "daily_task", "daily-task"].includes(
    value.trim().toLowerCase(),
  );
};

const buildReminderQuestProposalFromProposedAction = (
  action: CompanionAgentProposedAction,
  actionType: string,
): ProposedActionQuestProposalResult => {
  const source = getProposedActionPayloadSource(action);
  const targetType = readFirstString(source, ["targetType", "target_type"]);
  const taskId = readFirstString(source, [
    "taskId",
    "task_id",
    "targetId",
    "target_id",
    "id",
  ]);

  if (targetType && !isQuestReminderTargetType(targetType)) {
    return { status: "unsupported" };
  }

  if (!taskId) {
    return {
      status: "invalid",
      message: "Couldn't find the quest tied to that reminder.",
    };
  }

  return {
    status: "ready",
    proposal: {
      id: createProposedActionProposalId(actionType, action),
      kind: "suggest_reminder",
      title: getProposedActionTitle(action),
      summary: action.summary?.trim() || "Review this quest reminder.",
      reasoning: action.reason?.trim() || null,
      payload: {
        taskId,
        updates: stripUndefinedValues({
          reminder_enabled:
            readFirstBoolean(source, ["reminder_enabled", "reminderEnabled"]) ??
            true,
          reminder_minutes_before:
            readFirstNullableNumber(source, [
              "reminder_minutes_before",
              "reminderMinutesBefore",
            ]) ?? 15,
        }),
      },
      status: "pending",
      readyToConfirm: true,
    },
  };
};

const buildQuestProposalFromProposedAction = (
  action: CompanionAgentProposedAction,
): ProposedActionQuestProposalResult => {
  const actionType = normalizeProposedActionType(action.type);

  if (actionType === "quest_create" || actionType === "task_create") {
    return buildCreateQuestProposalFromProposedAction(action, actionType);
  }

  if (
    actionType === "quest_update" ||
    actionType === "task_update" ||
    actionType === "quest_move" ||
    actionType === "task_move"
  ) {
    return buildUpdateQuestProposalFromProposedAction(action, actionType);
  }

  if (actionType === "reminder_create") {
    return buildReminderQuestProposalFromProposedAction(action, actionType);
  }

  return { status: "unsupported" };
};

const hasRichStructuredResponse = (
  structuredResponse: CompanionStructuredResponse | null | undefined,
) =>
  Boolean(
    structuredResponse?.planDay ||
    structuredResponse?.weeklyPlan ||
    structuredResponse?.priorityOverview ||
    structuredResponse?.reflectionBridge ||
    structuredResponse?.comingUp ||
    structuredResponse?.campaignMomentum,
  );

const findStructuredResponseBubbleMessageId = (
  messages: CompanionAssistantMessage[],
  structuredResponse: CompanionStructuredResponse | null | undefined,
) => {
  if (!hasRichStructuredResponse(structuredResponse)) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      !message.receipt &&
      hasRichStructuredResponse(message.structuredResponse)
    ) {
      return message.id;
    }
  }

  return null;
};

const getReducedMotionPreference = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getDrawerLayout = (): JourneysCompanionDrawerLayout => {
  if (typeof window === "undefined") {
    return {
      shellHeight: MOBILE_DRAWER_HEIGHT_MIN_PX,
      bottomInset: 0,
    };
  }

  const visualViewport = window.visualViewport;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const safeViewportHeight = Number.isFinite(viewportHeight)
    ? viewportHeight
    : window.innerHeight;
  const viewportOffsetTop =
    visualViewport && Number.isFinite(visualViewport.offsetTop)
      ? visualViewport.offsetTop
      : 0;
  const visibleViewportBottom = viewportOffsetTop + safeViewportHeight;
  const bottomInset = Math.max(0, window.innerHeight - visibleViewportBottom);
  const availableShellHeight = Math.max(
    0,
    safeViewportHeight -
      MOBILE_DRAWER_VIEWPORT_OFFSET_PX -
      MOBILE_DRAWER_HANDLE_SPACE_PX,
  );
  const boundedShellHeight = Math.min(
    MOBILE_DRAWER_HEIGHT_MAX_PX,
    availableShellHeight,
  );

  return {
    shellHeight: Math.max(
      Math.min(MOBILE_DRAWER_HEIGHT_MIN_PX, availableShellHeight),
      boundedShellHeight,
    ),
    bottomInset,
  };
};

const formatThreadTimestamp = (value: string) => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "Just now";
  }
};

interface JourneysCompanionThreadPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  historyThreads: CompanionChatThreadSummary[];
  isLoading: boolean;
  canResumeThreads: boolean;
  emptyStateMessage: string;
  onResumeThread: (sessionId: string) => Promise<void>;
}

const JourneysCompanionThreadPicker = memo(
  function JourneysCompanionThreadPicker({
    open,
    onOpenChange,
    presentation,
    historyThreads,
    isLoading,
    canResumeThreads,
    emptyStateMessage,
    onResumeThread,
  }: JourneysCompanionThreadPickerProps) {
    const { themeModeClassName } = usePlannerPathfinderAppearance();
    const body = (
      <div
        className={cn(themeModeClassName, plannerPathfinderTheme.threadPickerShell)}
        data-testid="journeys-companion-thread-picker"
      >
        <div className="mb-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">Thread history</p>
          <p className="text-sm text-muted-foreground">
            Browse old conversations here and jump back in whenever you want.
          </p>
        </div>

        <div className="space-y-2">
          <p className={plannerPathfinderTheme.sectionEyebrow}>
            Past chats
          </p>
          {isLoading ? (
            <div
              className={cn(
                plannerPathfinderTheme.headerBar,
                "px-4 py-5 text-sm text-muted-foreground",
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading past chats...
            </div>
          ) : historyThreads.length > 0 ? (
            <div className="space-y-2">
              {historyThreads.map((thread) => (
                <button
                  key={thread.sessionId}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-[1.5rem] border px-4 py-4 text-left transition-colors shadow-[0_12px_30px_-26px_rgba(28,87,135,0.36),inset_0_1px_0_rgba(255,255,255,0.58)]",
                    canResumeThreads
                      ? "border-[hsl(var(--celestial-blue)_/_0.24)] bg-card/[0.72] hover:bg-card"
                      : "cursor-not-allowed border-[hsl(var(--celestial-blue)_/_0.16)] bg-card/40 opacity-70",
                  )}
                  onClick={() => {
                    void onResumeThread(thread.sessionId);
                  }}
                  disabled={!canResumeThreads}
                  data-testid={`journeys-companion-thread-resume-${thread.sessionId}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {thread.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {thread.previewText}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground/80">
                      Updated {formatThreadTimestamp(thread.lastMessageAt)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[hsl(var(--celestial-blue)_/_0.28)] bg-card/50 px-4 py-5 text-sm text-muted-foreground">
              {emptyStateMessage}
            </div>
          )}
        </div>
      </div>
    );

    if (presentation === "dialog") {
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-lg border-none bg-transparent p-0 shadow-none"
            hideCloseButton
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Companion threads</DialogTitle>
              <DialogDescription>
                Browse archived journeys conversations.
              </DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="border-none bg-transparent p-0 shadow-none">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Companion threads</DrawerTitle>
            <DrawerDescription>
              Browse archived journeys conversations.
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  },
);

const JourneysCompanionOverlayBody = memo(
  ({
    presentation,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    onQuestProposalEditHandoff,
    drawerLayout,
  }: {
    presentation: JourneysCompanionPlannerModalPresentation;
    launchIntent?: CompanionPlannerLaunchIntent | null;
    onLaunchIntentConsumed?: (intentId: string) => void;
    onOpenCampaignBuilder?: (message: string) => void;
    onQuestProposalEditHandoff?: (
      proposal: CompanionPlannerProposal,
    ) => Promise<{ saved: boolean; savedTitle?: string | null }>;
    drawerLayout?: JourneysCompanionDrawerLayout;
  }) => {
    const {
      companionLabel,
      imageUrl,
      focalX,
      focalY,
      element,
      usesPortraitShell,
    } = useJourneysCompanionVisual();
    const assistant = useCompanionAssistant({
      surface: "journeys",
      conversationEnabled: true,
      launchIntent: launchIntent ?? null,
      onLaunchIntentConsumed,
      onOpenCampaignBuilder,
    });
    const { themeModeClassName } = usePlannerPathfinderAppearance();
    const visibleMessages = useMemo(
      () => assistant.messages.filter((entry) => !entry.isSeed),
      [assistant.messages],
    );
    const prefersReducedMotion = getReducedMotionPreference();
    const isDrawerPresentation = presentation === "drawer";

    const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);
    const [pendingFollowUpOption, setPendingFollowUpOption] = useState<
      string | null
    >(null);
    const [pendingProposedActionKey, setPendingProposedActionKey] = useState<
      string | null
    >(null);
    const [handledLocalFollowUpKey, setHandledLocalFollowUpKey] = useState<
      string | null
    >(null);

    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const transcriptScrollAreaRef = useRef<HTMLDivElement | null>(null);
    const transcriptInnerRef = useRef<HTMLDivElement | null>(null);
    const transcriptPinnedToBottomRef = useRef(true);
    const lastAutoScrolledThreadSessionIdRef = useRef<
      string | null | undefined
    >(undefined);
    const activeThreadSessionId = assistant.activeThread?.sessionId ?? null;
    const displayMessages = useMemo(() => {
      const structuredResponseBubbleMessageId =
        findStructuredResponseBubbleMessageId(
          visibleMessages,
          assistant.structuredResponse,
        );
      if (!structuredResponseBubbleMessageId) return visibleMessages;

      return visibleMessages.filter(
        (message) => message.id !== structuredResponseBubbleMessageId,
      );
    }, [assistant.structuredResponse, visibleMessages]);
    const activeFollowUpKey = useMemo(
      () => getFollowUpKey(assistant.activeFollowUp),
      [assistant.activeFollowUp],
    );

    useEffect(() => {
      if (
        !launchIntent?.id ||
        launchIntent.starterIntent !== "thread_history"
      ) {
        return;
      }
      setIsThreadPickerOpen(true);
      onLaunchIntentConsumed?.(launchIntent.id);
    }, [launchIntent, onLaunchIntentConsumed]);

    useEffect(() => {
      if (!activeFollowUpKey) {
        setHandledLocalFollowUpKey(null);
      }
    }, [activeFollowUpKey]);

    const getTranscriptViewport = useCallback(
      () =>
        transcriptScrollAreaRef.current?.querySelector<HTMLElement>(
          "[data-radix-scroll-area-viewport]",
        ) ?? null,
      [],
    );

    const updateTranscriptPinnedState = useCallback(
      (transcriptViewport = getTranscriptViewport()) => {
        if (!transcriptViewport) {
          return transcriptPinnedToBottomRef.current;
        }

        const distanceFromBottom =
          transcriptViewport.scrollHeight -
          (transcriptViewport.scrollTop + transcriptViewport.clientHeight);
        const isPinnedToBottom =
          distanceFromBottom <= TRANSCRIPT_BOTTOM_THRESHOLD_PX;
        transcriptPinnedToBottomRef.current = isPinnedToBottom;
        return isPinnedToBottom;
      },
      [getTranscriptViewport],
    );

    const scrollTranscriptToBottom = useCallback(
      (behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth") => {
        const transcriptViewport = getTranscriptViewport();
        if (!transcriptViewport) {
          return;
        }

        const nextTop = Math.max(
          0,
          transcriptViewport.scrollHeight - transcriptViewport.clientHeight,
        );
        if (typeof transcriptViewport.scrollTo === "function") {
          transcriptViewport.scrollTo({ top: nextTop, behavior });
        } else {
          transcriptViewport.scrollTop = nextTop;
        }
        transcriptPinnedToBottomRef.current = true;
      },
      [getTranscriptViewport, prefersReducedMotion],
    );

    useEffect(() => {
      const transcriptViewport = getTranscriptViewport();
      if (!transcriptViewport) return;

      const handleScroll = () => {
        updateTranscriptPinnedState(transcriptViewport);
      };

      transcriptViewport.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      updateTranscriptPinnedState(transcriptViewport);

      return () => {
        transcriptViewport.removeEventListener("scroll", handleScroll);
      };
    }, [getTranscriptViewport, updateTranscriptPinnedState]);

    useEffect(() => {
      const activeThreadChanged =
        lastAutoScrolledThreadSessionIdRef.current !== activeThreadSessionId;

      if (activeThreadChanged) {
        lastAutoScrolledThreadSessionIdRef.current = activeThreadSessionId;
        transcriptPinnedToBottomRef.current = true;
        scrollTranscriptToBottom("auto");
        return;
      }

      if (transcriptPinnedToBottomRef.current) {
        scrollTranscriptToBottom(prefersReducedMotion ? "auto" : "smooth");
      }
    }, [
      activeThreadSessionId,
      assistant.activeFollowUp,
      assistant.dayPlan,
      assistant.pendingAction,
      assistant.proposedActions,
      assistant.structuredResponse,
      drawerLayout?.bottomInset,
      drawerLayout?.shellHeight,
      displayMessages,
      prefersReducedMotion,
      scrollTranscriptToBottom,
    ]);

    useEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const inner = transcriptInnerRef.current;
      const transcriptViewport = getTranscriptViewport();
      if (!inner || !transcriptViewport) return;

      const reanchorIfPinnedToBottom = () => {
        if (transcriptPinnedToBottomRef.current) {
          scrollTranscriptToBottom(prefersReducedMotion ? "auto" : "smooth");
        }
      };

      const observer = new ResizeObserver(() => {
        reanchorIfPinnedToBottom();
      });
      observer.observe(inner);
      return () => observer.disconnect();
    }, [getTranscriptViewport, prefersReducedMotion, scrollTranscriptToBottom]);

    const syncComposerHeight = useCallback(() => {
      const composer = composerRef.current;
      if (!composer) return;

      composer.style.height = "0px";
      const nextHeight = Math.max(72, Math.min(260, composer.scrollHeight));
      composer.style.height = `${nextHeight}px`;
      composer.style.overflowY =
        composer.scrollHeight > 260 ? "auto" : "hidden";
    }, []);

    useLayoutEffect(() => {
      syncComposerHeight();
    }, [assistant.draftInput, syncComposerHeight]);

    const handleComposerKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        assistant.submitTypedMessage();
      },
      [assistant],
    );

    const handleComposerSubmit = useCallback(() => {
      assistant.submitTypedMessage();
    }, [assistant]);

    const handleVoiceToggle = useCallback(() => {
      assistant.toggleRecording();
    }, [assistant]);

    const handleResumeThread = useCallback(
      async (sessionId: string) => {
        await assistant.resumeThread(sessionId);
        setIsThreadPickerOpen(false);
      },
      [assistant],
    );

    const handleArchiveAction = useCallback(async () => {
      if (assistant.canArchiveThread) {
        await assistant.archiveCurrentThread();
      }
      setIsThreadPickerOpen(true);
    }, [assistant]);

    const handleNewChatAction = useCallback(async () => {
      if (!assistant.canStartNewChat) return;
      await assistant.startNewChat();
    }, [assistant]);

    const localActionPending = Boolean(
      pendingFollowUpOption || pendingProposedActionKey,
    );

    const handleFollowUpOption = useCallback(
      async (option: string) => {
        if (localActionPending) return;

        const activeFollowUp = assistant.activeFollowUp;
        if (
          activeFollowUp &&
          onQuestProposalEditHandoff &&
          isPlanDayQuestConsentFollowUp(activeFollowUp) &&
          isAffirmativeFollowUpOption(option)
        ) {
          const followUpKey = activeFollowUpKey;
          const sourceText = resolveQuestConsentSourceText(
            activeFollowUp,
            displayMessages,
          );
          const proposal = buildQuestConsentCreateProposal(sourceText);

          setPendingFollowUpOption(option);
          if (followUpKey) {
            setHandledLocalFollowUpKey(followUpKey);
          }
          try {
            await onQuestProposalEditHandoff(proposal);
          } finally {
            setPendingFollowUpOption(null);
          }
          return;
        }

        setPendingFollowUpOption(option);
        try {
          await assistant.submitMessage(option, "text", {
            turnOrigin: "follow_up_option",
          });
        } finally {
          setPendingFollowUpOption(null);
        }
      },
      [
        activeFollowUpKey,
        assistant,
        displayMessages,
        localActionPending,
        onQuestProposalEditHandoff,
      ],
    );

    const handleProposedActionDraft = useCallback(
      (action: CompanionAgentProposedAction) => {
        if (localActionPending) return;

        const actionKey = getProposedActionKey(action);
        if (isCampaignStartProposedAction(action) && onOpenCampaignBuilder) {
          setPendingProposedActionKey(actionKey);
          try {
            onOpenCampaignBuilder(getCampaignStartInitialGoal(action));
          } finally {
            setPendingProposedActionKey(null);
          }
          return;
        }

        const localQuestProposal = onQuestProposalEditHandoff
          ? buildQuestProposalFromProposedAction(action)
          : ({
              status: "unsupported",
            } satisfies ProposedActionQuestProposalResult);

        if (localQuestProposal.status === "invalid") {
          toast.error(localQuestProposal.message);
          return;
        }

        setPendingProposedActionKey(actionKey);
        if (localQuestProposal.status === "ready") {
          void onQuestProposalEditHandoff?.(
            localQuestProposal.proposal,
          ).finally(() => {
            setPendingProposedActionKey(null);
          });
          return;
        }

        void assistant
          .submitMessage(
            `Draft this: ${getProposedActionTitle(action)}`,
            "text",
            {
              turnOrigin: "proposed_action",
              selectedProposedAction: action,
              selectedProposedActionIntent: "draft",
            },
          )
          .finally(() => {
            setPendingProposedActionKey(null);
          });
      },
      [
        assistant,
        localActionPending,
        onOpenCampaignBuilder,
        onQuestProposalEditHandoff,
      ],
    );

    const handleProposedActionDiscuss = useCallback(
      (action: CompanionAgentProposedAction) => {
        if (localActionPending) return;

        setPendingProposedActionKey(getProposedActionKey(action));
        void assistant
          .submitMessage(
            `Tell me more about: ${getProposedActionTitle(action)}`,
            "text",
            {
              turnOrigin: "proposed_action",
              selectedProposedAction: action,
              selectedProposedActionIntent: "discuss",
            },
          )
          .finally(() => {
            setPendingProposedActionKey(null);
          });
      },
      [assistant, localActionPending],
    );

    const assistantActionDisabled =
      assistant.isSubmitting ||
      assistant.isResolvingAction ||
      localActionPending;
    const sendDisabled =
      assistantActionDisabled || !assistant.draftInput.trim();
    const followUpOptions =
      assistant.activeFollowUp?.options?.filter(
        (option) => option.trim().length > 0,
      ) ?? [];
    const hasFollowUpPanel = Boolean(
      assistant.activeFollowUp &&
      !assistant.pendingAction &&
      activeFollowUpKey !== handledLocalFollowUpKey,
    );
    const visibleProposedActions = hasRichStructuredResponse(
      assistant.structuredResponse,
    )
      ? []
      : assistant.proposedActions
          .filter((action) => getProposedActionTitle(action).trim().length > 0)
          .slice(0, 3);
    const hasProposedActionsPanel =
      !hasFollowUpPanel &&
      !assistant.pendingAction &&
      visibleProposedActions.length > 0;
    const micButtonLabel = assistant.isRecording
      ? "Stop voice reply"
      : "Start voice reply";
    const newChatTooltip =
      assistant.newChatDisabledReason ??
      (assistant.hasPersistedActiveThread
        ? "Archive this chat and start a new one."
        : "Start a fresh chat.");

    const avatar = usesPortraitShell ? (
      <CompanionPortraitShell
        src={imageUrl}
        element={element}
        className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.15] shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]"
      >
        <CompanionImage
          src={imageUrl}
          alt={companionLabel}
          fit="portrait"
          element={element}
          focalX={focalX}
          focalY={focalY}
          className="rounded-full"
        />
      </CompanionPortraitShell>
    ) : (
      <div className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.15] bg-white/10 shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]">
        <CompanionImage
          src={imageUrl}
          alt={companionLabel}
          element={element}
          focalX={focalX}
          focalY={focalY}
          className="rounded-full"
        />
      </div>
    );

    const statusText = assistant.isRecording
      ? "Listening..."
      : assistant.isSubmitting || assistant.isResolvingAction
        ? "Working..."
        : assistant.todayLabel;
    const plannerShellStyle =
      isDrawerPresentation && drawerLayout
        ? { height: `${drawerLayout.shellHeight}px` }
        : undefined;

    return (
      <div
        className={cn(themeModeClassName, plannerPathfinderTheme.shell)}
        data-testid="journeys-companion-planner-modal"
      >
        <div className={plannerPathfinderTheme.shellGloss} />
        <div className={plannerPathfinderTheme.shellGlow} />

        <div
          className={cn(
            plannerPathfinderTheme.shellBody,
            isDrawerPresentation
              ? "h-full"
              : "h-[min(82vh,46rem)] min-h-[32rem]",
          )}
          style={plannerShellStyle}
          data-testid="journeys-companion-planner-shell"
        >
          <div
            className={plannerPathfinderTheme.headerBar}
            data-testid="journeys-companion-planner-chat-header"
          >
            <div className="relative shrink-0">
              {avatar}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,hsl(var(--celestial-blue)_/_0.24),transparent_70%)] blur-lg"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {companionLabel}
              </p>
              <p className="truncate text-xs text-muted-foreground">{statusText}</p>
            </div>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className={cn(
                          "h-10 w-10",
                          plannerPathfinderTheme.headerIconButton,
                        )}
                        onClick={() => {
                          void handleNewChatAction();
                        }}
                        disabled={!assistant.canStartNewChat}
                        aria-label="New chat"
                        data-testid="journeys-companion-new-chat-button"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {newChatTooltip}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className={cn(
                          "h-10 w-10",
                          plannerPathfinderTheme.headerIconButton,
                        )}
                        onClick={() => {
                          void handleArchiveAction();
                        }}
                        disabled={!assistant.canArchiveThread}
                        aria-label="Archive"
                        data-testid="journeys-companion-archive-button"
                      >
                        {assistant.isLoadingThreads ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {assistant.archiveDisabledReason ??
                      "Archive this chat and browse past chats."}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <div
            className={plannerPathfinderTheme.contentWell}
            data-testid="journeys-companion-planner-dialogue-screen"
            data-vaul-no-drag
          >
            <ScrollArea ref={transcriptScrollAreaRef} className="flex-1">
              <div
                ref={transcriptInnerRef}
                className="space-y-3 p-4 sm:p-5"
                style={{
                  paddingBottom:
                    "calc(1rem + var(--mentor-guidance-bottom-inset, 0px))",
                }}
                data-testid="journeys-companion-planner-transcript"
              >
                {displayMessages.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex w-full",
                      entry.role === "assistant"
                        ? "justify-start"
                        : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[1.7rem] border px-4 py-3 shadow-[0_14px_32px_-28px_rgba(28,87,135,0.44),inset_0_1px_0_rgba(255,255,255,0.6)] sm:max-w-[78%]",
                        entry.role === "assistant"
                          ? plannerPathfinderTheme.assistantBubble
                          : plannerPathfinderTheme.userBubble,
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6 sm:text-[0.95rem]">
                        {stripMarkdown(entry.content) || "\u00A0"}
                      </p>
                    </div>
                  </div>
                ))}

                {assistant.dayPlan ? (
                  <DayPlanCard
                    dayPlan={assistant.dayPlan}
                    committed={Boolean(assistant.committedDayPlanId)}
                    committing={assistant.committingDayPlan}
                    onCommit={() => {
                      void assistant.commitDayPlan();
                    }}
                  />
                ) : null}

                {!assistant.dayPlan ? (
                  <CompanionStructuredResponseCards
                    structuredResponse={assistant.structuredResponse}
                    variant="journeys"
                    onConfirmSuggestion={assistant.confirmSuggestedQuest}
                    savedProposalIds={assistant.savedSuggestionProposalIds}
                    pendingProposalId={assistant.pendingSuggestionProposalId}
                    actionDisabled={
                      assistantActionDisabled ||
                      Boolean(assistant.pendingAction)
                    }
                  />
                ) : null}

                {hasFollowUpPanel && assistant.activeFollowUp ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-follow-up"
                    data-tutorial-avoid="true"
                  >
                    <div
                      className={cn(
                        plannerPathfinderTheme.raisedPanel,
                        "max-w-[88%] p-4",
                      )}
                    >
                      <Badge
                        variant="outline"
                        className={plannerPathfinderTheme.chip}
                      >
                        Follow-up
                      </Badge>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {assistant.activeFollowUp.question}
                      </p>
                      {assistant.activeFollowUp.reason ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assistant.activeFollowUp.reason}
                        </p>
                      ) : null}
                      {followUpOptions.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {followUpOptions.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                plannerPathfinderTheme.outlineButton,
                                "h-auto min-h-9 max-w-full whitespace-normal text-left leading-tight",
                              )}
                              onClick={() => handleFollowUpOption(option)}
                              disabled={assistantActionDisabled}
                              data-tour="companion-plan-day-follow-up-option"
                              data-tour-shape="rounded-rect"
                            >
                              {pendingFollowUpOption === option ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              {option}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {hasProposedActionsPanel ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-proposed-actions"
                  >
                    <div
                      className={cn(
                        plannerPathfinderTheme.raisedPanel,
                        "max-w-[88%] p-4",
                      )}
                    >
                      <Badge
                        variant="outline"
                        className={plannerPathfinderTheme.chip}
                      >
                        Suggestions
                      </Badge>
                      <div className="mt-3 space-y-3">
                        {visibleProposedActions.map((action, index) => {
                          const title = getProposedActionTitle(action);
                          const summary = getProposedActionSummary(action);
                          const isDraftable = isDraftableProposedAction(action);
                          const isCampaignStart =
                            isCampaignStartProposedAction(action);
                          const actionKey = getProposedActionKey(action);
                          const isActionPending =
                            pendingProposedActionKey === actionKey;
                          const readyActionLabel = isCampaignStart
                            ? "Start Campaign"
                            : "Draft";
                          const pendingActionLabel = isCampaignStart
                            ? "Opening Builder"
                            : "Drafting";
                          return (
                            <div
                              key={`${actionKey}-${index}`}
                              className="border-t border-celestial-blue/20 pt-3 first:border-t-0 first:pt-0"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">
                                      {title}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={plannerPathfinderTheme.chip}
                                    >
                                      {formatProposedActionType(action.type)}
                                    </Badge>
                                  </div>
                                  {summary ? (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {summary}
                                    </p>
                                  ) : null}
                                  {action.reason ? (
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                      {action.reason}
                                    </p>
                                  ) : null}
                                </div>
                                {isDraftable ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className={cn(
                                      plannerPathfinderTheme.primaryButton,
                                      "h-auto min-h-9 shrink-0 whitespace-normal leading-tight",
                                    )}
                                    onClick={() =>
                                      handleProposedActionDraft(action)
                                    }
                                    disabled={assistantActionDisabled}
                                  >
                                    {isActionPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Plus className="mr-2 h-4 w-4" />
                                    )}
                                    {isActionPending
                                      ? pendingActionLabel
                                      : readyActionLabel}
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                      plannerPathfinderTheme.outlineButton,
                                      "h-auto min-h-9 shrink-0 whitespace-normal leading-tight",
                                    )}
                                    onClick={() =>
                                      handleProposedActionDiscuss(action)
                                    }
                                    disabled={assistantActionDisabled}
                                  >
                                    {isActionPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                    )}
                                    {isActionPending ? "Discussing" : "Discuss"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {assistant.pendingAction ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-pending-action"
                    data-tutorial-avoid="true"
                  >
                    <div
                      className={cn(
                        plannerPathfinderTheme.raisedPanel,
                        "max-w-[88%] p-4",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={plannerPathfinderTheme.chip}
                        >
                          Pending confirmation
                        </Badge>
                        {assistant.readyPendingActionCount > 1 ? (
                          <Badge
                            variant="outline"
                            className={plannerPathfinderTheme.chip}
                          >
                            {assistant.readyPendingActionCount} ready
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={plannerPathfinderTheme.chip}
                        >
                          {assistant.pendingAction.actionType.replace(
                            /_/g,
                            " ",
                          )}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {assistant.pendingAction.summary}
                      </p>
                      {assistant.pendingAction.confirmationMessage ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assistant.pendingAction.confirmationMessage}
                        </p>
                      ) : null}
                      {assistant.readyPendingActionCount > 1 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {assistant.readyPendingActionCount} planner actions
                          are ready. Confirm all to save the batch, or confirm
                          them one at a time.
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {assistant.readyPendingActionCount > 1 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={plannerPathfinderTheme.outlineButton}
                            onClick={assistant.confirmAllPendingActions}
                            disabled={assistantActionDisabled}
                            data-tour="companion-plan-day-pending-confirm-all"
                            data-tour-shape="rounded-rect"
                          >
                            Confirm All ({assistant.readyPendingActionCount})
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className={plannerPathfinderTheme.primaryButton}
                          onClick={assistant.confirmPendingAction}
                          disabled={assistantActionDisabled}
                          data-tour="companion-plan-day-pending-confirm"
                          data-tour-shape="rounded-rect"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={plannerPathfinderTheme.outlineButton}
                          onClick={assistant.cancelPendingAction}
                          disabled={assistantActionDisabled}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div
              className={cn(
                plannerPathfinderTheme.footerBar,
                "p-3",
                isDrawerPresentation &&
                  "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
              )}
              data-tutorial-avoid="true"
              data-testid="journeys-companion-planner-footer"
            >
              {assistant.isRecording || assistant.interimText ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.raisedPanel,
                    "mb-3 px-3 py-3 text-foreground",
                  )}
                  data-testid="journeys-companion-planner-voice-preview"
                >
                  <AudioReactiveWaveform
                    isActive={
                      assistant.isRecording && !assistant.isAutoStopping
                    }
                    className="justify-start text-stardust-gold"
                  />
                  <p className="mt-2 text-sm text-foreground">
                    {assistant.interimText || "Listening for your reply..."}
                  </p>
                </div>
              ) : null}

              {assistant.isSpeaking ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.successCard,
                    "mb-3 flex items-center justify-between gap-3 px-3 py-3",
                  )}
                  data-testid="journeys-companion-planner-speaking-status"
                >
                  <div className="flex items-center gap-2 text-sm text-epic-nature">
                    <Waves className="h-4 w-4" />
                    Speaking{" "}
                    {assistant.speechProvider === "cloud"
                      ? "with fallback audio"
                      : "on-device"}
                    .
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-epic-nature hover:bg-epic-nature/10 hover:text-epic-nature"
                    onClick={assistant.stopSpeaking}
                  >
                    Stop
                  </Button>
                </div>
              ) : null}

              <div
                className={cn(
                  plannerPathfinderTheme.composerBar,
                  "flex-col items-stretch gap-2",
                )}
                data-tutorial-avoid="true"
              >
                <label
                  htmlFor="journeys-companion-chat-input"
                  className="sr-only"
                >
                  Message your companion
                </label>
                <Textarea
                  ref={composerRef}
                  id="journeys-companion-chat-input"
                  rows={2}
                  value={assistant.draftInput}
                  onChange={(event) => {
                    assistant.setDraftInput(event.target.value);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={assistant.placeholder}
                  className={cn(
                    plannerPathfinderTheme.textField,
                    "min-h-[72px] max-h-[260px] w-full resize-none leading-5",
                  )}
                  style={{ height: "72px", overflowY: "hidden" }}
                  data-tour="companion-plan-day-chat-input"
                  data-tour-shape="rounded-rect"
                  data-testid="journeys-companion-planner-text-input"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-11 w-11 shrink-0 rounded-full border border-[hsl(var(--celestial-blue)_/_0.3)] bg-card/80 text-[hsl(var(--celestial-blue))] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] hover:bg-card",
                      assistant.isRecording &&
                        "border-category-body/70 bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.34)_0%,hsl(var(--destructive)_/_0.22)_100%)] text-category-body",
                    )}
                    onClick={handleVoiceToggle}
                    disabled={
                      !assistant.isVoiceSupported && !assistant.isRecording
                    }
                    aria-label={micButtonLabel}
                    data-testid="journeys-companion-planner-mic-button"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={handleComposerSubmit}
                    disabled={sendDisabled}
                    className={cn(
                      plannerPathfinderTheme.primaryButton,
                      "h-11 shrink-0 px-4",
                    )}
                    data-tour="companion-plan-day-chat-send"
                    data-tour-shape="rounded-rect"
                    data-testid="journeys-companion-planner-send-button"
                  >
                    {assistant.isSubmitting || assistant.isResolvingAction ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Thinking
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PermissionRequestDialog
          isOpen={assistant.showPermissionDialog}
          onClose={() => assistant.setShowPermissionDialog(false)}
          onRequestPermission={assistant.requestMicrophonePermission}
          permissionStatus={assistant.permissionStatus}
          isRequesting={assistant.isRequestingPermission}
        />

        <JourneysCompanionThreadPicker
          open={isThreadPickerOpen}
          onOpenChange={setIsThreadPickerOpen}
          presentation={presentation}
          historyThreads={assistant.historyThreads}
          isLoading={assistant.isLoadingThreads}
          canResumeThreads={assistant.canOpenThreadPicker}
          emptyStateMessage={assistant.threadHistoryEmptyStateMessage}
          onResumeThread={handleResumeThread}
        />
      </div>
    );
  },
);

JourneysCompanionOverlayBody.displayName = "JourneysCompanionOverlayBody";

export const JourneysCompanionPlannerModal = memo(
  function JourneysCompanionPlannerModal({
    open,
    onOpenChange,
    presentation,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    onQuestProposalEditHandoff,
  }: JourneysCompanionPlannerModalProps) {
    const [drawerLayout, setDrawerLayout] =
      useState<JourneysCompanionDrawerLayout>(() => getDrawerLayout());

    useEffect(() => {
      if (presentation !== "drawer" || !open) return;

      const syncLayout = () => {
        setDrawerLayout(getDrawerLayout());
      };

      syncLayout();
      window.addEventListener("resize", syncLayout);
      window.visualViewport?.addEventListener("resize", syncLayout);
      window.visualViewport?.addEventListener("scroll", syncLayout);

      return () => {
        window.removeEventListener("resize", syncLayout);
        window.visualViewport?.removeEventListener("resize", syncLayout);
        window.visualViewport?.removeEventListener("scroll", syncLayout);
      };
    }, [open, presentation]);

    const body = (
      <JourneysCompanionOverlayBody
        presentation={presentation}
        launchIntent={launchIntent}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
        onOpenCampaignBuilder={onOpenCampaignBuilder}
        onQuestProposalEditHandoff={onQuestProposalEditHandoff}
        drawerLayout={presentation === "drawer" ? drawerLayout : undefined}
      />
    );

    if (presentation === "dialog") {
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-4xl border-none bg-transparent p-0 shadow-none"
            hideCloseButton
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Cosmiq companion</DialogTitle>
              <DialogDescription>
                Talk with Cosmiq about your day, schedule, and plans.
              </DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent
          className="max-h-none border-none bg-transparent p-0 shadow-none"
          style={{ bottom: `${drawerLayout.bottomInset}px` }}
          data-testid="journeys-companion-planner-drawer-content"
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Cosmiq companion</DrawerTitle>
            <DrawerDescription>
              Talk with Cosmiq about your day, schedule, and plans.
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  },
);
