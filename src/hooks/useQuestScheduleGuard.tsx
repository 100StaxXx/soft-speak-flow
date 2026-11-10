import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeQuestSchedule, linkedScheduleExclusions, type QuestScheduleDraft } from "@/utils/questScheduleConflicts";
import { loadQuestScheduleAvailability, type ScheduleAvailabilityOptions, type ScheduleAvailability } from "@/services/questScheduleAvailability";
import { QuestConflictDialog, type QuestConflictReview } from "@/components/calendar/QuestConflictDialog";

export function useQuestScheduleGuard(options: ScheduleAvailabilityOptions & { scopeKey: string }) {
  const [review, setReview] = useState<QuestConflictReview | null>(null);
  const pending = useRef<{ draft: QuestScheduleDraft; onChooseAnotherDay?: () => void; resolve: (draft: QuestScheduleDraft | null) => void } | null>(null);
  const resolve = useCallback((draft: QuestScheduleDraft | null) => {
    const request = pending.current;
    pending.current = null;
    setReview(null);
    request?.resolve(draft);
  }, []);
  useEffect(() => () => {
    pending.current?.resolve(null);
    pending.current = null;
  }, [options.userId, options.scopeKey]);
  useEffect(() => { setReview(null); }, [options.userId, options.scopeKey]);

  const checkSchedule = useCallback(async (draft: QuestScheduleDraft, checkedSnapshot?: ScheduleAvailability, onChooseAnotherDay?: () => void): Promise<QuestScheduleDraft | null> => {
    if (pending.current || !options.userId) return null;
    if (!draft.task_date || !draft.scheduled_time || draft.completed) return draft;
    return new Promise(resolveRequest => {
      const request = { draft, onChooseAnotherDay, resolve: resolveRequest };
      pending.current = request;
      setReview({ title: draft.task_text, date: draft.task_date! });
      void (async () => {
        try {
          const snapshot = checkedSnapshot ?? await loadQuestScheduleAvailability(draft, options);
          if (pending.current !== request) return;
          const excludedEvents = new Set([...options.excludedEventKeys,
            ...linkedScheduleExclusions(draft, snapshot.tasks, snapshot.events, options.linkedEvents ?? [], options.timezone)]);
          const analysis = analyzeQuestSchedule(draft, snapshot.tasks, snapshot.events, options.timezone, excludedEvents, snapshot.commitments);
          if (!analysis.conflicts.length && !analysis.invalidTime && !snapshot.incomplete) { resolve(draft); return; }
          setReview({ title: draft.task_text, date: draft.task_date!, analysis, incomplete: snapshot.incomplete });
        } catch {
          if (pending.current !== request) return;
          setReview({ title: draft.task_text, date: draft.task_date!, incomplete: true,
            analysis: { conflicts: [], nextTime: null, throughDate: draft.task_date!, recurring: false, invalidTime: false } });
        }
      })();
    });
  }, [options, resolve]);

  return { checkSchedule, conflictDialog: <QuestConflictDialog review={review} onChooseAnotherDay={pending.current?.onChooseAnotherDay && (() => {
    const chooseDay = pending.current?.onChooseAnotherDay;
    resolve(null);
    chooseDay?.();
  })} onChoose={choice => {
    const draft = pending.current?.draft;
    if (!draft || choice === "cancel") { resolve(null); return; }
    if (!review?.analysis || review.analysis.invalidTime) return;
    if (choice === "next" && (!review.analysis.nextTime || review.incomplete)) return;
    resolve(choice === "next" ? { ...draft, scheduled_time: review.analysis.nextTime } : draft);
  }} /> };
}
