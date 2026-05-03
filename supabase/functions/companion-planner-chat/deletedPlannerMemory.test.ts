import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  collectAllowedPlannerTitles,
  sanitizeConversationHistoryForDeletedPlannerEntities,
} from "./deletedPlannerMemory.ts";
import type { PlannerBuildInput } from "./planner.ts";

Deno.test("deleted planner memory redacts stale conversation text before prompt builders", () => {
  const plannerContext = {
    tasks: [{
      id: "task-live",
      title: "Current launch review",
      taskDate: "2026-05-03",
      scheduledTime: null,
      estimatedDuration: null,
      recurrencePattern: null,
      epicId: "epic-live",
      epicTitle: "Launch Sprint",
    }],
    inboxTasks: [],
    recentCompletedTasks: [],
    activeEpics: [{
      id: "epic-live",
      title: "Launch Sprint",
      endDate: "2026-06-15",
    }],
    rituals: [],
    calendarEvents: [],
  } as PlannerBuildInput["plannerContext"];

  const history = sanitizeConversationHistoryForDeletedPlannerEntities(
    [{
      role: "user",
      content: "Bring back Call the vendor from Launch Sprint.",
    }],
    [{
      entityType: "campaign",
      entityId: "epic-deleted",
      title: "Launch Sprint",
    }, {
      entityType: "task",
      entityId: "task-deleted",
      title: "Call the vendor",
    }],
    collectAllowedPlannerTitles(plannerContext),
  );

  assertStringIncludes(history[0].content, "Launch Sprint");
  assertEquals(history[0].content.includes("Call the vendor"), false);
});
