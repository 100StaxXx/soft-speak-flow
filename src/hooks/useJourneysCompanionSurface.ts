import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { supabase } from "@/integrations/supabase/client";
import { stripMarkdown } from "@/lib/utils";
import type {
  CompanionChatInputMode,
  CompanionChatJourneysContext,
} from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerRequest,
  CompanionPlannerResponse,
  CompanionPlannerStarterIntent,
} from "@/types/companionPlanner";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import { toUserFacingCompanionPlannerError } from "@/utils/companionPlannerErrors";
import {
  sanitizePlannerContext,
  sanitizePlannerConversationHistory,
  sanitizePlannerParsedInput,
  sanitizePlannerSessionState,
} from "@/utils/companionPlannerRequest";
import { validateCompanionPlannerRequest } from "@/utils/companionPlannerRequestValidation";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";

export type JourneysCompanionSurfaceMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  variant?: "default" | "quest_prompt";
};

export interface JourneysCompanionSurfaceAssistant {
  messages: JourneysCompanionSurfaceMessage[];
  draftInput: string;
  setDraftInput: (value: string) => void;
  isSubmitting: boolean;
  placeholder: string;
  todayLabel: string;
  submitTypedMessage: () => void;
}

interface UseJourneysCompanionSurfaceOptions {
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

const DEFAULT_PLANNER_ERROR =
  "Cosmiq hit a snag. Try that again in a second.";

const buildJourneysContext = (
  plannerContext: ReturnType<typeof useCompanionPlanner>["plannerContext"],
): CompanionChatJourneysContext => ({
  tasks: plannerContext.tasks,
  inboxTasks: plannerContext.inboxTasks,
  activeEpics: plannerContext.activeEpics,
  calendarEvents: plannerContext.calendarEvents,
  scheduleInsights: plannerContext.scheduleInsights,
  plannerMemory: plannerContext.plannerMemory
    ? {
      preferredTimeOfDay: plannerContext.plannerMemory.preferredTimeOfDay ?? null,
      preferredTimeReason: plannerContext.plannerMemory.preferredTimeReason ?? null,
      wakeTime: plannerContext.plannerMemory.wakeTime ?? null,
      windDownTime: plannerContext.plannerMemory.windDownTime ?? null,
    }
    : undefined,
});

const buildPlannerConversationHistory = (
  messages: JourneysCompanionSurfaceMessage[],
  nextUserMessage?: string,
) =>
  sanitizePlannerConversationHistory([
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
    ...(nextUserMessage
      ? [{ role: "user" as const, content: nextUserMessage }]
      : []),
  ]);

export function useJourneysCompanionSurface({
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: UseJourneysCompanionSurfaceOptions = {}): JourneysCompanionSurfaceAssistant {
  const conversation = useJourneysCompanionConversation();
  const planner = useCompanionPlanner();
  const [isPlannerSubmitting, setIsPlannerSubmitting] = useState(false);
  const handledLaunchIntentIdRef = useRef<string | null>(null);

  const journeysContext = useMemo(
    () => buildJourneysContext(planner.plannerContext),
    [planner.plannerContext],
  );

  const submitTypedMessage = useCallback(() => {
    const message = conversation.draftInput.trim();
    if (!message || conversation.isSubmitting || isPlannerSubmitting) return;

    void conversation.submitMessage(message, "text", {
      currentDate: planner.currentDate,
      currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
      journeysContext,
      disablePlannerHandoff: true,
    });
  }, [
    conversation,
    isPlannerSubmitting,
    journeysContext,
    planner.currentDate,
  ]);

  const runPlannerStarter = useCallback(async (
    message: string,
    starterIntent: Extract<
      CompanionPlannerStarterIntent,
      "plan_day" | "upcoming_start"
    >,
  ) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || conversation.isSubmitting || isPlannerSubmitting) {
      return;
    }

    const currentDateTime = formatCurrentDateTimeWithOffset(new Date());
    const parsedInput = parseNaturalLanguage(trimmedMessage);
    const requestBody: CompanionPlannerRequest = {
      message: trimmedMessage,
      currentDate: planner.currentDate,
      currentDateTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      horizon: planner.horizon,
      tonePack: planner.tonePack,
      conversationHistory: buildPlannerConversationHistory(
        conversation.messages as JourneysCompanionSurfaceMessage[],
        trimmedMessage,
      ),
      sessionState: sanitizePlannerSessionState(planner.sessionState),
      parsedInput: sanitizePlannerParsedInput({
        text: parsedInput.text,
        scheduledTime: parsedInput.scheduledTime,
        scheduledDate: parsedInput.scheduledDate,
        estimatedDuration: parsedInput.estimatedDuration,
        recurrencePattern: parsedInput.recurrencePattern,
        recurrenceDays: parsedInput.recurrenceDays,
        recurrenceMonthDays: parsedInput.recurrenceMonthDays,
        recurrenceCustomPeriod: parsedInput.recurrenceCustomPeriod,
        recurrenceEndDate: parsedInput.recurrenceEndDate,
        notes: parsedInput.notes,
        category: parsedInput.category,
        newTitle: parsedInput.newTitle,
      }),
      plannerContext: sanitizePlannerContext({
        ...planner.plannerContext,
        starterIntent,
      }),
    };

    const localValidation = validateCompanionPlannerRequest(requestBody);
    if (!localValidation.success) {
      toast.error(DEFAULT_PLANNER_ERROR);
      conversation.appendLocalMessage("assistant", DEFAULT_PLANNER_ERROR);
      return;
    }

    conversation.setDraftInput("");
    conversation.appendLocalMessage("user", trimmedMessage);
    setIsPlannerSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "companion-planner-chat",
        {
          body: requestBody,
        },
      );

      if (error) throw error;

      const response = data as CompanionPlannerResponse;
      const reply = stripMarkdown(response.reply).trim() || DEFAULT_PLANNER_ERROR;
      conversation.appendLocalMessage("assistant", reply);
    } catch (error) {
      const parsedError = await parseFunctionInvokeError(error);
      const userFacingError = toUserFacingCompanionPlannerError(parsedError);
      toast.error(userFacingError);
      conversation.appendLocalMessage("assistant", userFacingError);
    } finally {
      setIsPlannerSubmitting(false);
    }
  }, [
    conversation,
    isPlannerSubmitting,
    planner.currentDate,
    planner.horizon,
    planner.plannerContext,
    planner.sessionState,
    planner.tonePack,
  ]);

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (handledLaunchIntentIdRef.current === launchIntent.id) return;

    handledLaunchIntentIdRef.current = launchIntent.id;

    if (launchIntent.target === "campaign_builder") {
      onOpenCampaignBuilder?.(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    switch (launchIntent.starterIntent) {
      case "free_talk_start":
        conversation.injectAssistantOpening(launchIntent.message);
        break;
      case "quest_capture":
        conversation.injectAssistantOpening(launchIntent.message, {
          variant: "quest_prompt",
        });
        break;
      case "plan_day":
        void runPlannerStarter(launchIntent.message, "plan_day");
        break;
      case "upcoming_start":
        void runPlannerStarter(launchIntent.message, "upcoming_start");
        break;
      default:
        if (launchIntent.message.trim().length > 0) {
          conversation.injectAssistantOpening(launchIntent.message);
        }
        break;
    }

    onLaunchIntentConsumed?.(launchIntent.id);
  }, [
    conversation,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    runPlannerStarter,
  ]);

  return {
    messages: conversation.messages as JourneysCompanionSurfaceMessage[],
    draftInput: conversation.draftInput,
    setDraftInput: conversation.setDraftInput,
    isSubmitting: conversation.isSubmitting || isPlannerSubmitting,
    placeholder: "Talk to Cosmiq",
    todayLabel: planner.todayLabel,
    submitTypedMessage,
  };
}
