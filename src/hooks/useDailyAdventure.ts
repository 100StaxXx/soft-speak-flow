import { useCallback, useEffect, useMemo, useState } from "react";

import type { DailyFormationCategory } from "@/data/dailyFormationPractices";
import {
  applyDailyAdventureChoice,
  createEmptyDailyAdventure,
  DAILY_ADVENTURE_PATH_CHOSEN_EVENT,
  DAILY_ADVENTURE_UPDATED_EVENT,
  getDailyAdventureStorageKey,
  isDailyAdventureState,
  selectDailyAdventureDecision,
  type DailyAdventureOption,
  type DailyAdventureQuest,
  type DailyAdventureState,
} from "@/lib/dailyAdventure";
import { safeLocalStorage } from "@/utils/storage";

interface UseDailyAdventureOptions {
  ownerId?: string | null;
  dateKey: string;
  companionId?: string | null;
  companionName?: string | null;
  now?: Date;
}

interface DailyAdventureUpdatedDetail {
  storageKey: string;
  state: DailyAdventureState;
}

const readAdventure = (storageKey: string, ownerId: string, dateKey: string, now: Date) => {
  const raw = safeLocalStorage.getItem(storageKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isDailyAdventureState(parsed) && parsed.ownerId === ownerId && parsed.dateKey === dateKey) {
        return parsed;
      }
    } catch {
      // A malformed local record should never block today's adventure.
    }
  }
  return createEmptyDailyAdventure(ownerId, dateKey, now);
};

export function useDailyAdventure({
  ownerId,
  dateKey,
  companionId,
  companionName,
  now,
}: UseDailyAdventureOptions) {
  const effectiveOwnerId = ownerId ?? companionId ?? "graceward-preview";
  const effectiveCompanionId = companionId ?? "companion";
  const effectiveCompanionName = companionName?.trim() || "your Companion";
  const effectiveNow = now ?? new Date();
  const storageKey = useMemo(
    () => getDailyAdventureStorageKey(effectiveOwnerId, dateKey),
    [dateKey, effectiveOwnerId],
  );
  const [state, setState] = useState<DailyAdventureState>(() =>
    readAdventure(storageKey, effectiveOwnerId, dateKey, effectiveNow));

  useEffect(() => {
    setState(readAdventure(storageKey, effectiveOwnerId, dateKey, new Date()));
  }, [dateKey, effectiveOwnerId, storageKey]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DailyAdventureUpdatedDetail>).detail;
      if (detail?.storageKey !== storageKey || !isDailyAdventureState(detail.state)) return;
      setState(detail.state);
    };
    window.addEventListener(DAILY_ADVENTURE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(DAILY_ADVENTURE_UPDATED_EVENT, handleUpdate);
  }, [storageKey]);

  const persist = useCallback((next: DailyAdventureState) => {
    safeLocalStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
    window.dispatchEvent(new CustomEvent<DailyAdventureUpdatedDetail>(DAILY_ADVENTURE_UPDATED_EVENT, {
      detail: { storageKey, state: next },
    }));
    return next;
  }, [storageKey]);

  const decision = useMemo(() => selectDailyAdventureDecision({
    state,
    companionId: effectiveCompanionId,
    hour: effectiveNow.getHours(),
  }), [effectiveCompanionId, effectiveNow, state]);

  const choose = useCallback((optionId: string): DailyAdventureOption | null => {
    const option = decision.options.find((candidate) => candidate.id === optionId);
    if (!option) return null;

    if (decision.kind !== "bridge") {
      const next = applyDailyAdventureChoice({
        state,
        decision,
        option,
        companionName: effectiveCompanionName,
      });
      persist(next);
      if (decision.kind === "path" && next.path) {
        window.dispatchEvent(new CustomEvent(DAILY_ADVENTURE_PATH_CHOSEN_EVENT, {
          detail: next.path,
        }));
      }
    }
    return option;
  }, [decision, effectiveCompanionName, persist, state]);

  const attachQuest = useCallback((quest: {
    practiceId: string;
    title: string;
    action: string;
    category: DailyFormationCategory;
    completedAt?: string | null;
  }) => {
    const current = state.quest;
    if (
      current?.practiceId === quest.practiceId
      && current.title === quest.title
      && current.action === quest.action
      && current.completedAt === (quest.completedAt ?? null)
    ) return current;

    const nextQuest: DailyAdventureQuest = {
      practiceId: quest.practiceId,
      title: quest.title,
      action: quest.action,
      category: quest.category,
      attachedAt: current?.attachedAt ?? new Date().toISOString(),
      completedAt: quest.completedAt ?? null,
    };
    persist({
      ...state,
      quest: nextQuest,
      updatedAt: new Date().toISOString(),
    });
    return nextQuest;
  }, [persist, state]);

  const markQuestComplete = useCallback((completedAt = new Date().toISOString()) => {
    if (!state.quest || state.quest.completedAt === completedAt) return;
    persist({
      ...state,
      quest: { ...state.quest, completedAt },
      updatedAt: completedAt,
    });
  }, [persist, state]);

  return {
    state,
    decision,
    choose,
    attachQuest,
    markQuestComplete,
    hasChosenPath: Boolean(state.path),
    chapterComplete: Boolean(state.eveningChoice),
  };
}
