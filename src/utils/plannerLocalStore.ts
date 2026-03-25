const DB_NAME = "cosmiq-planner-db";
const DB_VERSION = 1;

type PlannerStoreName =
  | "daily_tasks"
  | "subtasks"
  | "habits"
  | "habit_completions"
  | "epics"
  | "epic_habits"
  | "journey_phases"
  | "epic_milestones";

type StoreMode = IDBTransactionMode;

interface UserScopedRecord {
  id: string;
  user_id: string;
}

interface TaskScopedRecord extends UserScopedRecord {
  task_date: string | null;
}

interface SubtaskRecord extends UserScopedRecord {
  task_id: string;
}

interface HabitCompletionRecord extends UserScopedRecord {
  habit_id: string | null;
  date: string;
}

interface EpicHabitRecord {
  id: string;
  epic_id: string;
  habit_id: string;
  user_id?: string;
}

interface EpicScopedRecord extends UserScopedRecord {
  epic_id: string;
}

let db: IDBDatabase | null = null;

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });

const createStore = (
  database: IDBDatabase,
  name: PlannerStoreName,
  indexes: Array<{ name: string; keyPath: string | string[]; options?: IDBIndexParameters }>,
) => {
  if (database.objectStoreNames.contains(name)) {
    return;
  }

  const store = database.createObjectStore(name, { keyPath: "id" });
  indexes.forEach((index) => {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, index.options);
    }
  });
};

export async function initPlannerLocalDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const database = request.result;
      createStore(database, "daily_tasks", [
        { name: "user_id", keyPath: "user_id" },
        { name: "user_task_date", keyPath: ["user_id", "task_date"] },
        { name: "parent_template_id", keyPath: "parent_template_id" },
        { name: "habit_source_id", keyPath: "habit_source_id" },
      ]);
      createStore(database, "subtasks", [
        { name: "user_id", keyPath: "user_id" },
        { name: "task_id", keyPath: "task_id" },
      ]);
      createStore(database, "habits", [
        { name: "user_id", keyPath: "user_id" },
      ]);
      createStore(database, "habit_completions", [
        { name: "user_id", keyPath: "user_id" },
        { name: "user_date", keyPath: ["user_id", "date"] },
        { name: "habit_id", keyPath: "habit_id" },
      ]);
      createStore(database, "epics", [
        { name: "user_id", keyPath: "user_id" },
      ]);
      createStore(database, "epic_habits", [
        { name: "epic_id", keyPath: "epic_id" },
        { name: "habit_id", keyPath: "habit_id" },
      ]);
      createStore(database, "journey_phases", [
        { name: "user_id", keyPath: "user_id" },
        { name: "epic_id", keyPath: "epic_id" },
      ]);
      createStore(database, "epic_milestones", [
        { name: "user_id", keyPath: "user_id" },
        { name: "epic_id", keyPath: "epic_id" },
      ]);
    };
  });
}

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  return initPlannerLocalDB();
}

async function withStore<T>(
  storeName: PlannerStoreName,
  mode: StoreMode,
  handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const database = await getDB();
  const transaction = database.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  const result = await handler(store, transaction);
  if (mode !== "readonly") {
    await transactionDone(transaction);
  }
  return result;
}

async function getAllByIndex<T>(
  storeName: PlannerStoreName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  return withStore(storeName, "readonly", async (store) => {
    const index = store.index(indexName);
    const rows = await requestToPromise(index.getAll(query));
    return rows as T[];
  });
}

async function getAllFromStore<T>(storeName: PlannerStoreName): Promise<T[]> {
  return withStore(storeName, "readonly", async (store) => {
    const rows = await requestToPromise(store.getAll());
    return rows as T[];
  });
}

export async function upsertPlannerRecords<T extends { id: string }>(
  storeName: PlannerStoreName,
  records: T[],
): Promise<void> {
  if (records.length === 0) return;

  await withStore(storeName, "readwrite", async (store) => {
    for (const record of records) {
      await requestToPromise(store.put(record));
    }
  });
}

export async function upsertPlannerRecord<T extends { id: string }>(
  storeName: PlannerStoreName,
  record: T,
): Promise<void> {
  await upsertPlannerRecords(storeName, [record]);
}

export async function getPlannerRecord<T>(
  storeName: PlannerStoreName,
  id: string,
): Promise<T | null> {
  return withStore(storeName, "readonly", async (store) => {
    const row = await requestToPromise(store.get(id));
    return (row as T | undefined) ?? null;
  });
}

export async function removePlannerRecord(storeName: PlannerStoreName, id: string): Promise<void> {
  await withStore(storeName, "readwrite", async (store) => {
    await requestToPromise(store.delete(id));
  });
}

export async function removePlannerRecords(storeName: PlannerStoreName, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await withStore(storeName, "readwrite", async (store) => {
    for (const id of ids) {
      await requestToPromise(store.delete(id));
    }
  });
}

