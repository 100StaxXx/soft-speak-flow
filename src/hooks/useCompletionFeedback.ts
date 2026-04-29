import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTalkPopupContextSafe } from "@/contexts/TalkPopupContext";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";
import { logger } from "@/utils/logger";
import {
  buildCompletionFeedbackFallback,
  normalizeCompletionFeedbackResponse,
} from "@/utils/completionFeedback";
import type {
  CompletionFeedbackEvent,
  CompletionFeedbackResponse,
} from "@/types/completionFeedback";

const AI_FEEDBACK_REPLACE_WINDOW_MS = 900;

const toPopupOptions = (feedback: CompletionFeedbackResponse) => ({
  message: feedback.companion.message,
  tone: feedback.companion.tone,
  mentor: feedback.mentor?.show
    ? {
        personality: feedback.mentor.personality,
        message: feedback.mentor.message,
      }
    : undefined,
});

const isSameFeedback = (
  left: CompletionFeedbackResponse,
  right: CompletionFeedbackResponse,
): boolean =>
  left.companion.message === right.companion.message
  && left.companion.tone === right.companion.tone
  && (left.mentor?.show ?? false) === (right.mentor?.show ?? false)
  && (left.mentor?.personality ?? "") === (right.mentor?.personality ?? "")
  && (left.mentor?.message ?? "") === (right.mentor?.message ?? "");

export const useCompletionFeedback = () => {
  const { user } = useAuth();
  const talkPopup = useTalkPopupContextSafe();
  const { triggerEvent } = useCompanionMotionSafe();

  const triggerCompletionFeedback = useCallback(async (event: CompletionFeedbackEvent) => {
    if (!event.taskId || !event.taskTitle) return;

    const completedAt = event.completedAt ?? new Date().toISOString();
    const fallback = buildCompletionFeedbackFallback({ ...event, completedAt });

    await talkPopup.show(toPopupOptions(fallback));
    const fallbackShownAt = Date.now();
    triggerEvent({
      type: event.habitSourceId || event.completionSource === "ritual" ? "streak" : "quest_complete",
      intensity: "medium",
      reason: fallback.companion.message,
    });

    if (user?.id) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-completion-feedback", {
          body: {
            taskId: event.taskId,
            completionSource: event.completionSource ?? (event.habitSourceId ? "ritual" : "quest"),
            completedAt,
            clientContext: {
              taskTitle: event.taskTitle,
              taskDate: event.taskDate ?? null,
              scheduledTime: event.scheduledTime ?? null,
              difficulty: event.difficulty ?? null,
              category: event.category ?? null,
              habitSourceId: event.habitSourceId ?? null,
              epicId: event.epicId ?? null,
              epicTitle: event.epicTitle ?? null,
              completedAllRituals: event.completedAllRituals === true,
              firstRitualToday: event.firstRitualToday === true,
            },
          },
        });

        if (error) throw error;
        const feedback = normalizeCompletionFeedbackResponse(data);
        const canReplaceFreshFallback = Date.now() - fallbackShownAt <= AI_FEEDBACK_REPLACE_WINDOW_MS;
        if (feedback && canReplaceFreshFallback && !isSameFeedback(feedback, fallback)) {
          await talkPopup.replaceCurrent(toPopupOptions(feedback), fallback.companion.message);
        }
      } catch (error) {
        logger.warn("Completion feedback generation failed after fallback display", error);
      }
    }
  }, [talkPopup, triggerEvent, user?.id]);

  return { triggerCompletionFeedback };
};
