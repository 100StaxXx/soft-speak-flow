import {
  assertEquals,
  assertGreater,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { consultPlannerForAgent } from "./plannerBridge.ts";
import type { LoadedCompanionAgentContext } from "./types.ts";

const buildContext = (
  overrides: Partial<LoadedCompanionAgentContext> = {},
): LoadedCompanionAgentContext => ({
  thread: null,
  messages: [],
  tasks: [],
  recentCompletedTasks: [],
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

Deno.test("consultPlannerForAgent includes due campaign rituals in coming up reads", () => {
  const result = consultPlannerForAgent({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    surface: "journeys",
    horizon: "day",
    starterIntent: "upcoming_start",
    context: buildContext({
      currentDateTime: "2026-04-18T10:30:00-07:00",
      campaigns: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          end_date: "2026-05-01",
          progress_percentage: 25,
        },
      ],
      rituals: [
        {
          id: "ritual-focus",
          epic_id: "epic-launch",
          epic_title: "Launch campaign",
          title: "Campaign focus ritual",
          frequency: "daily",
          preferred_time: "12:00",
          estimated_minutes: 20,
          custom_days: null,
          custom_month_days: null,
        },
      ],
    }),
  });

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.reply.includes("Campaign focus ritual"), true);
  assertEquals(
    result.structuredResponse?.comingUp?.remainingToday.some((item) =>
      item.title === "Campaign focus ritual" && item.source === "ritual"
    ),
    true,
  );
});

Deno.test("consultPlannerForAgent includes active standalone rituals due tomorrow in coming up reads", () => {
  const result = consultPlannerForAgent({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T20:32:00-07:00",
    surface: "journeys",
    horizon: "day",
    starterIntent: "upcoming_start",
    context: buildContext({
      currentDateTime: "2026-04-18T20:32:00-07:00",
      rituals: [
        {
          id: "ritual-standalone",
          title: "Morning standalone ritual",
          frequency: "daily",
          preferred_time: "08:00",
          estimated_minutes: 20,
          custom_days: null,
          custom_month_days: null,
        },
      ],
    }),
  });

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.reply.includes("Tomorrow: nothing scheduled."), false);
  assertMatch(result.reply, /Morning standalone ritual/);
  assertEquals(
    result.structuredResponse?.comingUp?.tomorrowSchedule?.some((item) =>
      item.title === "Morning standalone ritual" && item.source === "ritual"
    ),
    true,
  );
});

Deno.test("consultPlannerForAgent uses selected date for coming up schedule reads", () => {
  const result = consultPlannerForAgent({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    selectedDate: "2026-04-21",
    surface: "journeys",
    horizon: "day",
    starterIntent: "upcoming_start",
    context: buildContext({
      currentDateTime: "2026-04-18T10:30:00-07:00",
      campaigns: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          end_date: "2026-05-01",
          progress_percentage: 25,
        },
      ],
      rituals: [
        {
          id: "ritual-tuesday",
          epic_id: "epic-launch",
          epic_title: "Launch campaign",
          title: "Tuesday campaign ritual",
          frequency: "weekly",
          preferred_time: "09:00",
          estimated_minutes: 20,
          custom_days: [1],
          custom_month_days: null,
        },
      ],
    }),
  });

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.scheduleInsights.selectedDate, "2026-04-21");
  assertEquals(result.reply.includes("Tuesday campaign ritual"), true);
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