export async function getLocalTasksByDate<T extends TaskScopedRecord>(
  userId: string,
  taskDate: string,
): Promise<T[]> {
  return getAllByIndex<T>("daily_tasks", "user_task_date", [userId, taskDate]);
}

export async function getLocalInboxTasks<T extends TaskScopedRecord>(userId: string): Promise<T[]> {
  return getAllByIndex<T>("daily_tasks", "user_task_date", [userId, null]);
}

export async function getAllLocalTasksForUser<T extends TaskScopedRecord>(userId: string): Promise<T[]> {
  return getAllByIndex<T>("daily_tasks", "user_id", userId);
}

export async function getLocalSubtasksForTask<T extends SubtaskRecord>(taskId: string): Promise<T[]> {
  return getAllByIndex<T>("subtasks", "task_id", taskId);
}

export async function getLocalHabits<T extends UserScopedRecord>(userId: string): Promise<T[]> {
  return getAllByIndex<T>("habits", "user_id", userId);
}

export async function getLocalHabitCompletionsForDate<T extends HabitCompletionRecord>(
  userId: string,
  date: string,
): Promise<T[]> {
  return getAllByIndex<T>("habit_completions", "user_date", [userId, date]);
}

export async function getLocalHabitCompletions<T extends HabitCompletionRecord>(userId: string): Promise<T[]> {
  return getAllByIndex<T>("habit_completions", "user_id", userId);
}

export async function getLocalEpics<T extends UserScopedRecord>(userId: string): Promise<T[]> {
  return getAllByIndex<T>("epics", "user_id", userId);
}

export async function getLocalEpicHabits<T extends EpicHabitRecord>(epicIds: string[]): Promise<T[]> {
  if (epicIds.length === 0) return [];
  const rows = await getAllFromStore<T>("epic_habits");
  const epicIdSet = new Set(epicIds);
  return rows.filter((row) => epicIdSet.has(row.epic_id));
}

export async function getLocalJourneyPhases<T extends EpicScopedRecord>(epicId: string): Promise<T[]> {
  return getAllByIndex<T>("journey_phases", "epic_id", epicId);
}

export async function getLocalEpicMilestones<T extends EpicScopedRecord>(epicId: string): Promise<T[]> {
  return getAllByIndex<T>("epic_milestones", "epic_id", epicId);
}

export async function replaceLocalTasksForDate<T extends TaskScopedRecord & { subtasks?: SubtaskRecord[] | null }>(
  userId: string,
  taskDate: string,
  tasks: T[],
): Promise<void> {
  const existingTasks = await getLocalTasksByDate<TaskScopedRecord>(userId, taskDate);
  const existingTaskIds = existingTasks.map((task) => task.id);
  const incomingTaskIds = new Set(tasks.map((task) => task.id));
  const taskIdsToDelete = existingTaskIds.filter((taskId) => !incomingTaskIds.has(taskId));

  const subtasksToPersist = tasks.flatMap((task) =>
    ((task.subtasks ?? []) as SubtaskRecord[]).map((subtask) => ({
      ...subtask,
      user_id: subtask.user_id || userId,
    })),
  );

  await upsertPlannerRecords(
    "daily_tasks",
    tasks.map(({ subtasks, ...task }) => task as T),
  );

  for (const task of tasks) {
    const existingSubtasks = await getLocalSubtasksForTask<SubtaskRecord>(task.id);
    const incomingSubtaskIds = new Set(((task.subtasks ?? []) as SubtaskRecord[]).map((subtask) => subtask.id));
    const subtaskIdsToDelete = existingSubtasks
      .map((subtask) => subtask.id)
      .filter((subtaskId) => !incomingSubtaskIds.has(subtaskId));

    if (subtaskIdsToDelete.length > 0) {
      await removePlannerRecords("subtasks", subtaskIdsToDelete);
    }
  }

  if (subtasksToPersist.length > 0) {
    await upsertPlannerRecords("subtasks", subtasksToPersist);
  }

  if (taskIdsToDelete.length > 0) {
    for (const taskId of taskIdsToDelete) {
      const existingSubtasks = await getLocalSubtasksForTask<SubtaskRecord>(taskId);
      if (existingSubtasks.length > 0) {
        await removePlannerRecords("subtasks", existingSubtasks.map((subtask) => subtask.id));
      }
    }
    await removePlannerRecords("daily_tasks", taskIdsToDelete);
  }
}

export async function replaceLocalHabitsForUser<T extends UserScopedRecord>(
  userId: string,
  habits: T[],
): Promise<void> {
  const existingHabits = await getLocalHabits<UserScopedRecord>(userId);
  const incomingIds = new Set(habits.map((habit) => habit.id));
  const idsToDelete = existingHabits
    .map((habit) => habit.id)
    .filter((habitId) => !incomingIds.has(habitId));

  await upsertPlannerRecords("habits", habits);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("habits", idsToDelete);
  }
}

