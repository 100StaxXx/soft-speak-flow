import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAssistantTaskScheduleLabel,
  classifyTaskTemporalStatus,
  formatAssistantTime,
  normalizeAssistantTimeText,
} from "./assistantScheduleCopy.ts";

Deno.test("formatAssistantTime renders lowercase am/pm labels", () => {
  assertEquals(formatAssistantTime("09:00"), "9:00 am");
  assertEquals(formatAssistantTime("18:30"), "6:30 pm");
});

Deno.test("classifyTaskTemporalStatus distinguishes past, in-progress, and upcoming tasks", () => {
  assertEquals(
    classifyTaskTemporalStatus({
      taskDate: "2026-04-19",
      scheduledTime: "09:00",
      estimatedDuration: 30,
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:28:00-07:00",
    }),
    "past",
  );

  assertEquals(
    classifyTaskTemporalStatus({
      taskDate: "2026-04-19",
      scheduledTime: "10:00",
      estimatedDuration: 60,
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:28:00-07:00",
    }),
    "in_progress",
  );

  assertEquals(
    classifyTaskTemporalStatus({
      taskDate: "2026-04-20",
      scheduledTime: "09:00",
      estimatedDuration: 30,
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:28:00-07:00",
    }),
    "upcoming",
  );
});

Deno.test("buildAssistantTaskScheduleLabel uses tense-aware schedule phrasing", () => {
  assertEquals(
    buildAssistantTaskScheduleLabel({
      title: "License study",
      taskDate: "2026-04-19",
      scheduledTime: "09:00",
      estimatedDuration: 30,
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:28:00-07:00",
    }),
    "License study (was at 9:00 am)",
  );

  assertEquals(
    buildAssistantTaskScheduleLabel({
      title: "Room cleanup",
      taskDate: "2026-04-19",
      scheduledTime: "18:40",
      estimatedDuration: 20,
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:28:00-07:00",
    }),
    "Room cleanup (at 6:40 pm)",
  );
});

Deno.test("normalizeAssistantTimeText rewrites 24-hour tokens for assistant copy", () => {
  assertEquals(
    normalizeAssistantTimeText("Today has room at 09:00 and 18:00."),
    "Today has room at 9:00 am and 6:00 pm.",
  );
  assertEquals(
    normalizeAssistantTimeText("Try 15:00-16:30, or circle back at 21:05."),
    "Try 3:00 pm-4:30 pm, or circle back at 9:05 pm.",
  );
  assertEquals(
    normalizeAssistantTimeText("You already planned 9:00 am and 6:00 pm."),
    "You already planned 9:00 am and 6:00 pm.",
  );
});
