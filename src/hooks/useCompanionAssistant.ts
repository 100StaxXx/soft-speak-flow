import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useLegacyCompanionAssistantAdapter } from "@/hooks/useLegacyCompanionAssistantAdapter";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { stripMarkdown } from "@/lib/utils";
import {
  buildCompanionThreadPreview,
  buildCompanionThreadTitle,
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  listCompanionChatThreads,
  loadCompanionChatThreadMessages,
  loadCompanionPendingAction,
  readCompanionThreadReceiptProposalId,
  setCompanionChatThreadArchived,
} from "@/services/companionChatThreads";
import { hasActiveSupabaseFunctionSession } from "@/services/supabaseFunctionSession";
import {
  type CompanionSpeechProvider,
  speakCompanionReply,
  stopCompanionSpeech,
} from "@/services/companionSpeech";
import { COMPANION_PLANNER_QUEST_CAPTURE_OPENING } from "@/shared/companionPlannerSurfaceActions";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import { getRandomCompanionChatOpeningLine } from "@/shared/companionChatOpeners";
import {
  analyzeSchedulingIntent,
  isUpcomingScheduleDigestMessage,
} from "@/shared/schedulingIntent";
import {
  resolveCompanionDisplayLabel,
  toPossessiveCompanionLabel,
} from "@/lib/companionDisplayLabel";
import type {
  ActionReceiptView,
  CompanionAgentFollowUp,
  CompanionAgentProposedAction,
  CompanionAgentResponse,
  CompanionAgentSelectedProposedActionIntent,
  CompanionAgentTurnOrigin,
  CompanionAgentUnderstandingState,
  CompanionDraftOpportunityResponse,
  PendingActionView,
} from "@/types/companionAgent";
import type {
  CompanionChatRequest,
  CompanionChatInputMode,
  CompanionChatOpenerResponse,
  CompanionChatResponse,
  CompanionChatSource,
  CompanionChatSurface,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";
import {
  COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON,
  COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE,
  isCompanionChatSetupError,
} from "@/utils/companionChatSetup";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import {
  type ParsedFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
import { resolveCompanionChatError } from "@/utils/companionChatErrors";

export type CompanionAssistantSurface = "companion" | "journeys";

export interface CompanionAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: CompanionChatSource;
  isSeed?: boolean;
  understandingState?: CompanionAgentUnderstandingState;
  followUp?: CompanionAgentFollowUp | null;
  proposedActions?: CompanionAgentProposedAction[];
  assumptions?: string[];
  evidenceIds?: string[];
  structuredResponse?: CompanionAgentResponse["structuredResponse"];
  pendingAction?: PendingActionView;
  receipt?: ActionReceiptView;
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  defaultSelectedDate?: string | null;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

interface CachedCompanionThreadUiState {
  messages: CompanionAssistantMessage[];
  structuredResponse: CompanionAgentResponse["structuredResponse"];
  activeFollowUp: CompanionAgentFollowUp | null;
  understandingState: CompanionAgentUnderstandingState | null;
  proposedActions: CompanionAgentProposedAction[];
  savedSuggestionProposalIds: string[];
  lastStarterIntent: CompanionPlannerLaunchIntent["starterIntent"] | null;
  lastReplayablePlannerMessage: string | null;
}

type ThreadsQueryResult = {
  threads: CompanionChatThreadSummary[];
  setupUnavailable: boolean;
};

const MAX_ACTIVE_PROPOSED_ACTIONS = 8;
const MAX_DIRECT_CHAT_HISTORY_MESSAGES = 8;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeSelectedDateKey = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return DATE_KEY_PATTERN.test(trimmed) ? trimmed : null;
};

const readFollowUpBriefingContext = (
  followUp: CompanionAgentFollowUp | null | undefined,
): CompanionPlannerLaunchIntent["briefingContext"] => {
  const value = followUp?.metadata?.briefingContext;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.content !== "string" || !candidate.content.trim()) {
    return null;
  }

  return {
    content: candidate.content,
    actionPrompt:
      typeof candidate.actionPrompt === "string"
        ? candidate.actionPrompt
        : null,
    focus: typeof candidate.focus === "string" ? candidate.focus : null,
    inferredGoals: Array.isArray(candidate.inferredGoals)
      ? candidate.inferredGoals.filter(
          (goal): goal is string => typeof goal === "string",
        )
      : undefined,
    dataSnapshot:
      candidate.dataSnapshot &&
      typeof candidate.dataSnapshot === "object" &&
      !Array.isArray(candidate.dataSnapshot)
        ? (candidate.dataSnapshot as Record<string, unknown>)
        : null,
  };
};

type CompanionAgentSubmitOptions = {
  starterIntent?: CompanionPlannerLaunchIntent["starterIntent"];
  turnOrigin?: CompanionAgentTurnOrigin;
  selectedDate?: string | null;
  briefingContext?: CompanionPlannerLaunchIntent["briefingContext"];
  selectedProposedAction?: CompanionAgentProposedAction | null;
  selectedProposedActionIntent?: CompanionAgentSelectedProposedActionIntent;
};

type CompanionTemplateThreadOptions = {
  greetingText?: string | null;
  visibleAssistantOpening?: boolean;
};

type PendingLegacyFallbackReplay = {
  message: string;
  inputMode: CompanionChatInputMode;
  options?: CompanionAgentSubmitOptions;
  pendingStarterIntent: CompanionPlannerLaunchIntent["starterIntent"] | null;
  shouldConsumePendingStarterIntent: boolean;
};

const hasPlanDaySnapshotBriefing = (
  launchIntent: CompanionPlannerLaunchIntent | null | undefined,
) =>
  launchIntent?.starterIntent === "plan_day" &&
  Boolean(launchIntent.briefingContext?.dataSnapshot);

const readFollowUpSelectedDate = (
  followUp: CompanionAgentFollowUp | null | undefined,
) => {
  const value = followUp?.metadata?.selectedDate;
  return typeof value === "string" ? normalizeSelectedDateKey(value) : null;
};

const inferStarterIntentFromMessage = (
  message: string,
): CompanionPlannerLaunchIntent["starterIntent"] | undefined =>
  isUpcomingScheduleDigestMessage(message) ? "upcoming_start" : undefined;

const shouldApplyDefaultSelectedDateToStarterIntent = (
  starterIntent: CompanionPlannerLaunchIntent["starterIntent"] | null | undefined,
) =>
  Boolean(starterIntent) &&
  starterIntent !== "free_talk_start" &&
  starterIntent !== "thread_history" &&
  starterIntent !== "quest_capture";

const parseDraftOpportunityActions = (
  response: CompanionDraftOpportunityResponse,
): CompanionAgentProposedAction[] =>
  Array.isArray(response.proposedActions)
    ? response.proposedActions.filter(
        (action): action is CompanionAgentProposedAction =>
          Boolean(action) &&
          typeof action === "object" &&
          !Array.isArray(action) &&
          typeof (action as Record<string, unknown>).type === "string",
      )
    : [];

const shouldRequestDraftOpportunitySidecar = (params: {
  surface: CompanionAssistantSurface;
  response: CompanionAgentResponse;
  selectedProposedAction?: CompanionAgentProposedAction | null;
}) => {
  const { surface, response, selectedProposedAction } = params;
  if (surface !== "journeys") return false;
  if (selectedProposedAction) return false;
  if (response.pendingAction) return false;
  if (response.followUp) return false;
  if ((response.proposedActions?.length ?? 0) > 0) return false;
  if (response.structuredResponse) return false;
  if (response.mode === "pending_confirmation") return false;
  if (response.mode === "schedule_read") return false;
  if (response.intent === "check_calendar") return false;
  if (response.understandingState === "ready_to_draft") return false;
  return true;
};

const shouldUseDirectCompanionChat = (params: {
  surface: CompanionAssistantSurface;
  message: string;
  starterIntent?: CompanionPlannerLaunchIntent["starterIntent"] | null;
  turnOrigin?: CompanionAgentTurnOrigin;
  selectedDate?: string | null;
  selectedProposedAction?: CompanionAgentProposedAction | null;
  activeFollowUp?: CompanionAgentFollowUp | null;
  pendingAction?: PendingActionView | null;
  proposedActions: CompanionAgentProposedAction[];
}) => {
  if (params.selectedProposedAction) return false;
  if (params.activeFollowUp) return false;
  if (params.pendingAction) return false;
  if (params.proposedActions.length > 0) return false;
  if (params.selectedDate) return false;
  if (
    params.turnOrigin === "follow_up_option" ||
    params.turnOrigin === "proposed_action"
  ) {
    return false;
  }
  if (params.starterIntent && params.starterIntent !== "free_talk_start") {
    return false;
  }

  const parsed = parseNaturalLanguage(params.message);
  const analysis = analyzeSchedulingIntent(params.message, parsed);

  if (analysis.isExternalInfoQuestion) return true;
  if (
    params.surface === "companion" &&
    analysis.disposition === "schedule_action" &&
    !analysis.hasExplicitPlannerAction &&
    !analysis.isAggressiveBundle &&
    !analysis.isOpportunisticSingle
  ) {
    return true;
  }

  if (analysis.disposition === "schedule_action") return false;
  if (analysis.isScheduleRead) return false;
  if (analysis.isDirectDayPlanning) return false;
  if (analysis.isChatFirstCoaching) return false;
  if (analysis.hasExplicitPlannerAction) return false;
  if (analysis.hasConcreteSchedulingPayload) return false;
  if (analysis.isAggressiveBundle || analysis.isOpportunisticSingle) {
    return false;
  }

  return true;
};

const buildDirectChatHistory = (
  messages: CompanionAssistantMessage[],
): CompanionChatRequest["conversationHistory"] =>
  messages
    .filter((message) => !message.isSeed)
    .slice(-MAX_DIRECT_CHAT_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

const generateMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createMessage = (
  role: CompanionAssistantMessage["role"],
  content: string,
  extras: Partial<CompanionAssistantMessage> = {},
): CompanionAssistantMessage => ({
  id: generateMessageId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  source: "agent",
  ...extras,
});

const isJsonValue = (value: unknown): value is Json => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return false;
    }

    return Object.values(value).every((entry) => isJsonValue(entry));
  }

  return false;
};

const emitPlanDayAiAnsweredEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("companion-plan-my-day-ai-answered"));
};

const emitPlanDayActionSavedEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("companion-plan-my-day-action-saved"));
};

const mapLoadedMessage = (
  message: Awaited<ReturnType<typeof loadCompanionChatThreadMessages>>[number],
): CompanionAssistantMessage => {
  const metadata =
    message.metadata &&
    typeof message.metadata === "object" &&
    !Array.isArray(message.metadata)
      ? (message.metadata as Record<string, unknown>)
      : null;

  const parsePendingAction = (
    value: unknown,
  ): PendingActionView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const pendingAction = value as Record<string, unknown>;
    if (
      typeof pendingAction.id !== "string" ||
      typeof pendingAction.status !== "string" ||
      typeof pendingAction.intent !== "string" ||
      typeof pendingAction.actionType !== "string" ||
      typeof pendingAction.summary !== "string" ||
      typeof pendingAction.createdAt !== "string" ||
      typeof pendingAction.expiresAt !== "string"
    ) {
      return undefined;
    }

    return {
      id: pendingAction.id,
      status: pendingAction.status as PendingActionView["status"],
      intent: pendingAction.intent as PendingActionView["intent"],
      actionType: pendingAction.actionType as PendingActionView["actionType"],
      proposalId:
        typeof pendingAction.proposalId === "string"
          ? pendingAction.proposalId
          : null,
      summary: pendingAction.summary,
      confirmationMessage:
        typeof pendingAction.confirmationMessage === "string"
          ? pendingAction.confirmationMessage
          : null,
      normalizedPayload: isJsonValue(pendingAction.normalizedPayload)
        ? pendingAction.normalizedPayload
        : {},
      affectedEntities: isJsonValue(pendingAction.affectedEntities)
        ? pendingAction.affectedEntities
        : null,
      expiresAt: pendingAction.expiresAt,
      createdAt: pendingAction.createdAt,
    };
  };

  const parseReceipt = (value: unknown): ActionReceiptView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const receipt = value as Record<string, unknown>;
    if (
      typeof receipt.actionId !== "string" ||
      typeof receipt.status !== "string" ||
      typeof receipt.message !== "string" ||
      typeof receipt.createdAt !== "string"
    ) {
      return undefined;
    }

    return {
      actionId: receipt.actionId,
      status: receipt.status as ActionReceiptView["status"],
      proposalId:
        typeof receipt.proposalId === "string" ? receipt.proposalId : null,
      message: receipt.message,
      summary: typeof receipt.summary === "string" ? receipt.summary : null,
      createdAt: receipt.createdAt,
      executionResult: isJsonValue(receipt.executionResult)
        ? receipt.executionResult
        : null,
      executionError: isJsonValue(receipt.executionError)
        ? receipt.executionError
        : null,
    };
  };

  const parseUnderstandingState = (value: unknown) =>
    value === "needs_followup" ||
    value === "enough_to_discuss" ||
    value === "ready_to_propose" ||
    value === "ready_to_draft"
      ? (value as CompanionAgentUnderstandingState)
      : undefined;

  const parseFollowUp = (value: unknown): CompanionAgentFollowUp | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const followUp = value as Record<string, unknown>;
    if (typeof followUp.question !== "string") return null;

    const expectedAnswerType =
      followUp.expectedAnswerType === "choice" ||
      followUp.expectedAnswerType === "time" ||
      followUp.expectedAnswerType === "priority" ||
      followUp.expectedAnswerType === "confirmation" ||
      followUp.expectedAnswerType === "free_text"
        ? followUp.expectedAnswerType
        : "free_text";

    return {
      question: followUp.question,
      reason: typeof followUp.reason === "string" ? followUp.reason : null,
      expectedAnswerType,
      options: Array.isArray(followUp.options)
        ? followUp.options.filter(
            (option): option is string => typeof option === "string",
          )
        : undefined,
      blocksDrafting:
        typeof followUp.blocksDrafting === "boolean"
          ? followUp.blocksDrafting
          : true,
      metadata:
        isJsonValue(followUp.metadata) &&
        typeof followUp.metadata === "object" &&
        !Array.isArray(followUp.metadata)
          ? (followUp.metadata as Record<string, Json>)
          : undefined,
    };
  };

  const parseProposedActions = (
    value: unknown,
  ): CompanionAgentProposedAction[] =>
    Array.isArray(value)
      ? value.filter(
          (entry): entry is CompanionAgentProposedAction =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry) &&
            typeof (entry as Record<string, unknown>).type === "string",
        )
      : [];

  const parseStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];

  const agentDecision =
    metadata &&
    typeof metadata.agentDecision === "object" &&
    metadata.agentDecision !== null &&
    !Array.isArray(metadata.agentDecision)
      ? (metadata.agentDecision as Record<string, unknown>)
      : null;

  const structuredResponse =
    metadata && "structuredResponse" in metadata
      ? ((metadata.structuredResponse as CompanionAgentResponse["structuredResponse"]) ??
        null)
      : undefined;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: message.source,
    understandingState: parseUnderstandingState(
      agentDecision?.understandingState,
    ),
    followUp: parseFollowUp(agentDecision?.followUp),
    proposedActions: parseProposedActions(agentDecision?.proposedActions),
    assumptions: parseStringArray(agentDecision?.assumptions),
    evidenceIds: parseStringArray(agentDecision?.evidenceIds),
    structuredResponse,
    pendingAction: parsePendingAction(metadata?.pendingAction),
    receipt: parseReceipt(metadata?.receipt),
  };
};

const getTodayLabel = () =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

const inferStarterIntentFromStructuredResponse = (
  response: CompanionAgentResponse["structuredResponse"],
): CompanionPlannerLaunchIntent["starterIntent"] | null => {
  if (response?.planDay) return "plan_day";
  if (response?.weeklyPlan) return "plan_week";
  if (response?.priorityOverview) {
    return response.priorityOverview.title.toLowerCase().includes("make room")
      ? "make_room"
      : "what_matters";
  }
  if (response?.reflectionBridge) return "briefing_followup";
  if (response?.campaignMomentum) return "advance_campaign_start";
  if (response?.comingUp) return "upcoming_start";
  return null;
};

const isPlanDayStarterMessage = (value: string): boolean =>
  /\b(plan my day|help me plan(?: my day| today)|plan today)\b/i.test(value);

const hasRecentPlanDayStarter = (messages: CompanionAssistantMessage[]) =>
  messages
    .slice(-6)
    .some(
      (message) =>
        message.role === "user" && isPlanDayStarterMessage(message.content),
    );

const collectStructuredResponseSectionKeys = (
  response: CompanionAgentResponse["structuredResponse"],
) => {
  if (!response) return [] as string[];

  return [
    response.planDay ? "planDay" : null,
    response.weeklyPlan ? "weeklyPlan" : null,
    response.priorityOverview ? "priorityOverview" : null,
    response.reflectionBridge ? "reflectionBridge" : null,
    response.comingUp ? "comingUp" : null,
    response.campaignMomentum ? "campaignMomentum" : null,
  ].filter((section): section is string => Boolean(section));
};

const collectProposalIdsFromStructuredResponse = (
  response: CompanionAgentResponse["structuredResponse"],
) => {
  const proposalIds = new Set<string>();
  const collectQuest = (quest: { proposalId?: string | null }) => {
    if (typeof quest.proposalId === "string" && quest.proposalId.length > 0) {
      proposalIds.add(quest.proposalId);
    }
  };

  response?.planDay?.suggestedQuests.forEach(collectQuest);
  response?.weeklyPlan?.topPriorities.forEach(collectQuest);
  response?.priorityOverview?.topPriorities.forEach(collectQuest);
  if (response?.reflectionBridge?.firstAction) {
    collectQuest(response.reflectionBridge.firstAction);
  }
  if (response?.comingUp?.nextBestAction) {
    collectQuest(response.comingUp.nextBestAction);
  }
  if (response?.campaignMomentum?.nextStep) {
    collectQuest(response.campaignMomentum.nextStep);
  }
  response?.campaignMomentum?.supportActions.forEach(collectQuest);

  return proposalIds;
};

const pruneProposalIdsToStructuredResponse = (
  proposalIds: string[],
  response: CompanionAgentResponse["structuredResponse"],
) => {
  if (!response) return [];
  const visibleProposalIds = collectProposalIdsFromStructuredResponse(response);
  return proposalIds.filter((proposalId) => visibleProposalIds.has(proposalId));
};

const deriveStructuredResponseFromMessages = (
  messages: CompanionAssistantMessage[],
) => {
  let currentStructuredResponse: CompanionAgentResponse["structuredResponse"] =
    null;

  for (const message of messages) {
    if (
      message.role !== "assistant" ||
      message.structuredResponse === undefined
    ) {
      continue;
    }

    currentStructuredResponse = message.structuredResponse ?? null;
  }

  return currentStructuredResponse;
};

const deriveLatestAgentDecisionFromMessages = (
  messages: CompanionAssistantMessage[],
) => {
  let current: {
    activeFollowUp: CompanionAgentFollowUp | null;
    understandingState: CompanionAgentUnderstandingState | null;
    proposedActions: CompanionAgentProposedAction[];
  } = {
    activeFollowUp: null,
    understandingState: null,
    proposedActions: [],
  };

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const hasDecision =
      message.understandingState !== undefined ||
      message.followUp !== undefined ||
      message.proposedActions !== undefined;
    if (!hasDecision) continue;

    current = {
      activeFollowUp: message.followUp ?? null,
      understandingState: message.understandingState ?? null,
      proposedActions: message.proposedActions ?? [],
    };
  }

  return current;
};

const collectSavedProposalIdsFromMessages = (
  messages: CompanionAssistantMessage[],
) => {
  const proposalIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const proposalId = readCompanionThreadReceiptProposalId(message.receipt);
    if (!proposalId) continue;
    if (message.receipt?.status !== "executed") continue;
    proposalIds.add(proposalId);
  }

  return [...proposalIds];
};

const isSyntheticResolutionMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return normalized === "confirm" || normalized === "cancel";
};

const getParsedFunctionCode = (parsed: ParsedFunctionInvokeError) =>
  parsed.responsePayload?.code ?? parsed.code;

