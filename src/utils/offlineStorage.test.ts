import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetOfflineDBForTests,
  addPendingAction,
  clearAllPendingActions,
  getPendingActionCount,
  getPendingActions,
  initOfflineDB,
} from "./offlineStorage";

const DB_NAME = "cosmiq-offline-db";

const supportsIndexedDb = typeof indexedDB !== "undefined";

const deleteDatabase = async () => {
  __resetOfflineDBForTests();
  if (!supportsIndexedDb) return;

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
};

const seedLegacyV1Database = async (rows: Array<Record<string, unknown>>) => {
  await deleteDatabase();

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("tasks", { keyPath: "id" });
      const actionStore = database.createObjectStore("pendingActions", { keyPath: "id" });
      actionStore.createIndex("timestamp", "timestamp");
      database.createObjectStore("cache", { keyPath: "key" });

      rows.forEach((row) => {
        actionStore.add(row);
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

const maybeDescribe = supportsIndexedDb ? describe : describe.skip;

maybeDescribe("offlineStorage user scoping", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it("partitions pending actions by user_id", async () => {
    await initOfflineDB();
    await addPendingAction("CREATE_TASK", { task_text: "A" }, "user-a");
    await addPendingAction("UPDATE_TASK", { task_text: "B" }, "user-b");
    await addPendingAction("DELETE_TASK", { taskId: "123" }, "user-a");

    const userAActions = await getPendingActions("user-a");
    const userBActions = await getPendingActions("user-b");

    expect(userAActions).toHaveLength(2);
    expect(userBActions).toHaveLength(1);
    expect(userAActions.every((action) => action.user_id === "user-a")).toBe(true);
    expect(userBActions.every((action) => action.user_id === "user-b")).toBe(true);
    expect(await getPendingActionCount("user-a")).toBe(2);
    expect(await getPendingActionCount("user-b")).toBe(1);
  });

  it("purges legacy unscoped actions during v1 to v2 migration", async () => {
    await seedLegacyV1Database([
      {
        id: "legacy-no-user",
        type: "CREATE_TASK",
        payload: { task_text: "legacy" },
        timestamp: 1,
        retries: 0,
      },
      {
        id: "legacy-with-user",
        user_id: "user-a",
        type: "CREATE_TASK",
        payload: { task_text: "kept" },
        timestamp: 2,
        retries: 0,
      },
    ]);

    await initOfflineDB();

    const userActions = await getPendingActions("user-a");
    const totalCount = await getPendingActionCount();

    expect(userActions).toHaveLength(1);
    expect(userActions[0].id).toBe("legacy-with-user");
    expect(totalCount).toBe(1);
  });

  it("clears pending actions for only the specified user", async () => {
    await initOfflineDB();
    await addPendingAction("CREATE_TASK", { task_text: "A" }, "user-a");
    await addPendingAction("CREATE_TASK", { task_text: "B" }, "user-b");

    await clearAllPendingActions("user-a");

    expect(await getPendingActionCount("user-a")).toBe(0);
    expect(await getPendingActionCount("user-b")).toBe(1);
  });
});
