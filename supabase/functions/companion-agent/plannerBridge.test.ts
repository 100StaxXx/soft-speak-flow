import {
  assertEquals,
  assertGreater,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { consultPlannerForAgent, mapPlannerProposal } from "./plannerBridge.ts";
import type { LoadedCompanionAgentContext } from "./types.ts";

const buildContext = (
  overrides: Partial<LoadedCompanionAgentContext> = {},
): LoadedCompanionAgentContext => ({
  thread: null,
  messages: [],
  tasks: [],
  rituals: [],
  campaigns: [],
  calendarEvents: [],
  reminders: [],
  goals: [],
  recentMemory: {},
  reflections: [],
  activePendingAction: null,
  companionMode: "alpha",
  companionModeAdaptationEnabled: true,
  visibleDateStart: "2026-04-18",
  visibleDateEnd: "2026-04-24",
  currentDateTime: "2026-04-18T08:00:00-07:00",
  timezone: "-07:00",
  ...overrides,
});

Deno.test("consultPlannerForAgent returns a schedule read for schedule questions", () => {
  const result = consultPlannerForAgent({
    message: "What's on tomorrow?",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Workout",
          task_date: "2026-04-19",
          scheduled_time: "07:00",
          estimated_duration: 45,
          completed: false,
          reminder_enabled: true,
          reminder_minutes_before: 10,
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          title: "Team sync",
          start_time: "2026-04-19T10:00:00-07:00",
          end_time: "2026-04-19T10:30:00-07:00",
          is_all_day: false,
          source: "google",
        },
      ],
    }),
  });

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.actionHints.length, 0);
  assertMatch(result.reply, /tomorrow/i);
});

Deno.test("consultPlannerForAgent converts planner proposals into v1 task action hints", () => {
  const result = consultPlannerForAgent({
    message: "Move my workout to tomorrow at 7am",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      tasks: [
        {
          id: "task-1",
          task_text: "Workout",
          task_date: "2026-04-18",
          scheduled_time: "09:00",
          estimated_duration: 45,
          completed: false,
        },
      ],
    }),
  });

  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "task_update");
});

Deno.test("consultPlannerForAgent exposes campaign creation as a supported pending action", () => {
  const result = consultPlannerForAgent({
    message: "I want to get my real estate license",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext(),
  });

  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "campaign_create");
  assertEquals(
    typeof result.actionHints[0]?.normalizedPayload?.title,
    "string",
  );
});

Deno.test("consultPlannerForAgent exposes ritual updates as supported pending actions", () => {
  const result = consultPlannerForAgent({
    message: "Move my Practice ritual to 7am",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      rituals: [
        {
          id: "ritual-1",
          epic_id: "epic-1",
          epic_title: "Campaign Aurora",
          title: "Practice",
          frequency: "daily",
          preferred_time: "09:00",
        },
      ],
    }),
  });

  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "ritual_update");
  assertEquals(result.actionHints[0]?.normalizedPayload?.habit_id, "ritual-1");
});

Deno.test("consultPlannerForAgent exposes campaign adjustments as supported pending actions", () => {
  const result = consultPlannerForAgent({
    message: "Push Campaign Aurora out by 2 weeks",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      campaigns: [{
        id: "epic-1",
        title: "Campaign Aurora",
        end_date: "2026-06-01",
      }],
    }),
  });

  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "campaign_adjust");
  assertEquals(result.actionHints[0]?.normalizedPayload?.campaign_id, "epic-1");
});

Deno.test("mapPlannerProposal preserves rich create quest payload fields for companion-agent actions", () => {
  const result = mapPlannerProposal({
    id: "proposal-1",
    kind: "create_quest",
    title: "Create Focus Sprint",
    summary: "Draft a focused sprint quest.",
    payload: {
      taskText: "Focus Sprint",
      taskDate: "2026-04-23",
      scheduledTime: "09:00",
      difficulty: "hard",
      estimatedDuration: 90,
      recurrencePattern: "custom",
      recurrenceDays: [0, 2, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: "week",
      recurrenceEndDate: "2026-05-23",
      notes: "Protect the block",
      location: "Studio",
      category: "mind",
      priority: "high",
      contactId: "contact-1",
      autoLogInteraction: false,
      imageUrl: "https://cdn.example.com/focus.png",
      questSource: "manual",
      subtasks: ["Warm up", "Ship draft"],
      reminderEnabled: true,
      reminderMinutesBefore: 20,
      epicId: "epic-1",
    },
  } as any);

  assertEquals(result.actionType, "task_create");
  assertEquals(result.normalizedPayload?.difficulty, "hard");
  assertEquals(result.normalizedPayload?.recurrence_pattern, "custom");
  assertEquals(result.normalizedPayload?.recurrence_days, [0, 2, 4]);
  assertEquals(result.normalizedPayload?.recurrence_custom_period, "week");
  assertEquals(result.normalizedPayload?.category, "mind");
  assertEquals(result.normalizedPayload?.contact_id, "contact-1");
  assertEquals(result.normalizedPayload?.auto_log_interaction, false);
  assertEquals(result.normalizedPayload?.subtasks, ["Warm up", "Ship draft"]);
  assertEquals(result.normalizedPayload?.source, "manual");
});

Deno.test("mapPlannerProposal preserves ritual schedule metadata for companion-agent creation", () => {
  const result = mapPlannerProposal({
    id: "proposal-2",
    kind: "create_ritual",
    title: "Add Writing Ritual",
    summary: "Draft a writing ritual.",
    payload: {
      title: "Writing Ritual",
      frequency: "custom",
      difficulty: "hard",
      preferredTime: "07:30",
      estimatedMinutes: 25,
      description: "Daily pages",
      category: "mind",
      customDays: [0, 2, 4],
      customMonthDays: [],
      epicId: "epic-1",
      reminderEnabled: true,
      reminderMinutesBefore: 15,
    },
  } as any);

  assertEquals(result.actionType, "ritual_create");
  assertEquals(result.normalizedPayload?.difficulty, "hard");
  assertEquals(result.normalizedPayload?.custom_days, [0, 2, 4]);
  assertEquals(result.normalizedPayload?.custom_month_days, []);
  assertEquals(result.normalizedPayload?.preferred_time, "07:30");
});
