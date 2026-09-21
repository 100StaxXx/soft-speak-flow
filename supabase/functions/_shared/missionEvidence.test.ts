import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildMissionEvidenceContext,
  NO_VERIFIED_MISSION_EVIDENCE,
} from "./missionEvidence.ts";

Deno.test("mission evidence includes only completed mission threads", () => {
  const context = buildMissionEvidenceContext({
    missionThreads: [
      {
        mission_date: "2026-08-10",
        intention_label: "Finish something",
        primary_task_title: " Send   launch notes ",
        status: "completed",
        reflection_label: "It cleared some space",
      },
      {
        mission_date: "2026-08-11",
        intention_label: "Make progress",
        primary_task_title: "Unfinished plan",
        status: "active",
      },
    ],
  });

  assertMatch(context, /Send launch notes/);
  assertMatch(context, /user reflection: It cleared some space/);
  assertEquals(context.includes("Unfinished plan"), false);
});

Deno.test("mission evidence deduplicates matching quest completion", () => {
  const context = buildMissionEvidenceContext({
    missionThreads: [{
      mission_date: "2026-08-10",
      intention_label: "Finish something",
      primary_task_title: "Ship the build",
      status: "reflected",
    }],
    completedTasks: [
      { task_text: "Ship the build", task_date: "2026-08-10" },
      { task_text: "Write release notes", task_date: "2026-08-10", actual_time_spent: 25 },
    ],
  });

  assertEquals(context.match(/Ship the build/g)?.length, 1);
  assertMatch(context, /25 minutes logged/);
});

Deno.test("mission evidence forbids invention when no verified events exist", () => {
  assertEquals(buildMissionEvidenceContext({}), NO_VERIFIED_MISSION_EVIDENCE);
});
