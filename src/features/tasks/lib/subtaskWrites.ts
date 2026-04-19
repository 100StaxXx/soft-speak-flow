import { supabase } from "@/integrations/supabase/client";
import { normalizeUuidLikeId } from "@/utils/offlineId";
import {
  createOfflinePlannerId,
  getLocalSubtasksForTask,
  removePlannerRecords,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";

export type QueueableSubtaskAction =
  | "SUBTASK_CREATE"
  | "SUBTASK_DELETE";

export type QueueSubtaskAction = (action: {
  actionKind: QueueableSubtaskAction;
  entityType: "subtask";
  entityId: string;
  payload: unknown;
}) => Promise<unknown>;

export type QuestSubtaskPlanMode = "append" | "replace";

export interface PlannerSubtaskRow {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

interface CreateSubtaskRowsParams {
  taskId: string;
  userId: string;
  titles: string[];
  startingSortOrder?: number;
}

interface ApplySubtaskTitlePlanParams {
  mode: QuestSubtaskPlanMode;
  taskId: string;
  userId: string;
  titles: string[];
  shouldQueueWrites: boolean;
  queueAction: QueueSubtaskAction;
  retryNow: () => Promise<void>;
}

const normalizeSubtaskTitle = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const subtaskTitleKey = (value: string): string =>
  normalizeSubtaskTitle(value).toLowerCase();

export const normalizeSubtaskTitles = (titles: string[]): string[] => {
  const seen = new Set<string>();

  return titles
    .map(normalizeSubtaskTitle)
    .filter((title) => title.length > 0)
    .filter((title) => {
      const key = subtaskTitleKey(title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getLocalSubtasksForAnyTaskId = async (
  taskId: string,
): Promise<PlannerSubtaskRow[]> => {
  const directMatches = await getLocalSubtasksForTask<PlannerSubtaskRow>(taskId);
  const normalizedTaskId = normalizeUuidLikeId(taskId);

  if (normalizedTaskId === taskId) {
    return directMatches;
  }

  const normalizedMatches = await getLocalSubtasksForTask<PlannerSubtaskRow>(
    normalizedTaskId,
  );
  const seenIds = new Set<string>();

  return [...directMatches, ...normalizedMatches].filter((subtask) => {
    const canonicalId = normalizeUuidLikeId(subtask.id);
    if (seenIds.has(canonicalId)) return false;
    seenIds.add(canonicalId);
    return true;
  });
};

const createSubtaskRows = ({
  taskId,
  userId,
  titles,
  startingSortOrder = 0,
}: CreateSubtaskRowsParams): PlannerSubtaskRow[] =>
  normalizeSubtaskTitles(titles).map((title, index) => ({
    id: normalizeUuidLikeId(createOfflinePlannerId("subtask")),
    task_id: normalizeUuidLikeId(taskId),
    user_id: userId,
    title,
    completed: false,
    completed_at: null,
    sort_order: startingSortOrder + index,
    created_at: new Date().toISOString(),
  }));

const queueSubtaskCreates = async (
  rows: PlannerSubtaskRow[],
  queueAction: QueueSubtaskAction,
) => {
  await Promise.all(rows.map((row) =>
    queueAction({
      actionKind: "SUBTASK_CREATE",
      entityType: "subtask",
      entityId: row.id,
      payload: row,
    })
  ));
};

const queueSubtaskDeletes = async (
  rows: PlannerSubtaskRow[],
  queueAction: QueueSubtaskAction,
) => {
  await Promise.all(rows.map((row) =>
    queueAction({
      actionKind: "SUBTASK_DELETE",
      entityType: "subtask",
      entityId: normalizeUuidLikeId(row.id),
      payload: { subtaskId: normalizeUuidLikeId(row.id) },
    })
  ));
};

const persistReplacementLocally = async (
  existingRows: PlannerSubtaskRow[],
  nextRows: PlannerSubtaskRow[],
) => {
  if (existingRows.length > 0) {
    await removePlannerRecords("subtasks", existingRows.map((row) => row.id));
  }

  if (nextRows.length > 0) {
    await upsertPlannerRecords("subtasks", nextRows);
  }
};

const appendSubtaskTitles = async (
  params: ApplySubtaskTitlePlanParams,
  existingRows: PlannerSubtaskRow[],
): Promise<PlannerSubtaskRow[]> => {
  const existingTitleKeys = new Set(existingRows.map((row) => subtaskTitleKey(row.title)));
  const titlesToCreate = normalizeSubtaskTitles(params.titles)
    .filter((title) => !existingTitleKeys.has(subtaskTitleKey(title)));

  if (titlesToCreate.length === 0) {
    return existingRows;
  }

  const nextRows = createSubtaskRows({
    taskId: params.taskId,
    userId: params.userId,
    titles: titlesToCreate,
    startingSortOrder: existingRows.length > 0
      ? Math.max(...existingRows.map((row) => row.sort_order)) + 1
      : 0,
  });

  if (nextRows.length === 0) {
    return existingRows;
  }

  await upsertPlannerRecords("subtasks", nextRows);

  if (params.shouldQueueWrites) {
    await queueSubtaskCreates(nextRows, params.queueAction);
    return [...existingRows, ...nextRows];
  }

  const { error } = await supabase.from("subtasks").insert(nextRows);
  if (error) {
    await queueSubtaskCreates(nextRows, params.queueAction);
    await params.retryNow();
  }

  return [...existingRows, ...nextRows];
};

const replaceSubtaskTitles = async (
  params: ApplySubtaskTitlePlanParams,
  existingRows: PlannerSubtaskRow[],
): Promise<PlannerSubtaskRow[]> => {
  const nextRows = createSubtaskRows({
    taskId: params.taskId,
    userId: params.userId,
    titles: params.titles,
  });

  await persistReplacementLocally(existingRows, nextRows);

  if (params.shouldQueueWrites) {
    await queueSubtaskDeletes(existingRows, params.queueAction);
    await queueSubtaskCreates(nextRows, params.queueAction);
    return nextRows;
  }

  const remoteExistingIds = existingRows.map((row) => normalizeUuidLikeId(row.id));
  if (remoteExistingIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("subtasks")
      .delete()
      .in("id", remoteExistingIds);

    if (deleteError) {
      await queueSubtaskDeletes(existingRows, params.queueAction);
      await params.retryNow();
    }
  }

  if (nextRows.length > 0) {
    const { error: insertError } = await supabase.from("subtasks").insert(nextRows);
    if (insertError) {
      await queueSubtaskCreates(nextRows, params.queueAction);
      await params.retryNow();
    }
  }

  return nextRows;
};

export const applySubtaskTitlePlan = async (
  params: ApplySubtaskTitlePlanParams,
): Promise<PlannerSubtaskRow[]> => {
  const normalizedTitles = normalizeSubtaskTitles(params.titles);
  if (params.mode === "append" && normalizedTitles.length === 0) {
    return getLocalSubtasksForAnyTaskId(params.taskId);
  }

  const existingRows = await getLocalSubtasksForAnyTaskId(params.taskId);
  const normalizedParams = {
    ...params,
    taskId: normalizeUuidLikeId(params.taskId),
    titles: normalizedTitles,
  };

  if (normalizedParams.mode === "replace") {
    return replaceSubtaskTitles(normalizedParams, existingRows);
  }

  return appendSubtaskTitles(normalizedParams, existingRows);
};
