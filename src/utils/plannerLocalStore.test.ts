import { afterEach, describe, expect, it, vi } from "vitest";
import { createIndexedDbReconnectMock } from "@/test/indexedDbReconnectMock";

const originalIndexedDb = globalThis.indexedDB;

const installIndexedDb = (throwOnTransactionCall: number) => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: createIndexedDbReconnectMock([
      { throwOnTransactionCall },
      {},
    ]),
  });
};

afterEach(() => {
  vi.resetModules();

  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: originalIndexedDb,
  });
});

describe("plannerLocalStore reconnect handling", () => {
  it("reopens and retries a write when the cached database starts closing", async () => {
    installIndexedDb(2);
    const plannerLocalStore = await import("./plannerLocalStore");

    await plannerLocalStore.upsertPlannerRecord("daily_tasks", {
      id: "task-1",
      user_id: "user-1",
      task_date: "2026-03-27",
      task_text: "Write retry",
    });

    const stored = await plannerLocalStore.getPlannerRecord<{
      id: string;
      task_text: string;
    }>("daily_tasks", "task-1");

    expect(stored).toEqual(expect.objectContaining({
      id: "task-1",
      task_text: "Write retry",
    }));
  });

  it("reopens and retries a read when the cached database starts closing", async () => {
    installIndexedDb(3);
    const plannerLocalStore = await import("./plannerLocalStore");

    await plannerLocalStore.upsertPlannerRecord("daily_tasks", {
      id: "task-2",
      user_id: "user-1",
      task_date: "2026-03-27",
      task_text: "Read retry",
    });

    const stored = await plannerLocalStore.getPlannerRecord<{
      id: string;
      task_text: string;
    }>("daily_tasks", "task-2");

    expect(stored).toEqual(expect.objectContaining({
      id: "task-2",
      task_text: "Read retry",
    }));
  });

  it("keeps only one canonical ritual instance per habit/date when replacing local tasks", async () => {
    installIndexedDb(999);
    const plannerLocalStore = await import("./plannerLocalStore");

    const duplicateA = {
      id: "task-dup-a",
      user_id: "user-1",
      task_date: "2026-03-29",
      task_text: "Daily Marketing Review",
      habit_source_id: "habit-campaign",
      completed: false,
      completed_at: null,
      created_at: "2026-03-29T08:00:00.000Z",
      sort_order: 1,
    };
    const duplicateB = {
      id: "task-dup-b",
      user_id: "user-1",
      task_date: "2026-03-29",
      task_text: "Daily Marketing Review",
      habit_source_id: "habit-campaign",
      completed: true,
      completed_at: "2026-03-29T09:00:00.000Z",
      created_at: "2026-03-29T09:00:00.000Z",
      sort_order: 1,
    };

    await plannerLocalStore.upsertPlannerRecord("daily_tasks", duplicateA);
    await plannerLocalStore.upsertPlannerRecord("daily_tasks", duplicateB);

    await plannerLocalStore.replaceLocalTasksForDate("user-1", "2026-03-29", [
      duplicateA,
      duplicateB,
    ]);

    const stored = await plannerLocalStore.getLocalTasksByDate<typeof duplicateA>("user-1", "2026-03-29");

    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(expect.objectContaining({
      id: "task-dup-b",
      habit_source_id: "habit-campaign",
      completed: true,
    }));
  });

  it("dedupes duplicate ritual instances when reading tasks by date", async () => {
    installIndexedDb(999);
    const plannerLocalStore = await import("./plannerLocalStore");

    const duplicateA = {
      id: "task-read-a",
      user_id: "user-1",
      task_date: "2026-03-29",
      task_text: "Monthly Review and Adjust",
      habit_source_id: "habit-review",
      completed: false,
      completed_at: null,
      created_at: "2026-03-29T08:00:00.000Z",
      sort_order: 2,
    };
    const duplicateB = {
      id: "task-read-b",
      user_id: "user-1",
      task_date: "2026-03-29",
      task_text: "Monthly Review and Adjust",
      habit_source_id: "habit-review",
      completed: false,
      completed_at: null,
      created_at: "2026-03-29T09:00:00.000Z",
      sort_order: 2,
    };

    const deduped = plannerLocalStore.dedupePlannerTasksByInstance([
      duplicateA,
      duplicateB,
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]).toEqual(expect.objectContaining({
      id: "task-read-b",
      habit_source_id: "habit-review",
    }));
  });
});
