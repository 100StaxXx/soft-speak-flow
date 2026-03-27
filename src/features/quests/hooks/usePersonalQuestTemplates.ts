import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { DailyTask } from "@/services/dailyTasksRemote";
import type { PersonalQuestTemplate, QuestDifficulty } from "@/features/quests/types";
import { isValidDifficulty } from "@/types/quest";
import {
  getAllLocalTasksForUser,
  getLocalSubtasksForTask,
} from "@/utils/plannerLocalStore";
import { PLANNER_SYNC_EVENT } from "@/utils/plannerSync";

type AllowedPersonalQuestSource = "manual" | "inbox" | "voice" | "nlp";

type PersonalQuestSubtaskRecord = {
  id: string;
  title: string;
  sort_order: number | null;
};

interface PersonalQuestTemplateGroup {
  normalizedTitle: string;
  frequency: number;
  lastUsedAt: string | null;
  representativeTask: DailyTask;
}

const ALLOWED_PERSONAL_QUEST_SOURCES = new Set<AllowedPersonalQuestSource>([
  "manual",
  "inbox",
  "voice",
  "nlp",
]);

const MIN_PERSONAL_TEMPLATE_FREQUENCY = 2;

const normalizeQuestTitle = (taskText: string) => taskText.trim().replace(/\s+/g, " ").toLowerCase();
const normalizeQuestDisplayTitle = (taskText: string) => taskText.trim().replace(/\s+/g, " ");

const getTaskRecencyTimestamp = (task: DailyTask): number => {
  const candidates = [
    task.created_at,
    task.completed_at,
    task.task_date ? `${task.task_date}T00:00:00.000Z` : null,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  return 0;
};

const normalizeDifficulty = (difficulty: string | null): QuestDifficulty =>
  isValidDifficulty(difficulty) ? difficulty : "medium";

export const isEligiblePersonalQuestTask = (task: DailyTask): boolean => {
  const normalizedTitle = normalizeQuestTitle(task.task_text);
  if (!normalizedTitle) return false;
  if (task.habit_source_id !== null) return false;
  if (task.ai_generated === true) return false;
  return ALLOWED_PERSONAL_QUEST_SOURCES.has((task.source ?? "") as AllowedPersonalQuestSource);
};

export const derivePersonalQuestTemplateGroups = (tasks: DailyTask[]): PersonalQuestTemplateGroup[] => {
  const groups = new Map<string, PersonalQuestTemplateGroup>();

  tasks.forEach((task) => {
    if (!isEligiblePersonalQuestTask(task)) return;

    const normalizedTitle = normalizeQuestTitle(task.task_text);
    const currentTaskTimestamp = getTaskRecencyTimestamp(task);
    const existing = groups.get(normalizedTitle);

    if (!existing) {
      groups.set(normalizedTitle, {
        normalizedTitle,
        frequency: 1,
        lastUsedAt: task.created_at ?? task.completed_at ?? task.task_date ?? null,
        representativeTask: task,
      });
      return;
    }

    const existingTimestamp = getTaskRecencyTimestamp(existing.representativeTask);
    const representativeTask = currentTaskTimestamp >= existingTimestamp ? task : existing.representativeTask;
    const lastUsedAt =
      currentTaskTimestamp >= existingTimestamp
        ? (task.created_at ?? task.completed_at ?? task.task_date ?? null)
        : existing.lastUsedAt;

    groups.set(normalizedTitle, {
      normalizedTitle,
      frequency: existing.frequency + 1,
      lastUsedAt,
      representativeTask,
    });
  });

  return Array.from(groups.values())
    .filter((group) => group.frequency >= MIN_PERSONAL_TEMPLATE_FREQUENCY)
    .sort((left, right) => {
      if (right.frequency !== left.frequency) {
        return right.frequency - left.frequency;
      }
      return getTaskRecencyTimestamp(right.representativeTask) - getTaskRecencyTimestamp(left.representativeTask);
    });
};

export async function buildPersonalQuestTemplates(userId: string): Promise<PersonalQuestTemplate[]> {
  const tasks = await getAllLocalTasksForUser<DailyTask>(userId);
  const groups = derivePersonalQuestTemplateGroups(tasks);

  const subtasksByTemplateId = new Map<string, string[]>();

  await Promise.all(groups.map(async (group) => {
    const subtasks = await getLocalSubtasksForTask<PersonalQuestSubtaskRecord>(group.representativeTask.id);
    const normalizedSubtasks = subtasks
      .slice()
      .sort((left, right) => (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER))
      .map((subtask) => subtask.title.trim())
      .filter((title) => title.length > 0);

    subtasksByTemplateId.set(group.normalizedTitle, normalizedSubtasks);
  }));

  return groups.map((group) => ({
    id: `personal-${group.normalizedTitle}`,
    title: normalizeQuestDisplayTitle(group.representativeTask.task_text),
    frequency: group.frequency,
    lastUsedAt: group.lastUsedAt,
    difficulty: normalizeDifficulty(group.representativeTask.difficulty),
    estimatedDuration: group.representativeTask.estimated_duration ?? null,
    notes: group.representativeTask.notes ?? null,
    subtasks: subtasksByTemplateId.get(group.normalizedTitle) ?? [],
  }));
}

interface UsePersonalQuestTemplatesOptions {
  enabled?: boolean;
}

export const usePersonalQuestTemplates = ({ enabled = true }: UsePersonalQuestTemplatesOptions = {}) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PersonalQuestTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.id) {
      setTemplates([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextTemplates = await buildPersonalQuestTemplates(user.id);
      setTemplates(nextTemplates);
    } catch (caughtError) {
      const nextError = caughtError instanceof Error
        ? caughtError
        : new Error("Failed to build personal quest templates");
      setError(nextError);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !user?.id) return;

    const handlePlannerSync = () => {
      void refresh();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [enabled, refresh, user?.id]);

  return {
    templates,
    isLoading,
    error,
    refresh,
  };
};
