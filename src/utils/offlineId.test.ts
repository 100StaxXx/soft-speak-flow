import { describe, expect, it } from "vitest";

import { createOfflinePlannerId } from "@/utils/plannerLocalStore";

import { normalizeUuidFields, normalizeUuidLikeId } from "./offlineId";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("offlineId helpers", () => {
  it("strips legacy prefixes from UUID-backed IDs", () => {
    expect(normalizeUuidLikeId("task-e47e5651-7522-4888-a04d-6eff518fa4ba")).toBe("e47e5651-7522-4888-a04d-6eff518fa4ba");
    expect(normalizeUuidLikeId("subtask-2F96D0D4-0B3D-4C91-8A11-0C685B392253")).toBe("2f96d0d4-0b3d-4c91-8a11-0c685b392253");
  });

  it("leaves non-UUID IDs unchanged", () => {
    expect(normalizeUuidLikeId("task-local")).toBe("task-local");
    expect(normalizeUuidLikeId("task-123")).toBe("task-123");
  });

  it("normalizes nested UUID-like fields without touching other strings", () => {
    expect(normalizeUuidFields({
      id: "task-e47e5651-7522-4888-a04d-6eff518fa4ba",
      taskId: "task-e47e5651-7522-4888-a04d-6eff518fa4ba",
      title: "Keep prefix text",
      subtasks: [
        {
          id: "subtask-2f96d0d4-0b3d-4c91-8a11-0c685b392253",
          task_id: "task-e47e5651-7522-4888-a04d-6eff518fa4ba",
        },
      ],
    })).toEqual({
      id: "e47e5651-7522-4888-a04d-6eff518fa4ba",
      taskId: "e47e5651-7522-4888-a04d-6eff518fa4ba",
      title: "Keep prefix text",
      subtasks: [
        {
          id: "2f96d0d4-0b3d-4c91-8a11-0c685b392253",
          task_id: "e47e5651-7522-4888-a04d-6eff518fa4ba",
        },
      ],
    });
  });

  it("generates server-compatible offline planner IDs", () => {
    expect(createOfflinePlannerId("task")).toMatch(UUID_PATTERN);
    expect(createOfflinePlannerId("habit")).toMatch(UUID_PATTERN);
  });
});