Deno.test("consultPlannerForAgent drafts concrete quest-capture starter text immediately", () => {
  const result = consultPlannerForAgent({
    message: "Pilates tomorrow at 8am",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    starterIntent: "quest_capture",
    context: buildContext(),
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.reply.includes("Quest?"), false);
  assertEquals(result.actionHints[0]?.actionType, "task_create");
  assertEquals(result.actionHints[0]?.normalizedPayload?.title, "Pilates");
});

Deno.test("consultPlannerForAgent drafts Gym at 6 from quest capture", () => {
  const result = consultPlannerForAgent({
    message: "Gym at 6",
    currentDateTime: "2026-05-03T21:08:00-07:00",
    surface: "journeys",
    horizon: "day",
    starterIntent: "quest_capture",
    context: buildContext({
      visibleDateStart: "2026-05-03",
      visibleDateEnd: "2026-05-09",
      currentDateTime: "2026-05-03T21:08:00-07:00",
    }),
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.actionHints[0]?.actionType, "task_create");
  assertEquals(result.actionHints[0]?.normalizedPayload?.title, "Gym");
  assertEquals(
    result.actionHints[0]?.normalizedPayload?.scheduled_time,
    "18:00",
  );
});

Deno.test("consultPlannerForAgent preserves selected date for quest-capture replies", () => {
  const consultSelectedDatePlanner = (message: string) =>
    consultPlannerForAgent({
      message,
      currentDateTime: "2026-04-18T08:00:00-07:00",
      selectedDate: "2026-04-21",
      surface: "journeys",
      horizon: "day",
      starterIntent: "quest_capture",
      context: buildContext(),
    });

  const result = consultSelectedDatePlanner("Pilates at 8am");
  assertEquals(result.mode, "proposal");
  assertEquals(result.scheduleInsights.selectedDate, "2026-04-21");
  assertEquals(result.actionHints[0]?.actionType, "task_create");
  assertEquals(result.actionHints[0]?.normalizedPayload?.title, "Pilates");
  assertEquals(
    result.actionHints[0]?.normalizedPayload?.task_date,
    "2026-04-21",
  );
  assertEquals(
    result.actionHints[0]?.normalizedPayload?.scheduled_time,
    "08:00",
  );

  const tomorrowResult = consultSelectedDatePlanner("Pilates tomorrow at 8am");
  assertEquals(
    tomorrowResult.actionHints[0]?.normalizedPayload?.task_date,
    "2026-04-22",
  );

  const todayResult = consultSelectedDatePlanner("Pilates today at 8am");
  assertEquals(
    todayResult.actionHints[0]?.normalizedPayload?.task_date,
    "2026-04-21",
  );
});

Deno.test("consultPlannerForAgent uses actual completed time for learned quest duration", () => {
  const result = consultPlannerForAgent({
    message: "Workout tomorrow",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    context: buildContext({
      recentCompletedTasks: [
        {
          id: "task-history-1",
          task_text: "Workout",
          task_date: "2026-04-16",
          scheduled_time: "17:00",
          estimated_duration: 30,
          actual_duration_minutes: 60,
          actual_time_spent: 75,
          completed: true,
          completed_at: "2026-04-16T18:00:00.000Z",
          category: "body",
        },
      ],
    }),
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.actionHints[0]?.actionType, "task_create");
  assertEquals(
    result.actionHints[0]?.normalizedPayload?.estimated_duration,
    60,
  );
});

Deno.test("consultPlannerForAgent applies onboarding schedule defaults to primary planning", () => {
  const result = consultPlannerForAgent({
    message: "Plan my day",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "companion",
    horizon: "day",
    starterIntent: "plan_day",
    context: buildContext({
      recentMemory: {
        profile_onboarding: {
          scheduleArchetype: "after_work_builder",
        },
      },
    }),
  });

  assertEquals(result.scheduleInsights.suggestedSlots[0]?.time, "19:00");
  assertMatch(
    result.scheduleInsights.suggestedSlots[0]?.reason ?? "",
    /after work|evening/i,
  );
});

Deno.test("consultPlannerForAgent asks a clarifying plan-day question with no anchors", () => {
  const result = consultPlannerForAgent({
    message: "Plan my day",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "day",
    starterIntent: "plan_day",
    context: buildContext(),
  });

  assertEquals(result.mode, "conversational");
  assertEquals(result.actionHints.length, 0);
  assertEquals(result.questions.length, 1);
  assertMatch(result.reply, /what kind of day/i);
});

Deno.test("consultPlannerForAgent turns contextual plan_day briefing into triage", () => {
  const result = consultPlannerForAgent({
    message: "Plan my day",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    selectedDate: "2026-04-18",
    surface: "journeys",
    starterIntent: "plan_day",
    briefingContext: {
      content:
        "Planning snapshot for Saturday, April 18: 3 open quests, 1 rituals, 1 active campaigns",
      dataSnapshot: {
        selectedDate: "2026-04-18",
        ritualQuestCount: 1,
        activeCampaignTitles: ["Launch campaign"],
      },
    },
    context: buildContext({
      currentDateTime: "2026-04-18T10:30:00-07:00",
      campaigns: [
        {
          id: "epic-launch",
          title: "Launch campaign",
          status: "active",
          end_date: "2026-05-01",
          progress_percentage: 30,
        },
      ],
      rituals: [
        {
          id: "ritual-focus",
          epic_id: "epic-launch",
          epic_title: "Launch campaign",
          title: "Campaign focus ritual",
          frequency: "daily",
          preferred_time: "09:00",
          estimated_minutes: 20,
          custom_days: null,
          custom_month_days: null,
        },
      ],
      tasks: [
        {
          id: "missed-task",
          task_text: "Missed admin",
          task_date: "2026-04-18",
          scheduled_time: "08:00",
          estimated_duration: 20,
          completed: false,
        },
        {
          id: "ritual-task",
          task_text: "Campaign focus ritual",
          task_date: "2026-04-18",
          scheduled_time: "09:00",
          estimated_duration: 20,
          completed: false,
          epic_id: "epic-launch",
          habit_source_id: "ritual-focus",
        },
        {
          id: "campaign-task",
          task_text: "Draft launch notes",
          task_date: "2026-04-18",
          scheduled_time: null,
          estimated_duration: 45,
          completed: false,
          epic_id: "epic-launch",
          priority: "high",
        },
      ],
    }),
  });

  assertEquals(result.questions.length, 0);
  assertEquals(result.reply.includes("focus, recovery, or catching up"), false);
  assertMatch(result.reply, /Missed or slipped quests/i);
  assertMatch(result.reply, /Campaign work to protect/i);
  assertMatch(result.reply, /Rituals due or linked today/i);
  assertMatch(result.reply, /Protected priorities/i);
  assertEquals(result.structuredResponse?.planDay?.campaignFocus?.campaignTitle, "Launch campaign");
});

Deno.test("consultPlannerForAgent ignores abandoned campaigns with null completed_at", () => {
  const result = consultPlannerForAgent({
    message: "Focus",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "day",
    context: buildContext({
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Plan my day",
          created_at: "2026-04-18T15:00:00.000Z",
          input_mode: "text",
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "What are you feeling like focusing on this morning?",
          created_at: "2026-04-18T15:00:01.000Z",
          input_mode: null,
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
      ],
      tasks: [
        {
          id: "task-stale-campaign",
          task_text: "Review old training plan",
          task_date: "2026-04-18",
          scheduled_time: null,
          estimated_duration: 45,
          completed: false,
          epic_id: "epic-abandoned",
        },
      ],
      campaigns: [
        {
          id: "epic-abandoned",
          title: "Ghost campaign",
          status: "abandoned",
          completed_at: null,
          end_date: "2026-05-01",
          progress_percentage: 10,
        },
      ],
    }),
  });

  assertEquals(result.structuredResponse?.planDay?.campaignFocus, null);
  assertEquals(result.reply.includes("Ghost campaign"), false);
  assertEquals(result.reply.includes("campaign drawer"), false);
});

Deno.test("consultPlannerForAgent treats a concrete plan-day reply as quest consent, not a draft", () => {
  const result = consultPlannerForAgent({
    message: "Work on my app",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "day",
    context: buildContext({
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Plan my day",
          created_at: "2026-04-18T15:00:00.000Z",
          input_mode: "text",
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
        {
          id: "msg-2",
          role: "assistant",
          content:
            "What kind of day are we making: focused, light, catch-up, or something else?",
          created_at: "2026-04-18T15:00:01.000Z",
          input_mode: null,
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
      ],
    }),
  });

  assertEquals(result.mode, "conversational");
  assertEquals(result.actionHints.length, 0);
  assertEquals(result.questions.length, 1);
  assertEquals(result.questions[0]?.id, "plan_day_quest_consent");
  assertMatch(result.reply, /form a quest/i);
});

Deno.test("consultPlannerForAgent keeps clean room read-only after plan-day clarification", () => {
  const result = consultPlannerForAgent({
    message: "clean room",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "day",
    context: buildContext({
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Plan my day",
          created_at: "2026-04-18T15:00:00.000Z",
          input_mode: "text",
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
        {
          id: "msg-2",
          role: "assistant",
          content:
            "What kind of day are we making: focused, light, catch-up, or something else?",
          created_at: "2026-04-18T15:00:01.000Z",
          input_mode: null,
          source: "agent",
          surface: "journeys",
          session_id: "session-1",
        },
      ],
    }),
  });

  assertEquals(result.mode, "conversational");
  assertEquals(result.actionHints.length, 0);
  assertEquals(result.questions.length, 1);
  assertEquals(result.questions[0]?.id, "plan_day_quest_consent");
  assertMatch(result.reply, /Clean Room/i);
});

Deno.test("consultPlannerForAgent converts at-risk campaign adjustments into campaign action hints", () => {
  const context = buildContext({
    tasks: [
      {
        id: "task-1",
        task_text: "Rewrite relaunch offer",
        task_date: "2026-04-16",
        scheduled_time: null,
        estimated_duration: 60,
        completed: false,
        epic_id: "epic-1",
        priority: "high",
      },
      {
        id: "task-2",
        task_text: "Tighten launch CTA",
        task_date: "2026-04-17",
        scheduled_time: null,
        estimated_duration: 45,
        completed: false,
        epic_id: "epic-1",
        priority: "medium",
      },
    ],
    campaigns: [
      {
        id: "epic-1",
        title: "Founder relaunch",
        end_date: "2026-04-21",
        progress_percentage: 22,
      },
    ],
  });
  const initial = consultPlannerForAgent({
    message: "Advance my campaign",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    starterIntent: "advance_campaign_start",
    context,
  });
  const result = consultPlannerForAgent({
    message: "Yes",
    currentDateTime: "2026-04-18T08:00:00-07:00",
    surface: "journeys",
    horizon: "week",
    starterIntent: "advance_campaign_start",
    activeFollowUp: {
      question: initial.questions[0]?.prompt ?? "",
      reason: initial.questions[0]?.reason ?? null,
      expectedAnswerType: "confirmation",
      options: ["Yes", "No"],
      blocksDrafting: true,
      metadata: initial.questions[0]?.metadata,
    },
    context,
  });

  assertEquals(initial.mode, "conversational");
  assertEquals(initial.actionHints.length, 0);
  assertEquals(initial.questions[0]?.id, "planning_launcher_consent");
  assertEquals(result.mode, "proposal");
  assertGreater(result.actionHints.length, 0);
  assertEquals(result.actionHints[0]?.actionType, "campaign_adjust");
});
