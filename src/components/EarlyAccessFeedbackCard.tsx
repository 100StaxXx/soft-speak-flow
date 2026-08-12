import { useEffect, useMemo, useState } from "react";
import { MessageSquareHeart, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useDailyGuideThread } from "@/hooks/useDailyGuideThread";
import type { DailyGuideThreadRow } from "@/services/dailyGuideThread";
import { trackProductExperience } from "@/lib/productAnalytics";
import { safeLocalStorage } from "@/utils/storage";

const FEEDBACK_STATE_PREFIX = "graceward:early-feedback:v1";
const FEEDBACK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type FeedbackState = { actedAt?: string };

const hasMeaningfulDailyActivity = (thread?: DailyGuideThreadRow | null): boolean => Boolean(
  thread?.encouragement_completed_at
  || thread?.focus_answered_at
  || thread?.practice_completed_at
  || thread?.evening_reflected_at,
);

export const shouldShowEarlyAccessFeedback = ({
  current,
  previous,
  state,
  now = Date.now(),
}: {
  current?: DailyGuideThreadRow | null;
  previous?: DailyGuideThreadRow | null;
  state?: FeedbackState | null;
  now?: number;
}): boolean => {
  if (!hasMeaningfulDailyActivity(current) || !hasMeaningfulDailyActivity(previous)) return false;
  if (!state?.actedAt) return true;
  const actedAt = Date.parse(state.actedAt);
  return !Number.isFinite(actedAt) || now - actedAt >= FEEDBACK_COOLDOWN_MS;
};

const readFeedbackState = (key: string): FeedbackState | null => {
  const value = safeLocalStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as FeedbackState;
  } catch {
    return null;
  }
};

export const EarlyAccessFeedbackCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { thread, previousThread } = useDailyGuideThread();
  const storageKey = `${FEEDBACK_STATE_PREFIX}:${user?.id ?? "guest"}`;
  const [localState, setLocalState] = useState<FeedbackState | null>(() => readFeedbackState(storageKey));
  const shouldShow = useMemo(
    () => shouldShowEarlyAccessFeedback({ current: thread, previous: previousThread, state: localState }),
    [localState, previousThread, thread],
  );

  useEffect(() => {
    setLocalState(readFeedbackState(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!shouldShow) return;
    void trackProductExperience("feedback_prompt_viewed", {
      surface: "today",
      properties: { experience_days: 2 },
    });
  }, [shouldShow]);

  const markActed = (eventName: "feedback_prompt_opened" | "feedback_prompt_dismissed") => {
    const nextState = { actedAt: new Date().toISOString() };
    safeLocalStorage.setItem(storageKey, JSON.stringify(nextState));
    setLocalState(nextState);
    void trackProductExperience(eventName, { surface: "today" });
  };

  if (!shouldShow) return null;

  return (
    <Card className="border-primary/25 bg-card/90 p-5 shadow-sm backdrop-blur-xl" aria-label="Graceward feedback invitation">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">
          <MessageSquareHeart className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Help shape Graceward</p>
              <h2 className="mt-1 text-lg font-semibold">Did the daily relationship feel connected?</h2>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Dismiss feedback invitation"
              onClick={() => markActed("feedback_prompt_dismissed")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tell us whether your Companion felt aware of you, your Guide felt connected to Today, and the next step was clear.
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4 rounded-full"
            onClick={() => {
              markActed("feedback_prompt_opened");
              navigate("/support/report", {
                state: {
                  defaultCategory: "feedback",
                  defaultMessage: [
                    "Companion awareness: ",
                    "Guide connection to Today: ",
                    "Clarity of the next step: ",
                    "Anything else: ",
                  ].join("\n\n"),
                },
              });
            }}
          >
            Share quick feedback
          </Button>
        </div>
      </div>
    </Card>
  );
};