const getCompanionAgentErrorSource = (parsed: ParsedFunctionInvokeError) =>
  [
    parsed.name,
    parsed.message,
    parsed.backendMessage,
    parsed.responsePayload?.error,
    parsed.responsePayload?.message,
    parsed.responsePayload?.code,
    parsed.stage,
    parsed.failureReason,
    parsed.responsePayload?.stage,
    parsed.responsePayload?.failureReason,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join(" ")
    .toLowerCase();

const hasCompanionAgentSchemaSignal = (source: string) =>
  source.includes("does not exist") ||
  source.includes("undefined_table") ||
  source.includes("undefined_column") ||
  source.includes("undefined_function") ||
  source.includes("schema cache") ||
  source.includes("relation") ||
  source.includes("column");

const isMissingCompanionAgentFunctionError = (
  parsed: ParsedFunctionInvokeError,
) => {
  const code = getParsedFunctionCode(parsed)?.toLowerCase() ?? "";
  const source = getCompanionAgentErrorSource(parsed);

  return (
    code.includes("function_not_found") ||
    source.includes("function not found") ||
    source.includes("no route matched") ||
    source.includes("could not find function") ||
    source.includes("could not find the function") ||
    (parsed.status === 404 && !parsed.backendMessage)
  );
};

const isCompanionAgentSetupError = (parsed: ParsedFunctionInvokeError) => {
  const code = getParsedFunctionCode(parsed)?.toLowerCase() ?? "";
  const source = getCompanionAgentErrorSource(parsed);
  const failureReason = [
    parsed.failureReason,
    parsed.responsePayload?.failureReason,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join(" ")
    .toLowerCase();

  if (
    code === "service_misconfigured" ||
    code === "abuse_check_failed" ||
    code === "companion_agent_setup_failed" ||
    failureReason.includes("schema_mismatch")
  ) {
    return true;
  }

  if (!hasCompanionAgentSchemaSignal(source)) return false;

  return [
    "companion_chats",
    "companion_chat_threads",
    "companion_pending_actions",
    "openai_conversation_id",
    "last_openai_response_id",
    "companion_mode",
    "companion_mode_adaptation_enabled",
    "consume_abuse_protection",
    "abuse_protection_config",
    "cost_guardrail_config",
    "cost_guardrail_state",
    "user_companion",
    "daily_tasks",
    "companion_memories",
    "user_reflections",
    "daily_check_ins",
    "focus_sessions",
    "habits",
    "epics",
    "user_ai_learning",
    "user_ai_preferences",
    "daily_planning_preferences",
    "profiles",
  ].some((token) => source.includes(token));
};

const toUserFacingCompanionAgentError = (parsed: ParsedFunctionInvokeError) => {
  const code = getParsedFunctionCode(parsed)?.toUpperCase();

  if (code === "COST_GUARDRAIL_BLOCKED") {
    return "Companion Agent is temporarily paused in this environment. Please try again later.";
  }

  if (isMissingCompanionAgentFunctionError(parsed)) {
    return "Companion Agent isn't live in this environment yet. Please try again after the backend is updated.";
  }

  if (isCompanionAgentSetupError(parsed)) {
    return "Companion Agent is still being set up here. Please try again after the latest backend update.";
  }

  return toUserFacingFunctionError(parsed, { action: "send your message" });
};

const isProtectedCompanionAgentFailure = (
  parsed: ParsedFunctionInvokeError,
) => {
  const code = getParsedFunctionCode(parsed)?.toLowerCase() ?? "";
  return (
    parsed.status === 401 ||
    parsed.status === 403 ||
    parsed.status === 429 ||
    code === "unauthorized" ||
    code === "forbidden" ||
    code === "rate_limited" ||
    code === "cooldown_active" ||
    code === "abuse_check_failed" ||
    code === "cost_guardrail_blocked"
  );
};

const shouldFallbackToLegacyAgent = (
  parsed: ParsedFunctionInvokeError,
  options?: { allowReadOnlyScheduleFallback?: boolean },
) => {
  const source = getCompanionAgentErrorSource(parsed);

  const hasSchemaSignal =
    source.includes("does not exist") ||
    source.includes("undefined_table") ||
    source.includes("undefined_column") ||
    source.includes("undefined_function") ||
    source.includes("schema cache") ||
    source.includes("relation") ||
    source.includes("column");

  const missingOrKnownSchemaFallback =
    isMissingCompanionAgentFunctionError(parsed) ||
    (hasSchemaSignal &&
      (source.includes("companion_pending_actions") ||
        source.includes("openai_conversation_id") ||
        source.includes("last_openai_response_id") ||
        source.includes("companion_mode") ||
        source.includes("companion_mode_adaptation_enabled")));

  if (missingOrKnownSchemaFallback) return true;

  if (
    options?.allowReadOnlyScheduleFallback &&
    !isProtectedCompanionAgentFailure(parsed)
  ) {
    const code = getParsedFunctionCode(parsed)?.toLowerCase() ?? "";
    return (
      code === "companion_agent_failed" ||
      code === "companion_agent_setup_failed" ||
      isCompanionAgentSetupError(parsed) ||
      parsed.category === "network" ||
      (typeof parsed.status === "number" &&
        parsed.status >= 500 &&
        parsed.status < 600)
    );
  }

  return false;
};

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
  defaultSelectedDate = null,
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: UseCompanionAssistantOptions) {
  const { user, refreshSession } = useAuth();
  const { companion } = useCompanion();
  const { greeting, voiceStyle } = useCompanionDialogue();
  const { trackInteraction } = useAIInteractionTracker();
  const { autoplayVoice, muteSpokenReplies } = useCompanionVoiceSettings();
  const queryClient = useQueryClient();
  const [useLegacyFallback, setUseLegacyFallback] = useState(false);
  const unifiedAgentActive = !useLegacyFallback;
  const localScheduleReadEnabled = surface === "journeys";

  const legacyAssistant = useLegacyCompanionAssistantAdapter({
    enabled: useLegacyFallback || localScheduleReadEnabled,
    surface,
    conversationEnabled,
    onOpenCampaignBuilder,
    plannerFallbackMode: "read_only",
  });

  const [activeSessionId, setActiveSessionId] = useState(() =>
    generateCompanionThreadSessionId(),
  );
  const activeSessionIdRef = useRef(activeSessionId);
  const applyActiveSessionId = useCallback((nextSessionId: string) => {
    activeSessionIdRef.current = nextSessionId;
    setActiveSessionId(nextSessionId);
  }, []);
  const [messages, setMessages] = useState<CompanionAssistantMessage[]>([]);
  const [structuredResponse, setStructuredResponse] =
    useState<CompanionAgentResponse["structuredResponse"]>(null);
  const [activeFollowUp, setActiveFollowUp] =
    useState<CompanionAgentFollowUp | null>(null);
  const [understandingState, setUnderstandingState] =
    useState<CompanionAgentUnderstandingState | null>(null);
  const [proposedActions, setProposedActions] = useState<
    CompanionAgentProposedAction[]
  >([]);
  const [pendingAction, setPendingAction] = useState<PendingActionView | null>(
    null,
  );
  const [savedSuggestionProposalIds, setSavedSuggestionProposalIds] = useState<
    string[]
  >([]);
  const [pendingSuggestionProposalId, setPendingSuggestionProposalId] =
    useState<string | null>(null);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isOpeningThread, setIsOpeningThread] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authSessionUnavailable, setAuthSessionUnavailable] = useState(false);
  const [isResolvingAction, setIsResolvingAction] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] =
    useState<CompanionSpeechProvider>("none");

  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeRef = useRef<string | null>(null);
  const companionOpenCycleKeyRef = useRef<string | null>(null);
  const threadMutationVersionRef = useRef(0);
  const handledLaunchIntentIdRef = useRef<string | null>(null);
  const threadUiStateCacheRef = useRef<
    Map<string, CachedCompanionThreadUiState>
  >(new Map());
  const lastStarterIntentRef = useRef<
    CompanionPlannerLaunchIntent["starterIntent"] | null
  >(null);
  const lastReplayablePlannerMessageRef = useRef<string | null>(null);
  const pendingStarterIntentRef = useRef<
    CompanionPlannerLaunchIntent["starterIntent"] | null
  >(null);
  const pendingQuestCaptureSelectedDateRef = useRef<string | null>(null);
  const pendingLegacyFallbackReplayRef =
    useRef<PendingLegacyFallbackReplay | null>(null);
  const submitInFlightRef = useRef(false);
  const [legacyFallbackReplayKey, setLegacyFallbackReplayKey] = useState(0);

  const scopeKey = `${surface}:${user?.id ?? "anon"}:${
    companion?.id ?? "none"
  }`;
  const baseGreeting =
    surface === "journeys"
      ? getCompanionPlannerOpener({ userId: user?.id ?? null })
      : greeting;
  const companionLabel = useMemo(
    () => resolveCompanionDisplayLabel(companion, "Cosmiq"),
    [companion],
  );
  const todayLabel = getTodayLabel();
  const placeholder = pendingAction
    ? "Reply here or confirm the pending action."
    : activeFollowUp
      ? `Answer ${toPossessiveCompanionLabel(companionLabel)} follow-up.`
      : surface === "journeys"
        ? `Talk to ${companionLabel}`
        : `Talk to ${companionLabel} naturally.`;
  const ensureFunctionSession = useCallback(
    async (options?: { silent?: boolean }) => {
      const hasSession = await hasActiveSupabaseFunctionSession(refreshSession);

      if (!hasSession) {
        setAuthSessionUnavailable(true);
        if (!options?.silent) {
          toast.error(
            "Your session has expired. Please sign in again and try to talk with your companion.",
          );
        }
        return false;
      }

      setAuthSessionUnavailable(false);
      return true;
    },
    [refreshSession],
  );

  const threadsQuery = useQuery({
    queryKey: getCompanionChatThreadsQueryKey(user?.id, companion?.id, surface),
    enabled: unifiedAgentActive && !!user?.id && !!companion?.id,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ThreadsQueryResult> => {
      if (!companion?.id) {
        return {
          threads: [],
          setupUnavailable: false,
        };
      }

      try {
        return {
          threads: await listCompanionChatThreads(companion.id, surface),
          setupUnavailable: false,
        };
      } catch (error) {
        if (!isCompanionChatSetupError(error)) {
          throw error;
        }

        return {
          threads: [],
          setupUnavailable: true,
        };
      }
    },
  });

  const openFreshThread = useCallback(
    (options?: {
      sessionId?: string;
      greetingText?: string;
      markBootstrapped?: boolean;
      visibleAssistantOpening?: boolean;
    }) => {
      threadMutationVersionRef.current += 1;
      const nextSessionId =
        options?.sessionId ?? generateCompanionThreadSessionId();
      const greetingText = options?.greetingText?.trim();
      localThreadCreatedAtRef.current = new Date().toISOString();
      applyActiveSessionId(nextSessionId);
      setDraftInput("");
      setInterimText("");
      setStructuredResponse(null);
      setActiveFollowUp(null);
      setUnderstandingState(null);
      setProposedActions([]);
      setPendingAction(null);
      setSavedSuggestionProposalIds([]);
      setPendingSuggestionProposalId(null);
      lastStarterIntentRef.current = null;
      lastReplayablePlannerMessageRef.current = null;
      pendingStarterIntentRef.current = null;
      pendingQuestCaptureSelectedDateRef.current = null;
      setMessages(
        greetingText
          ? [
              createMessage("assistant", greetingText, {
                ...(options?.visibleAssistantOpening ? {} : { isSeed: true }),
                source: "agent",
              }),
            ]
          : [],
      );

      if (options?.markBootstrapped) {
        bootstrappedScopeRef.current = scopeKey;
      }

      return nextSessionId;
    },
    [applyActiveSessionId, scopeKey],
  );

  useEffect(() => {
    if (!activeSessionIdRef.current) return;

    threadUiStateCacheRef.current.set(activeSessionIdRef.current, {
      messages,
      structuredResponse,
      activeFollowUp,
      understandingState,
      proposedActions,
      savedSuggestionProposalIds,
      lastStarterIntent: lastStarterIntentRef.current,
      lastReplayablePlannerMessage: lastReplayablePlannerMessageRef.current,
    });
  }, [
    messages,
    activeFollowUp,
    proposedActions,
    savedSuggestionProposalIds,
    structuredResponse,
    understandingState,
  ]);

  const loadThreadState = useCallback(
    async (
      sessionId: string,
      options?: {
        expectedMutationVersion?: number;
      },
    ) => {
      const [threadMessages, loadedPendingAction] = await Promise.all([
        loadCompanionChatThreadMessages(sessionId, surface),
        loadCompanionPendingAction(sessionId),
      ]);

      if (
        options?.expectedMutationVersion !== undefined &&
        threadMutationVersionRef.current !== options.expectedMutationVersion
      ) {
        return false;
      }

      const cachedThreadUiState =
        threadUiStateCacheRef.current.get(sessionId) ?? null;
      const mappedThreadMessages =
        cachedThreadUiState?.messages ?? threadMessages.map(mapLoadedMessage);
      const restoredStructuredResponse =
        cachedThreadUiState?.structuredResponse ??
        deriveStructuredResponseFromMessages(mappedThreadMessages);
      const restoredDecision = cachedThreadUiState
        ? {
            activeFollowUp: cachedThreadUiState.activeFollowUp,
            understandingState: cachedThreadUiState.understandingState,
            proposedActions: cachedThreadUiState.proposedActions,
          }
        : deriveLatestAgentDecisionFromMessages(mappedThreadMessages);
      const restoredSavedProposalIds =
        cachedThreadUiState?.savedSuggestionProposalIds ??
        collectSavedProposalIdsFromMessages(mappedThreadMessages);

      localThreadCreatedAtRef.current =
        threadMessages[0]?.createdAt ?? new Date().toISOString();
      applyActiveSessionId(sessionId);
      setMessages(mappedThreadMessages);
      setStructuredResponse(restoredStructuredResponse);
      setActiveFollowUp(restoredDecision.activeFollowUp);
      setUnderstandingState(restoredDecision.understandingState);
      setProposedActions(restoredDecision.proposedActions);
      setPendingAction(loadedPendingAction);
      setSavedSuggestionProposalIds(
        pruneProposalIdsToStructuredResponse(
          restoredSavedProposalIds,
          restoredStructuredResponse,
        ),
      );
      setPendingSuggestionProposalId(loadedPendingAction?.proposalId ?? null);
      setDraftInput("");
      setInterimText("");
      lastStarterIntentRef.current =
        cachedThreadUiState?.lastStarterIntent ?? null;
      lastReplayablePlannerMessageRef.current =
        cachedThreadUiState?.lastReplayablePlannerMessage ?? null;
      pendingStarterIntentRef.current = null;
      pendingQuestCaptureSelectedDateRef.current = null;
      return true;
    },
    [applyActiveSessionId, surface],
  );

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    setUseLegacyFallback(false);
    pendingLegacyFallbackReplayRef.current = null;
    bootstrappedScopeRef.current = null;
    companionOpenCycleKeyRef.current = null;
    handledLaunchIntentIdRef.current = null;
    threadUiStateCacheRef.current.clear();
    if (surface === "companion") {
      openFreshThread();
      return;
    }
    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [baseGreeting, openFreshThread, scopeKey, surface]);

  useEffect(() => {
    if (!useLegacyFallback) return;
    const replay = pendingLegacyFallbackReplayRef.current;
    if (!replay) return;

    pendingLegacyFallbackReplayRef.current = null;
    void (async () => {
      try {
        await legacyAssistant.submitMessage(
          replay.message,
          replay.inputMode,
          replay.options,
        );
        if (
          replay.shouldConsumePendingStarterIntent &&
          pendingStarterIntentRef.current === replay.pendingStarterIntent
        ) {
          pendingStarterIntentRef.current = null;
          pendingQuestCaptureSelectedDateRef.current = null;
        }
      } catch (error) {
        console.error(
          "Failed to replay message through legacy companion fallback:",
          error,
        );
      }
    })();
  }, [legacyAssistant, legacyFallbackReplayKey, useLegacyFallback]);

  useEffect(() => {
    if (surface === "companion") return;
    if (!unifiedAgentActive) return;
    if (!threadsQuery.isSuccess) return;
    if (bootstrappedScopeRef.current === scopeKey) return;
    if (
      launchIntent?.id &&
      launchIntent.id !== handledLaunchIntentIdRef.current &&
      launchIntent.starterIntent !== "thread_history" &&
      launchIntent.target !== "campaign_builder"
    ) {
      return;
    }

    const activePersistedThread = threadsQuery.data.threads.find(
      (thread) => thread.archivedAt === null,
    );

    if (!activePersistedThread) {
      openFreshThread({
        sessionId: activeSessionId || undefined,
        greetingText: baseGreeting,
        markBootstrapped: true,
      });
      return;
    }

    let cancelled = false;
    const hydrationVersion = threadMutationVersionRef.current;

    void loadThreadState(activePersistedThread.sessionId, {
      expectedMutationVersion: hydrationVersion,
    })
      .then((hydrated) => {
        if (cancelled) return;
        if (!hydrated) return;
        bootstrappedScopeRef.current = scopeKey;
      })
      .catch((error) => {
        console.error("Failed to hydrate companion thread:", error);
        if (
          cancelled ||
          threadMutationVersionRef.current !== hydrationVersion
        ) {
          return;
        }
        toast.error(
          isCompanionChatSetupError(error)
            ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
            : "I couldn't reopen the last thread, so I started a fresh one.",
        );
        openFreshThread({
          greetingText: baseGreeting,
          markBootstrapped: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    baseGreeting,
    loadThreadState,
    launchIntent,
    openFreshThread,
    scopeKey,
    threadsQuery.data,
    threadsQuery.isSuccess,
    surface,
    unifiedAgentActive,
  ]);

  const persistedActiveThread = useMemo(
    () =>
      threadsQuery.data?.threads.find(
        (thread) =>
          thread.sessionId === activeSessionId && thread.archivedAt === null,
      ) ?? null,
    [activeSessionId, threadsQuery.data],
  );

  const hasRealMessages = useMemo(
    () => messages.some((message) => !message.isSeed),
    [messages],
  );

  const localActiveThread = useMemo<CompanionChatThreadSummary>(() => {
    const realMessages = messages.filter((message) => !message.isSeed);
    const firstUserMessage = realMessages.find(
      (message) => message.role === "user",
    );
    const latestMessage = realMessages[realMessages.length - 1];

    return {
      sessionId: activeSessionId,
      companionId: companion?.id ?? "",
      surface,
      title: buildCompanionThreadTitle(
        firstUserMessage?.content ?? "New thread",
      ),
      previewText: buildCompanionThreadPreview(latestMessage?.content ?? ""),
      createdAt: realMessages[0]?.createdAt ?? localThreadCreatedAtRef.current,
      lastMessageAt:
        latestMessage?.createdAt ?? localThreadCreatedAtRef.current,
      archivedAt: null,
      messageCount: realMessages.length,
    };
  }, [activeSessionId, companion?.id, messages, surface]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const historyThreads = useMemo(
    () =>
      (threadsQuery.data?.threads ?? []).filter(
        (thread) =>
          thread.sessionId !== persistedActiveThread?.sessionId &&
          thread.messageCount >= 2,
      ),
    [persistedActiveThread?.sessionId, threadsQuery.data],
  );
  const hasPersistedActiveThread = Boolean(persistedActiveThread);

  const speakAssistantReply = useCallback(
    async (text: string, sessionId: string) => {
      if (!conversationEnabled || !companion?.id) return;
      if (!autoplayVoice || muteSpokenReplies) return;
      const trimmedText = text.trim();
      if (!trimmedText) return;

      setIsSpeaking(true);
      try {
        const provider = await speakCompanionReply({
          text: trimmedText,
          companionId: companion.id,
          voiceStyle,
          sessionId,
        });
        setSpeechProvider(provider);
      } catch (error) {
        console.error("Failed to speak companion reply:", error);
        setSpeechProvider("none");
      } finally {
        setIsSpeaking(false);
      }
    },
    [
      autoplayVoice,
      companion?.id,
      conversationEnabled,
      muteSpokenReplies,
      voiceStyle,
    ],
  );

  useEffect(
    () => () => {
      stopCompanionSpeech();
    },
    [],
  );

  const invalidateThreads = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: getCompanionChatThreadsQueryKey(
        user?.id,
        companion?.id,
        surface,
      ),
    });
  }, [companion?.id, queryClient, surface, user?.id]);

  const startGeneratedCompanionOpener = useCallback(async () => {
    if (surface !== "companion") return null;

    const fallbackOpening = getRandomCompanionChatOpeningLine();

    if (!user?.id || !companion?.id) {
      return openFreshThread({
        greetingText: fallbackOpening,
        markBootstrapped: true,
        visibleAssistantOpening: true,
      });
    }

    openFreshThread({
      markBootstrapped: true,
    });
    const openerMutationVersion = threadMutationVersionRef.current;
    setIsOpeningThread(true);

    try {
      if (!(await ensureFunctionSession({ silent: true }))) {
        if (threadMutationVersionRef.current !== openerMutationVersion) {
          return null;
        }

        setIsOpeningThread(false);
        return openFreshThread({
          greetingText: fallbackOpening,
          markBootstrapped: true,
          visibleAssistantOpening: true,
        });
      }

      const { data, error } = await supabase.functions.invoke(
        "companion-chat-opener",
        {
          body: {
            companionId: companion.id,
            surface: "companion",
            currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
          },
        },
      );

      if (error) throw error;
      if (threadMutationVersionRef.current !== openerMutationVersion) {
        return null;
      }

      const response = data as CompanionChatOpenerResponse;
      if (!response?.sessionId || !response?.reply) {
        throw new Error("Companion opener returned an empty response.");
      }

      const createdAt = response.createdAt || new Date().toISOString();
      localThreadCreatedAtRef.current = createdAt;
      applyActiveSessionId(response.sessionId);
      setDraftInput("");
      setInterimText("");
      setStructuredResponse(null);
      setActiveFollowUp(null);
      setUnderstandingState(null);
      setProposedActions([]);
      setPendingAction(null);
      setSavedSuggestionProposalIds([]);
      setPendingSuggestionProposalId(null);
      lastStarterIntentRef.current = null;
      lastReplayablePlannerMessageRef.current = null;
      pendingStarterIntentRef.current = null;
      pendingQuestCaptureSelectedDateRef.current = null;
      setMessages([
        createMessage("assistant", stripMarkdown(response.reply), {
          createdAt,
          source: "agent",
        }),
      ]);
      if (!response.persistenceReady) {
        console.warn(
          "Companion opener was not persisted; continuing with local opener.",
        );
      }
      void invalidateThreads();
      return response.sessionId;
    } catch (error) {
      if (threadMutationVersionRef.current !== openerMutationVersion) {
        return null;
      }
      console.error("Failed to start companion opener thread:", error);
      setIsOpeningThread(false);
      void invalidateThreads();
      return openFreshThread({
        greetingText: fallbackOpening,
        markBootstrapped: true,
        visibleAssistantOpening: true,
      });
    } finally {
      if (threadMutationVersionRef.current === openerMutationVersion) {
        setIsOpeningThread(false);
      }
    }
  }, [
    applyActiveSessionId,
    baseGreeting,
    companion?.id,
    ensureFunctionSession,
    invalidateThreads,
    openFreshThread,
    surface,
    user?.id,
  ]);

  useEffect(() => {
    if (surface !== "companion") return;
    if (!conversationEnabled) {
      companionOpenCycleKeyRef.current = null;
      return;
    }

    const openCycleKey = `${scopeKey}:${Date.now()}`;
    if (companionOpenCycleKeyRef.current) return;
    companionOpenCycleKeyRef.current = openCycleKey;
    void startGeneratedCompanionOpener();
  }, [
    conversationEnabled,
    companion?.id,
    scopeKey,
    startGeneratedCompanionOpener,
    surface,
    user?.id,
  ]);

  const appendAssistantResponse = useCallback(
    (
      response: CompanionAgentResponse,
      options?: {
        pendingProposalId?: string | null;
      },
    ) => {
      const nextStructuredResponse =
        response.structuredResponse === undefined
          ? (structuredResponse ?? null)
          : (response.structuredResponse ?? null);
      setMessages((previous) => [
        ...previous,
        createMessage("assistant", stripMarkdown(response.reply), {
          source: "agent",
          understandingState: response.understandingState,
          followUp: response.followUp ?? null,
          proposedActions: response.proposedActions ?? [],
          assumptions: response.assumptions ?? [],
          evidenceIds: response.evidenceIds ?? [],
          structuredResponse: nextStructuredResponse,
          pendingAction: response.pendingAction,
          receipt: response.receipt,
        }),
      ]);
      setStructuredResponse(nextStructuredResponse);
      setActiveFollowUp(response.followUp ?? null);
      setUnderstandingState(response.understandingState ?? null);
      setProposedActions(response.proposedActions ?? []);
      setPendingAction(response.pendingAction ?? null);
      setSavedSuggestionProposalIds((previous) =>
        pruneProposalIdsToStructuredResponse(previous, nextStructuredResponse),
      );
      setPendingSuggestionProposalId(
        response.pendingAction
          ? (response.pendingAction.proposalId ??
              options?.pendingProposalId ??
              null)
          : null,
      );
      void speakAssistantReply(response.reply, response.threadState.sessionId);
    },
    [speakAssistantReply, structuredResponse],
  );

  const requestDraftOpportunitySidecar = useCallback(
    async (params: {
      message: string;
      inputMode: CompanionChatInputMode;
      currentDateTime: string;
      turnOrigin?: CompanionAgentTurnOrigin;
      starterIntent?: CompanionPlannerLaunchIntent["starterIntent"];
      selectedDate?: string | null;
      selectedProposedAction?: CompanionAgentProposedAction | null;
      response: CompanionAgentResponse;
    }) => {
      if (
        !shouldRequestDraftOpportunitySidecar({
          surface,
          response: params.response,
          selectedProposedAction: params.selectedProposedAction,
        })
      ) {
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "companion-draft-opportunity",
          {
            body: {
              surface,
              sessionId: params.response.threadState.sessionId,
              message: params.message,
              inputMode: params.inputMode,
              currentDateTime: params.currentDateTime,
              turnOrigin: params.turnOrigin,
              starterIntent: params.starterIntent,
              selectedDate: params.selectedDate ?? undefined,
              activeFollowUp,
              activeProposedActions: proposedActions.slice(
                0,
                MAX_ACTIVE_PROPOSED_ACTIONS,
              ),
              assistantReply: params.response.reply,
              assistantMode: params.response.mode,
              assistantIntent: params.response.intent,
              assistantConfidence: params.response.confidence,
              assistantUnderstandingState:
                params.response.understandingState ?? undefined,
              assistantFollowUp: params.response.followUp ?? null,
              assistantProposedActions: params.response.proposedActions ?? [],
              assistantStructuredResponse:
                params.response.structuredResponse ?? null,
            },
          },
        );

        if (error) throw error;
        if (
          activeSessionIdRef.current !== params.response.threadState.sessionId
        ) {
          return;
        }

        const sidecarResponse = data as CompanionDraftOpportunityResponse;
        const sidecarActions = parseDraftOpportunityActions(sidecarResponse);
        if (sidecarActions.length === 0) return;

        const nextUnderstandingState =
          sidecarResponse.understandingState ?? "ready_to_propose";
        setMessages((previous) => {
          const nextMessages = [...previous];
          for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
            const candidate = nextMessages[index];
            if (candidate?.role !== "assistant") continue;
            nextMessages[index] = {
              ...candidate,
              followUp: null,
              proposedActions: sidecarActions,
              understandingState: nextUnderstandingState,
            };
            break;
          }
          return nextMessages;
        });
        setActiveFollowUp(null);
        setUnderstandingState(nextUnderstandingState);
        setProposedActions(sidecarActions);
        void invalidateThreads();
      } catch (error) {
        console.warn("Draft opportunity sidecar failed:", error);
      }
    },
    [activeFollowUp, invalidateThreads, proposedActions, surface],
  );

  const submitMessage = useCallback(
    async (
      rawMessage: string,
      inputMode: CompanionChatInputMode = "text",
      options?: CompanionAgentSubmitOptions,
    ) => {
      const message = rawMessage.trim();
      if (
        !message ||
        isOpeningThread ||
        isSubmitting ||
        isResolvingAction
      ) {
        return false;
      }
      const pendingStarterIntent = pendingStarterIntentRef.current;
      const starterIntent =
        options?.starterIntent ??
        pendingStarterIntent ??
        inferStarterIntentFromMessage(message);
      const activeFollowUpSelectedDate =
        readFollowUpSelectedDate(activeFollowUp);
      const normalizedDefaultSelectedDate =
        normalizeSelectedDateKey(defaultSelectedDate);
      const selectedDate =
        normalizeSelectedDateKey(options?.selectedDate) ??
        (pendingStarterIntent === "quest_capture"
          ? pendingQuestCaptureSelectedDateRef.current
          : null) ??
        activeFollowUpSelectedDate ??
        (activeFollowUp ? pendingQuestCaptureSelectedDateRef.current : null) ??
        (shouldApplyDefaultSelectedDateToStarterIntent(starterIntent)
          ? normalizedDefaultSelectedDate
          : null);
      const briefingContext =
        options?.briefingContext ??
        (activeFollowUp ? readFollowUpBriefingContext(activeFollowUp) : null);
      const shouldConsumePendingStarterIntent = pendingStarterIntent !== null;
      const shouldEmitPlanDayAiAnswered =
        !starterIntent &&
        Boolean(activeFollowUp) &&
        (lastStarterIntentRef.current === "plan_day" ||
          hasRecentPlanDayStarter(messages));
      const shouldStartFreshLauncherThread =
        localScheduleReadEnabled &&
        starterIntent === "upcoming_start" &&
        options?.turnOrigin === "launcher" &&
        !options?.selectedProposedAction;

      if (useLegacyFallback) {
        if (shouldStartFreshLauncherThread) {
          legacyAssistant.startTemplateThread?.({ greetingText: null });
        }
        const legacyStarterIntent =
          pendingStarterIntent === "quest_capture" && !options?.starterIntent
            ? undefined
            : starterIntent;
        const legacySubmitOptions =
          legacyStarterIntent === undefined && !options && !selectedDate
            ? undefined
            : {
                ...options,
                starterIntent: legacyStarterIntent,
                ...(selectedDate ? { selectedDate } : {}),
              };
        await legacyAssistant.submitMessage(
          message,
          inputMode,
          legacySubmitOptions,
        );
        if (
          shouldConsumePendingStarterIntent &&
          pendingStarterIntentRef.current === pendingStarterIntent
        ) {
          pendingStarterIntentRef.current = null;
          pendingQuestCaptureSelectedDateRef.current = null;
        }
        return true;
      }

      if (
        localScheduleReadEnabled &&
        starterIntent === "upcoming_start" &&
        !options?.selectedProposedAction
      ) {
        const legacySubmitOptions = {
          ...options,
          starterIntent,
          ...(selectedDate ? { selectedDate } : {}),
        };
        if (shouldStartFreshLauncherThread) {
          legacyAssistant.startTemplateThread?.({ greetingText: null });
        } else {
          legacyAssistant.hydrateFromUnifiedState?.({
            sessionId: activeSessionIdRef.current,
            messages,
            savedSuggestionProposalIds,
            pendingSuggestionProposalId,
          });
        }
        setUseLegacyFallback(true);
        await legacyAssistant.submitMessage(
          message,
          inputMode,
          legacySubmitOptions,
        );
        if (
          shouldConsumePendingStarterIntent &&
          pendingStarterIntentRef.current === pendingStarterIntent
        ) {
          pendingStarterIntentRef.current = null;
          pendingQuestCaptureSelectedDateRef.current = null;
        }
        return true;
      }

      if (!user?.id || !companion?.id) {
        toast.error("Your companion is still loading. Try again in a moment.");
        return false;
      }

      if (!(await ensureFunctionSession())) {
        return false;
      }

      setIsSubmitting(true);
      setDraftInput("");
      setInterimText("");

      const shouldUseDirectChat = shouldUseDirectCompanionChat({
        surface,
        message,
        starterIntent,
        turnOrigin: options?.turnOrigin,
        selectedDate,
        selectedProposedAction: options?.selectedProposedAction ?? null,
        activeFollowUp,
        pendingAction,
        proposedActions,
      });
      const directChatHistory = shouldUseDirectChat
        ? buildDirectChatHistory(messages)
        : [];
      const optimisticUserMessage = createMessage("user", message, {
        inputMode,
        source: shouldUseDirectChat ? "chat" : "agent",
      });
      setMessages((previous) => [...previous, optimisticUserMessage]);
      const nextUnifiedMessages = [...messages, optimisticUserMessage];

      try {
        lastStarterIntentRef.current = starterIntent ?? null;
        lastReplayablePlannerMessageRef.current = shouldUseDirectChat
          ? null
          : message;
        const currentDateTime = formatCurrentDateTimeWithOffset(new Date());

        if (shouldUseDirectChat) {
          const { data, error } = await supabase.functions.invoke(
            "companion-chat",
            {
              body: {
                message,
                conversationHistory: directChatHistory,
                companionId: companion.id,
                inputMode,
                surface,
                sessionId: activeSessionIdRef.current,
                currentDateTime,
              } satisfies CompanionChatRequest,
            },
          );

          if (error) throw error;

          const response = data as CompanionChatResponse;
          const nextSessionId = response.sessionId ?? activeSessionIdRef.current;
          if (response.sessionId) {
            applyActiveSessionId(response.sessionId);
          }
          if (response.persistenceReady === false) {
            console.warn(
              "Companion chat reply was not persisted; continuing locally.",
            );
          }

          const reply = response.reply?.trim() || "I'm here with you.";
          setMessages((previous) => [
            ...previous,
            createMessage("assistant", stripMarkdown(reply), {
              source: "chat",
            }),
          ]);
          setStructuredResponse(null);
          setActiveFollowUp(null);
          setUnderstandingState(null);
          setProposedActions([]);
          setPendingAction(null);
          setSavedSuggestionProposalIds([]);
          setPendingSuggestionProposalId(null);
          pendingQuestCaptureSelectedDateRef.current = null;

          await trackInteraction({
            interactionType:
              surface === "journeys"
                ? "journeys_companion_chat"
                : "companion_chat",
            inputText: message,
            detectedIntent: response.handoffToPlanner
              ? "planning_handoff"
              : "conversation",
            aiResponse: {
              reply,
              speechText: response.speechText,
              memoryUpdateApplied: response.memoryUpdateApplied,
              handoffToPlanner: response.handoffToPlanner,
              surface,
            },
            userAction: "accepted",
          });

          if (
            shouldConsumePendingStarterIntent &&
            pendingStarterIntentRef.current === pendingStarterIntent
          ) {
            pendingStarterIntentRef.current = null;
          }
          void invalidateThreads();
          void speakAssistantReply(
            response.speechText?.trim() || reply,
            nextSessionId,
          );
          return true;
        }

        const { data, error } = await supabase.functions.invoke(
          "companion-agent",
          {
            body: {
              surface,
              sessionId: activeSessionIdRef.current,
              message,
              inputMode,
              currentDateTime,
              turnOrigin: options?.turnOrigin,
              starterIntent,
              selectedDate: selectedDate ?? undefined,
              briefingContext: briefingContext ?? undefined,
              activeFollowUp,
              activeProposedActions: proposedActions.slice(
                0,
                MAX_ACTIVE_PROPOSED_ACTIONS,
              ),
              selectedProposedAction:
                options?.selectedProposedAction ?? undefined,
              selectedProposedActionIntent: options?.selectedProposedAction
                ? (options.selectedProposedActionIntent ?? "draft")
                : undefined,
            },
          },
        );

        if (error) throw error;

        const response = data as CompanionAgentResponse;
        applyActiveSessionId(response.threadState.sessionId);
        appendAssistantResponse(response);
        void requestDraftOpportunitySidecar({
          message,
          inputMode,
          currentDateTime,
          turnOrigin: options?.turnOrigin,
          starterIntent,
          selectedDate,
          selectedProposedAction: options?.selectedProposedAction ?? null,
          response,
        });
        const nextQuestCaptureSelectedDate =
          readFollowUpSelectedDate(response.followUp ?? null) ??
          (response.followUp && selectedDate ? selectedDate : null);
        await trackInteraction({
          interactionType: "companion_agent",
          inputText: message,
          detectedIntent: response.intent,
          aiResponse: {
            mode: response.mode,
            structuredSections: collectStructuredResponseSectionKeys(
              response.structuredResponse ?? null,
            ),
            hasPendingAction: Boolean(response.pendingAction),
            pendingActionType: response.pendingAction?.actionType ?? null,
            hasReceipt: Boolean(response.receipt),
            understandingState: response.understandingState ?? null,
            hasFollowUp: Boolean(response.followUp),
            proposedActionCount: response.proposedActions?.length ?? 0,
          },
          userAction: "accepted",
          modifications: {
            surface,
            turnOrigin: options?.turnOrigin ?? null,
            starterIntent: starterIntent ?? null,
            selectedProposedActionType:
              options?.selectedProposedAction?.type ?? null,
            selectedProposedActionIntent: options?.selectedProposedAction
              ? (options.selectedProposedActionIntent ?? "draft")
              : null,
            proposalId: response.pendingAction?.proposalId ?? null,
          },
        });
        if (shouldEmitPlanDayAiAnswered) {
          emitPlanDayAiAnsweredEvent();
        }
        if (
          shouldConsumePendingStarterIntent &&
          pendingStarterIntentRef.current === pendingStarterIntent
        ) {
          pendingStarterIntentRef.current = null;
        }
        pendingQuestCaptureSelectedDateRef.current =
          nextQuestCaptureSelectedDate ?? null;
        void invalidateThreads();
        return true;
      } catch (error) {
        if (shouldUseDirectChat) {
          console.error("Failed to submit companion chat message:", error);
          toast.error(await resolveCompanionChatError(error));
          return false;
        }

        const parsed = await parseFunctionInvokeError(error);
        const allowReadOnlyScheduleFallback =
          starterIntent === "upcoming_start" &&
          !options?.selectedProposedAction;
        const shouldFallback = shouldFallbackToLegacyAgent(parsed, {
          allowReadOnlyScheduleFallback,
        });
        console.error("Failed to submit companion agent message:", {
          status: parsed.status ?? null,
          code: getParsedFunctionCode(parsed) ?? null,
          requestId: parsed.requestId ?? null,
          stage: parsed.stage ?? parsed.responsePayload?.stage ?? null,
          failureReason:
            parsed.failureReason ??
            parsed.responsePayload?.failureReason ??
            null,
          category: parsed.category ?? "unknown",
          surface,
          sessionId: activeSessionIdRef.current,
          fallbackToLegacy: shouldFallback,
        });

        if (shouldFallback) {
          const legacyStarterIntent =
            pendingStarterIntent === "quest_capture" && !options?.starterIntent
              ? undefined
              : starterIntent;
          const legacySubmitOptions =
            legacyStarterIntent === undefined && !options && !selectedDate
              ? undefined
              : {
                  ...options,
                  starterIntent: legacyStarterIntent,
                  ...(selectedDate ? { selectedDate } : {}),
                };
          legacyAssistant.hydrateFromUnifiedState?.({
            sessionId: activeSessionIdRef.current,
            messages: nextUnifiedMessages,
            savedSuggestionProposalIds,
            pendingSuggestionProposalId,
          });
          pendingLegacyFallbackReplayRef.current = {
            message,
            inputMode,
            options: legacySubmitOptions,
            pendingStarterIntent,
            shouldConsumePendingStarterIntent,
          };
          setUseLegacyFallback(true);
          setLegacyFallbackReplayKey((key) => key + 1);
          return true;
        }

        toast.error(toUserFacingCompanionAgentError(parsed));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyActiveSessionId,
      appendAssistantResponse,
      activeFollowUp,
      companion?.id,
      defaultSelectedDate,
      ensureFunctionSession,
      invalidateThreads,
      isOpeningThread,
      isResolvingAction,
      isSubmitting,
      legacyAssistant,
      messages,
      pendingAction,
      requestDraftOpportunitySidecar,
      speakAssistantReply,
      trackInteraction,
      localScheduleReadEnabled,
      pendingSuggestionProposalId,
      proposedActions,
      savedSuggestionProposalIds,
      surface,
      useLegacyFallback,
      user?.id,
    ],
  );

  const resolvePendingAction = useCallback(
    async (mode: "confirm" | "cancel") => {
      if (useLegacyFallback) {
        if (mode === "confirm") {
          await legacyAssistant.confirmPendingAction();
        } else {
          await legacyAssistant.cancelPendingAction();
        }
        return;
      }

      if (!pendingAction || isResolvingAction || isSubmitting) return;
      if (!(await ensureFunctionSession())) return;

      setIsResolvingAction(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "companion-agent-action",
          {
            body: {
              sessionId: activeSessionIdRef.current,
              actionId: pendingAction.id,
              action: mode,
            },
          },
        );

        if (error) throw error;

        const response = data as CompanionAgentResponse;
        const nextStructuredResponse =
          response.structuredResponse === undefined
            ? (structuredResponse ?? null)
            : (response.structuredResponse ?? null);
        const resolvedProposalId =
          pendingAction?.proposalId ?? pendingSuggestionProposalId;
        setPendingAction(null);
        setMessages((previous) => [
          ...previous,
          createMessage("user", mode === "confirm" ? "Confirm" : "Cancel", {
            source: "agent",
          }),
          createMessage("assistant", stripMarkdown(response.reply), {
            source: "agent",
            understandingState: response.understandingState,
            followUp: response.followUp ?? null,
            proposedActions: response.proposedActions ?? [],
            assumptions: response.assumptions ?? [],
            evidenceIds: response.evidenceIds ?? [],
            structuredResponse: nextStructuredResponse,
            receipt: response.receipt,
          }),
        ]);
        setStructuredResponse(nextStructuredResponse);
        setActiveFollowUp(response.followUp ?? null);
        setUnderstandingState(response.understandingState ?? null);
        setProposedActions(response.proposedActions ?? []);
        setSavedSuggestionProposalIds((previous) => {
          const nextProposalIds =
            mode === "confirm" &&
            response.receipt?.status === "executed" &&
            resolvedProposalId
              ? [...new Set([...previous, resolvedProposalId])]
              : previous;

          return pruneProposalIdsToStructuredResponse(
            nextProposalIds,
            nextStructuredResponse,
          );
        });
        setPendingSuggestionProposalId(null);
        await trackInteraction({
          interactionType: "companion_agent_confirmation",
          inputText: pendingAction.summary,
          detectedIntent: pendingAction.actionType,
          aiResponse: {
            mode: response.mode,
            receiptStatus: response.receipt?.status ?? null,
            actionType: pendingAction.actionType,
          },
          userAction: mode === "confirm" ? "accepted" : "rejected",
          modifications: {
            actionId: pendingAction.id,
            proposalId: resolvedProposalId ?? null,
            confirmationMode: mode,
            surface,
            starterIntent: lastStarterIntentRef.current,
          },
        });
        if (mode === "confirm" && response.receipt?.status === "executed") {
          emitPlanDayActionSavedEvent();
        }
        void speakAssistantReply(
          response.reply,
          response.threadState.sessionId,
        );
        void invalidateThreads();
      } catch (error) {
        console.error(`Failed to ${mode} pending action:`, error);
        toast.error(
          mode === "confirm"
            ? "I couldn't confirm that action right now."
            : "I couldn't cancel that action right now.",
        );
      } finally {
        setIsResolvingAction(false);
      }
    },
    [
      ensureFunctionSession,
      invalidateThreads,
      isResolvingAction,
      isSubmitting,
      legacyAssistant,
      pendingAction,
      pendingSuggestionProposalId,
      speakAssistantReply,
      structuredResponse,
      surface,
      trackInteraction,
      useLegacyFallback,
    ],
  );

  const confirmSuggestedQuest = useCallback(
    async (proposalId: string) => {
      if (useLegacyFallback) {
        await legacyAssistant.confirmSuggestedQuest(proposalId);
        return;
      }

      if (!proposalId || pendingAction || isSubmitting || isResolvingAction) {
        return;
      }
      if (!(await ensureFunctionSession())) {
        return;
      }

      const latestUserMessage =
        lastReplayablePlannerMessageRef.current?.trim() ||
        [...messages]
          .reverse()
          .find(
            (message) =>
              message.role === "user" &&
              !message.isSeed &&
              !isSyntheticResolutionMessage(message.content),
          )
          ?.content?.trim() ||
        (structuredResponse?.planDay
          ? "Plan my day"
          : structuredResponse?.weeklyPlan
            ? "Plan my week"
            : structuredResponse?.priorityOverview
              ? structuredResponse.priorityOverview.title
                  .toLowerCase()
                  .includes("make room")
                ? "Make room"
                : "What matters most?"
              : structuredResponse?.reflectionBridge
                ? "Prepare me for tomorrow"
                : structuredResponse?.campaignMomentum
                  ? "Advance my campaign"
                  : structuredResponse?.comingUp
                    ? "What do I have coming up?"
                    : null);

      if (!latestUserMessage) {
        toast.error(
          "I couldn't recover that planner suggestion. Try asking again.",
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const starterIntent =
          lastStarterIntentRef.current ??
          inferStarterIntentFromStructuredResponse(structuredResponse) ??
          undefined;
        lastReplayablePlannerMessageRef.current = latestUserMessage;
        const { data, error } = await supabase.functions.invoke(
          "companion-agent",
          {
            body: {
              surface,
              sessionId: activeSessionIdRef.current,
              message: latestUserMessage,
              inputMode: "text",
              currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
              turnOrigin: "proposed_action",
              starterIntent,
              selectedProposalId: proposalId,
            },
          },
        );

        if (error) throw error;

        const response = data as CompanionAgentResponse;
        applyActiveSessionId(response.threadState.sessionId);
        appendAssistantResponse(response, {
          pendingProposalId: proposalId,
        });
        await trackInteraction({
          interactionType: "companion_agent_suggestion_prepare",
          inputText: latestUserMessage,
          detectedIntent: response.intent,
          aiResponse: {
            mode: response.mode,
            actionType: response.pendingAction?.actionType ?? null,
            proposalId: response.pendingAction?.proposalId ?? proposalId,
          },
          userAction: "accepted",
          modifications: {
            proposalId,
            turnOrigin: "proposed_action",
            starterIntent: starterIntent ?? null,
            surface,
          },
        });
        void invalidateThreads();
      } catch (error) {
        console.error("Failed to prepare planner suggestion:", error);
        toast.error("I couldn't prepare that suggestion right now.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      appendAssistantResponse,
      applyActiveSessionId,
      ensureFunctionSession,
      invalidateThreads,
      isResolvingAction,
      isSubmitting,
      legacyAssistant,
      localScheduleReadEnabled,
      messages,
      pendingAction,
      structuredResponse,
      surface,
      trackInteraction,
      useLegacyFallback,
    ],
  );

  const archiveCurrentThread = useCallback(async () => {
    if (!persistedActiveThread) {
      openFreshThread({
        greetingText: baseGreeting,
        markBootstrapped: true,
      });
      return;
    }

    await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
    await invalidateThreads();
    openFreshThread({
      greetingText: baseGreeting,
      markBootstrapped: true,
    });
  }, [baseGreeting, invalidateThreads, openFreshThread, persistedActiveThread]);

  const startNewChat = useCallback(
    async (options?: CompanionTemplateThreadOptions) => {
      if (surface === "companion") {
        return startGeneratedCompanionOpener();
      }

      const threadToArchive =
        persistedActiveThread ??
        threadsQuery.data?.threads.find(
          (thread) => thread.archivedAt === null,
        ) ??
        null;

      if (threadToArchive) {
        await setCompanionChatThreadArchived(threadToArchive.sessionId, true);
        await invalidateThreads();
      }

      const greetingText =
        options?.greetingText === null
          ? undefined
          : (options?.greetingText ?? baseGreeting);

      return openFreshThread({
        greetingText,
        markBootstrapped: true,
        visibleAssistantOpening: options?.visibleAssistantOpening,
      });
    },
    [
      baseGreeting,
      invalidateThreads,
      openFreshThread,
      persistedActiveThread,
      startGeneratedCompanionOpener,
      surface,
      threadsQuery.data?.threads,
    ],
  );

  const startTemplateThread = useCallback(
    (options?: CompanionTemplateThreadOptions) => {
      const threadToArchive =
        persistedActiveThread ??
        threadsQuery.data?.threads.find(
          (thread) => thread.archivedAt === null,
        ) ??
        null;
      const greetingText =
        options?.greetingText === null ? undefined : options?.greetingText;
      const nextSessionId = openFreshThread({
        greetingText,
        markBootstrapped: true,
        visibleAssistantOpening: options?.visibleAssistantOpening,
      });

      void (async () => {
        try {
          const resolvedThreadToArchive =
            threadToArchive ??
            (companion?.id
              ? ((await listCompanionChatThreads(companion.id, surface)).find(
                  (thread) => thread.archivedAt === null,
                ) ?? null)
              : null);

          if (!resolvedThreadToArchive) return;
          if (resolvedThreadToArchive.sessionId === nextSessionId) return;

          await setCompanionChatThreadArchived(
            resolvedThreadToArchive.sessionId,
            true,
          );
          await invalidateThreads();
        } catch (error) {
          console.warn(
            "Failed to archive the previous companion template thread:",
            error,
          );
        }
      })();

      return nextSessionId;
    },
    [
      companion?.id,
      invalidateThreads,
      openFreshThread,
      persistedActiveThread,
      surface,
      threadsQuery.data?.threads,
    ],
  );

  const resumeThread = useCallback(
    async (sessionId: string) => {
      const hydrationVersion = threadMutationVersionRef.current + 1;
      threadMutationVersionRef.current = hydrationVersion;
      await loadThreadState(sessionId, {
        expectedMutationVersion: hydrationVersion,
      });
    },
    [loadThreadState],
  );

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (handledLaunchIntentIdRef.current === launchIntent.id) return;
    if (launchIntent.starterIntent !== "quest_capture") {
      pendingStarterIntentRef.current = null;
      pendingQuestCaptureSelectedDateRef.current = null;
    }
    if (launchIntent.starterIntent === "thread_history") return;
    if (
      !useLegacyFallback &&
      !threadsQuery.isSuccess &&
      launchIntent.starterIntent !== "upcoming_start"
    ) {
      return;
    }

    handledLaunchIntentIdRef.current = launchIntent.id;

    if (launchIntent.target === "campaign_builder") {
      onOpenCampaignBuilder?.(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    const launchMessage = launchIntent.message;
    const intentId = launchIntent.id;
    const isCompanionAuthoredConversationStarter =
      launchIntent.target === "conversation" &&
      launchIntent.starterIntent === "free_talk_start";
    const isQuestCaptureStarter =
      launchIntent.starterIntent === "quest_capture";
    const isSnapshotOnlyPlanDayStarter =
      hasPlanDaySnapshotBriefing(launchIntent);
    const isLocalUpcomingStarter =
      localScheduleReadEnabled &&
      launchIntent.starterIntent === "upcoming_start";

    void (async () => {
      threadMutationVersionRef.current += 1;

      try {
        if (isCompanionAuthoredConversationStarter) {
          const greetingText = launchMessage.trim() || null;
          if (useLegacyFallback) {
            legacyAssistant.startTemplateThread?.({
              greetingText,
              visibleAssistantOpening: true,
            });
          } else {
            startTemplateThread({
              greetingText,
              visibleAssistantOpening: true,
            });
          }
          return;
        }

        if (isQuestCaptureStarter) {
          const greetingText =
            launchMessage.trim() || COMPANION_PLANNER_QUEST_CAPTURE_OPENING;
          if (useLegacyFallback) {
            legacyAssistant.startQuestCaptureThread?.(greetingText, {
              selectedDate: launchIntent.selectedDate ?? null,
            });
          } else {
            startTemplateThread({
              greetingText,
              visibleAssistantOpening: true,
            });
          }
          pendingStarterIntentRef.current = "quest_capture";
          pendingQuestCaptureSelectedDateRef.current =
            launchIntent.selectedDate ?? null;
          return;
        }

        if (isSnapshotOnlyPlanDayStarter) {
          if (useLegacyFallback) {
            legacyAssistant.startTemplateThread?.();
          } else {
            startTemplateThread({ greetingText: null });
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("companion-plan-my-day-started"),
            );
            window.dispatchEvent(
              new CustomEvent("companion-plan-my-day-snapshot-shown"),
            );
          }
          return;
        }

        if (isLocalUpcomingStarter) {
          const launchSubmitOptions: CompanionAgentSubmitOptions = {
            starterIntent: launchIntent.starterIntent,
            turnOrigin: "launcher",
          };
          if (launchIntent.selectedDate) {
            launchSubmitOptions.selectedDate = launchIntent.selectedDate;
          }
          await submitMessage(launchMessage, "text", launchSubmitOptions);
          return;
        }

        if (useLegacyFallback) {
          legacyAssistant.startTemplateThread?.();
        } else {
          await startNewChat({ greetingText: null });
        }

        const launchSubmitOptions: CompanionAgentSubmitOptions = {
          starterIntent: launchIntent.starterIntent,
          turnOrigin: "launcher",
        };
        if (launchIntent.selectedDate) {
          launchSubmitOptions.selectedDate = launchIntent.selectedDate;
        }
        if (launchIntent.briefingContext) {
          launchSubmitOptions.briefingContext = launchIntent.briefingContext;
        }
        const submitted = await submitMessage(
          launchMessage,
          "text",
          launchSubmitOptions,
        );
        if (submitted && launchIntent.starterIntent === "plan_day") {
          window.dispatchEvent(
            new CustomEvent("companion-plan-my-day-started"),
          );
        }
      } catch (error) {
        console.error("Failed to handle launch intent:", error);
        const parsed = await parseFunctionInvokeError(error);
        toast.error(
          toUserFacingFunctionError(parsed, { action: "start this chat" }),
        );
      } finally {
        onLaunchIntentConsumed?.(intentId);
      }
    })();
  }, [
    launchIntent,
    legacyAssistant,
    localScheduleReadEnabled,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    startNewChat,
    startTemplateThread,
    submitMessage,
    threadsQuery.isSuccess,
    useLegacyFallback,
  ]);

  const {
    isRecording,
    isAutoStopping,
    isSupported,
    permissionStatus,
    toggleRecording,
    requestPermission,
  } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      const nextMessage = text.trim();
      if (!nextMessage) return;
      void submitMessage(nextMessage, "voice", { turnOrigin: "composer" });
    },
    onError: (message) => {
      toast.error(message);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  const requestMicrophonePermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const status = await requestPermission();
      if (status === "granted") {
        setShowPermissionDialog(false);
        toggleRecording();
      }
    } finally {
      setIsRequestingPermission(false);
    }
  }, [requestPermission, toggleRecording]);

  const canSubmitMessage =
    !isOpeningThread &&
    !isSubmitting &&
    !isResolvingAction &&
    !pendingAction;
  const canStartNewChat =
    !isOpeningThread && !isSubmitting && !isResolvingAction && !pendingAction;
  const canArchiveThread = canStartNewChat && hasPersistedActiveThread;
  const newChatDisabledReason = isOpeningThread
    ? "Starting a fresh chat."
    : pendingAction
    ? "Resolve or cancel the pending action first."
    : null;
  const archiveDisabledReason = isOpeningThread
    ? "Starting a fresh chat."
    : pendingAction
    ? "Resolve or cancel the pending action first."
    : hasPersistedActiveThread
      ? null
      : "This chat isn't saved yet.";
  const threadHistoryEmptyStateMessage = threadsQuery.data?.setupUnavailable
    ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
    : COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE;

  if (useLegacyFallback) {
    return {
      todayLabel: legacyAssistant.todayLabel,
      placeholder: legacyAssistant.placeholder,
      messages: legacyAssistant.messages,
      structuredResponse: legacyAssistant.structuredResponse,
      dayPlan: legacyAssistant.dayPlan ?? null,
      committingDayPlan: legacyAssistant.committingDayPlan ?? false,
      committedDayPlanId: legacyAssistant.committedDayPlanId ?? null,
      commitDayPlan: legacyAssistant.commitDayPlan ?? (async () => undefined),
      activeFollowUp: null,
      understandingState: null,
      proposedActions: [],
      pendingAction: legacyAssistant.pendingAction,
      savedSuggestionProposalIds:
        legacyAssistant.savedSuggestionProposalIds ?? [],
      pendingSuggestionProposalId:
        legacyAssistant.pendingSuggestionProposalId ??
        legacyAssistant.pendingAction?.proposalId ??
        null,
      pendingActionCount: legacyAssistant.pendingActionCount,
      readyPendingActionCount: legacyAssistant.readyPendingActionCount,
      draftInput,
      setDraftInput,
      interimText,
      isSubmitting: legacyAssistant.isSubmitting,
      isOpeningThread: false,
      isResolvingAction: legacyAssistant.isResolvingAction,
      canSubmitMessage:
        !legacyAssistant.isSubmitting &&
        !legacyAssistant.isResolvingAction &&
        !legacyAssistant.pendingAction,
      submitMessage,
      submitTypedMessage: () =>
        submitMessage(draftInput, "text", { turnOrigin: "composer" }),
      confirmPendingAction: () => resolvePendingAction("confirm"),
      cancelPendingAction: () => resolvePendingAction("cancel"),
      confirmSuggestedQuest,
      confirmAllPendingActions: legacyAssistant.confirmAllPendingActions,
      isRecording,
      isAutoStopping,
      isVoiceSupported: isSupported,
      permissionStatus,
      showPermissionDialog,
      setShowPermissionDialog,
      isRequestingPermission,
      toggleRecording,
      requestMicrophonePermission,
      isSpeaking: legacyAssistant.isSpeaking,
      speechProvider: legacyAssistant.speechProvider,
      stopSpeaking: legacyAssistant.stopSpeaking,
      activeThread: legacyAssistant.activeThread,
      historyThreads: legacyAssistant.historyThreads,
      isLoadingThreads: legacyAssistant.isLoadingThreads,
      hasPersistedActiveThread: legacyAssistant.hasPersistedActiveThread,
      canOpenThreadPicker: legacyAssistant.canOpenThreadPicker,
      threadHistoryEmptyStateMessage:
        legacyAssistant.threadHistoryEmptyStateMessage,
      resumeThread: legacyAssistant.resumeThread,
      archiveCurrentThread: legacyAssistant.archiveCurrentThread,
      canArchiveThread: legacyAssistant.canArchiveThread,
      archiveDisabledReason: legacyAssistant.archiveDisabledReason,
      startNewChat: legacyAssistant.startNewChat,
      startTemplateThread: (options?: CompanionTemplateThreadOptions) =>
        legacyAssistant.startTemplateThread?.(options),
      canStartNewChat: legacyAssistant.canStartNewChat,
      newChatDisabledReason: legacyAssistant.newChatDisabledReason,
    };
  }

  return {
    todayLabel,
    placeholder,
    messages,
    structuredResponse,
    dayPlan: null,
    committingDayPlan: false,
    committedDayPlanId: null,
    commitDayPlan: async () => undefined,
    activeFollowUp,
    understandingState,
    proposedActions,
    pendingAction,
    savedSuggestionProposalIds,
    pendingSuggestionProposalId,
    pendingActionCount: pendingAction ? 1 : 0,
    readyPendingActionCount: pendingAction ? 1 : 0,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isOpeningThread,
    isResolvingAction,
    canSubmitMessage,
    submitMessage,
    submitTypedMessage: () =>
      submitMessage(draftInput, "text", { turnOrigin: "composer" }),
    confirmPendingAction: () => resolvePendingAction("confirm"),
    cancelPendingAction: () => resolvePendingAction("cancel"),
    confirmSuggestedQuest,
    confirmAllPendingActions: () => resolvePendingAction("confirm"),
    isRecording,
    isAutoStopping,
    isVoiceSupported: isSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    toggleRecording,
    requestMicrophonePermission,
    isSpeaking,
    speechProvider,
    stopSpeaking: () => {
      stopCompanionSpeech();
      setIsSpeaking(false);
      setSpeechProvider("none");
    },
    activeThread,
    historyThreads,
    isLoadingThreads: threadsQuery.isLoading || isOpeningThread,
    hasPersistedActiveThread,
    canOpenThreadPicker: !threadsQuery.data?.setupUnavailable,
    threadHistoryEmptyStateMessage,
    resumeThread,
    archiveCurrentThread,
    canArchiveThread,
    archiveDisabledReason,
    startNewChat,
    startTemplateThread,
    canStartNewChat,
    newChatDisabledReason,
  };
}