export async function replaceLocalHabitCompletionsForDate<T extends HabitCompletionRecord>(
  userId: string,
  date: string,
  completions: T[],
): Promise<void> {
  const existingCompletions = await getLocalHabitCompletionsForDate<HabitCompletionRecord>(userId, date);
  const incomingIds = new Set(completions.map((completion) => completion.id));
  const idsToDelete = existingCompletions
    .map((completion) => completion.id)
    .filter((completionId) => !incomingIds.has(completionId));

  await upsertPlannerRecords("habit_completions", completions);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("habit_completions", idsToDelete);
  }
}

export async function replaceLocalEpicsForUser<T extends UserScopedRecord>(
  userId: string,
  epics: T[],
): Promise<void> {
  const existingEpics = await getLocalEpics<UserScopedRecord>(userId);
  const incomingIds = new Set(epics.map((epic) => epic.id));
  const idsToDelete = existingEpics
    .map((epic) => epic.id)
    .filter((epicId) => !incomingIds.has(epicId));

  await upsertPlannerRecords("epics", epics);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("epics", idsToDelete);
  }
}

export async function replaceLocalEpicHabits<T extends EpicHabitRecord>(
  epicId: string,
  epicHabits: T[],
): Promise<void> {
  const existingRows = await getLocalEpicHabits<EpicHabitRecord>([epicId]);
  const incomingIds = new Set(epicHabits.map((row) => row.id));
  const idsToDelete = existingRows
    .map((row) => row.id)
    .filter((rowId) => !incomingIds.has(rowId));

  await upsertPlannerRecords("epic_habits", epicHabits);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("epic_habits", idsToDelete);
  }
}

export async function replaceLocalJourneyPhases<T extends EpicScopedRecord>(
  epicId: string,
  phases: T[],
): Promise<void> {
  const existingRows = await getLocalJourneyPhases<EpicScopedRecord>(epicId);
  const incomingIds = new Set(phases.map((phase) => phase.id));
  const idsToDelete = existingRows
    .map((phase) => phase.id)
    .filter((phaseId) => !incomingIds.has(phaseId));

  await upsertPlannerRecords("journey_phases", phases);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("journey_phases", idsToDelete);
  }
}

export async function replaceLocalEpicMilestones<T extends EpicScopedRecord>(
  epicId: string,
  milestones: T[],
): Promise<void> {
  const existingRows = await getLocalEpicMilestones<EpicScopedRecord>(epicId);
  const incomingIds = new Set(milestones.map((milestone) => milestone.id));
  const idsToDelete = existingRows
    .map((milestone) => milestone.id)
    .filter((milestoneId) => !incomingIds.has(milestoneId));

  await upsertPlannerRecords("epic_milestones", milestones);
  if (idsToDelete.length > 0) {
    await removePlannerRecords("epic_milestones", idsToDelete);
  }
}

export async function clearPlannerLocalStateForUser(userId: string): Promise<void> {
  const tasks = await getAllLocalTasksForUser<TaskScopedRecord>(userId);
  const taskIds = tasks.map((task) => task.id);
  const habits = await getLocalHabits<UserScopedRecord>(userId);
  const completions = await getLocalHabitCompletions<HabitCompletionRecord>(userId);
  const epics = await getLocalEpics<UserScopedRecord>(userId);
  const epicIds = epics.map((epic) => epic.id);

  if (taskIds.length > 0) {
    const subtaskIds: string[] = [];
    for (const taskId of taskIds) {
      const subtasks = await getLocalSubtasksForTask<SubtaskRecord>(taskId);
      subtaskIds.push(...subtasks.map((subtask) => subtask.id));
    }

    if (subtaskIds.length > 0) {
      await removePlannerRecords("subtasks", subtaskIds);
    }
    await removePlannerRecords("daily_tasks", taskIds);
  }

  if (habits.length > 0) {
    await removePlannerRecords("habits", habits.map((habit) => habit.id));
  }
  if (completions.length > 0) {
    await removePlannerRecords("habit_completions", completions.map((completion) => completion.id));
  }
  if (epics.length > 0) {
    await removePlannerRecords("epics", epicIds);
    const epicHabits = await getLocalEpicHabits<EpicHabitRecord>(epicIds);
    if (epicHabits.length > 0) {
      await removePlannerRecords("epic_habits", epicHabits.map((row) => row.id));
    }

    for (const epicId of epicIds) {
      const phases = await getLocalJourneyPhases<EpicScopedRecord>(epicId);
      const milestones = await getLocalEpicMilestones<EpicScopedRecord>(epicId);

      if (phases.length > 0) {
        await removePlannerRecords("journey_phases", phases.map((phase) => phase.id));
      }
      if (milestones.length > 0) {
        await removePlannerRecords("epic_milestones", milestones.map((milestone) => milestone.id));
      }
    }
  }
}

export function createOfflinePlannerId(prefix: string): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomPart}`;
}

export function __resetPlannerLocalDBForTests(): void {
  if (db) {
    db.close();
  }
  db = null;
}
