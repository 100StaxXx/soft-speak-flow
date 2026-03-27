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
});
