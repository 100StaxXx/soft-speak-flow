import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildPlannerResponse,
  collectPlannerContextProtectedDataText,
  normalizePlannerBuildResultText,
  type PlannerBuildResult,
  type PlannerBuildInput,
  synthesizeDayPlanFromProposals,
} from "./planner.ts";
import { buildPlanDayToolUserPrompt } from "./planDayTools.ts";

type PlannerBuildInputOverrides =
  & Partial<
    Omit<
      PlannerBuildInput,
      "plannerContext" | "parsedInput" | "sessionState" | "classificationHint"
    >
  >
  & {
    plannerContext?: Partial<PlannerBuildInput["plannerContext"]>;
    parsedInput?: Partial<NonNullable<PlannerBuildInput["parsedInput"]>>;
    sessionState?: Partial<PlannerBuildInput["sessionState"]>;
    classificationHint?: Partial<
      NonNullable<PlannerBuildInput["classificationHint"]>
    >;
  };

const baseInput = (
  overrides: PlannerBuildInputOverrides = {},
): PlannerBuildInput => {
  const defaultSessionState: PlannerBuildInput["sessionState"] = {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    pendingStarterIntent: null,
    lastClassification: null,
  };

  const defaultParsedInput: NonNullable<PlannerBuildInput["parsedInput"]> = {
    text: "Call mom",
    scheduledTime: null,
    scheduledDate: null,
    estimatedDuration: null,
    recurrencePattern: null,
    recurrenceDays: [],
    recurrenceMonthDays: [],
    recurrenceCustomPeriod: null,
    recurrenceEndDate: null,
    notes: null,
    category: null,
    newTitle: null,
  };

  const defaultPlannerContext: PlannerBuildInput["plannerContext"] = {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
    aiSignals: {
      preferredDifficulty: "medium",
      preferredHabitFrequency: "daily",
      preferredEpicDuration: 45,
      suggestedWorkload: "normal",
      commonContexts: [],
    },
  };

  return {
    message: overrides.message ?? "Call mom",
    currentDate: overrides.currentDate ?? "2026-04-18",
    currentDateTime: overrides.currentDateTime ?? "2026-04-18T10:30:00-07:00",
    horizon: overrides.horizon ?? "day",
    tonePack: overrides.tonePack ?? "soft",
    conversationHistory: overrides.conversationHistory ?? [],
    sessionState: {
      ...defaultSessionState,
      ...(overrides.sessionState ?? {}),
    },
    parsedInput: {
      ...defaultParsedInput,
      ...(overrides.parsedInput ?? {}),
    },
    classificationHint: {
      type: "quest",
      confidence: 0.92,
      reasoning: "One-off task",
      ...(overrides.classificationHint ?? {}),
    },
    plannerContext: {
      ...defaultPlannerContext,
      ...(overrides.plannerContext ?? {}),
    },
  };
};

Deno.test("normalizes planner prose dash separators while preserving data values", () => {
  const normalized = normalizePlannerBuildResultText({
    mode: "proposal",
    reply:
      'Got it - let\'s use 2026-04-18 and 9:00 am - 10:00 am. "Clean room - closet" stays named.',
    plannerContract: {
      mode: "propose_schedule",
      writePolicy: "confirmation_required",
      decisionSummary: "Draft ready - review it.",
      reasonCodes: ["user_preference"],
      decisionPoint: {
        label: "Review - confirm",
        action: "confirm_schedule",
      },
      clarifyingQuestion: null,
    },
    followUpQuestions: [{
      id: "details",
      field: "details",
      prompt: "Okay - what should change?",
      reason: "A short gap - let's choose carefully.",
      required: true,
    }],
    proposals: [{
      id: "proposal-1",
      kind: "create_quest",
      title: "Clean room - closet",
      summary: "Draft ready - review it.",
      payload: {
        taskDate: "2026-04-18",
        scheduledTime: "09:00",
      },
      status: "pending",
      readyToConfirm: true,
    }],
    suggestedReminders: [],
    structuredResponse: {
      intent: {
        intentType: "quest",
        timeHorizon: "today",
        isRecurring: false,
        shouldCreateQuest: true,
        shouldPromptCampaign: false,
      },
      planDay: {
        message: "Got it - let's use this.",
        dayAssessment: "open",
        suggestedQuests: [{
          suggestionId: "suggestion-1",
          proposalId: "proposal-1",
          title: "Clean room - closet",
          type: "must",
          estimatedDuration: "09:00 - 10:00",
          estimatedDurationMinutes: 60,
          source: "optimization",
          reason: "Open slot - let's use it.",
        }],
        campaignFocus: null,
      },
    },
    dayPlan: {
      id: null,
      date: "2026-04-18",
      status: "draft",
      updatedAt: "2026-04-18T10:00:00.000Z",
      blocks: [{
        id: "block-1",
        proposalId: "proposal-1",
        questId: null,
        title: "Clean room - closet",
        startTime: "09:00",
        durationMinutes: 60,
        energyType: "admin",
        source: "optimization",
        reasoning: "Fits here - let's protect it.",
      }],
    },
    memoryUpdates: {},
    sessionState: {
      draft: {},
      openQuestionIds: [],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: null,
      lastClassification: null,
    },
  } satisfies PlannerBuildResult);

  assertEquals(
    normalized.reply,
    'Got it. Let\'s use 2026-04-18 and 9:00 am - 10:00 am. "Clean room - closet" stays named.',
  );
  assertEquals(
    normalized.followUpQuestions[0]?.prompt,
    "Okay. What should change?",
  );
  assertEquals(
    normalized.followUpQuestions[0]?.reason,
    "A short gap. Let's choose carefully.",
  );
  assertEquals(normalized.proposals[0]?.title, "Clean room - closet");
  assertEquals(normalized.proposals[0]?.summary, "Draft ready. Review it.");
  assertEquals(
    normalized.plannerContract?.decisionSummary,
    "Draft ready. Review it.",
  );
  assertEquals(
    normalized.plannerContract?.decisionPoint.label,
    "Review. Confirm",
  );
  assertEquals(
    normalized.structuredResponse?.planDay?.message,
    normalized.reply,
  );
  assertEquals(
    normalized.structuredResponse?.planDay?.suggestedQuests[0]?.title,
    "Clean room - closet",
  );
  assertEquals(
    normalized.structuredResponse?.planDay?.suggestedQuests[0]
      ?.estimatedDuration,
    "9:00 am - 10:00 am",
  );
  assertEquals(
    normalized.structuredResponse?.planDay?.suggestedQuests[0]?.reason,
    "Open slot. Let's use it.",
  );
  assertEquals(normalized.dayPlan?.blocks[0]?.title, "Clean room - closet");
  assertEquals(
    normalized.dayPlan?.blocks[0]?.reasoning,
    "Fits here. Let's protect it.",
  );
});

const confirmedPlanningConsent = (
  sourceStarterIntent: NonNullable<
    PlannerBuildInput["plannerContext"]["starterIntent"]
  >,
  sourceMessage: string,
): Partial<PlannerBuildInput["sessionState"]> => ({
  planningConsent: {
    kind: "planner_changes",
    sourceStarterIntent,
    sourceMessage,
    confirmed: true,
  },
});

const plannerTask = (
  overrides: Partial<PlannerBuildInput["plannerContext"]["tasks"][number]> & {
    id: string;
    title: string;
  },
): PlannerBuildInput["plannerContext"]["tasks"][number] => ({
  id: overrides.id,
  title: overrides.title,
  taskDate: overrides.taskDate ?? null,
  category: overrides.category ?? null,
  scheduledTime: overrides.scheduledTime ?? null,
  estimatedDuration: overrides.estimatedDuration ?? null,
  recurrencePattern: overrides.recurrencePattern ?? null,
  completed: overrides.completed ?? false,
  source: overrides.source ?? null,
  habitSourceId: overrides.habitSourceId ?? null,
  epicId: overrides.epicId ?? null,
  epicTitle: overrides.epicTitle ?? null,
});

const plannerStatInterpretation = (
  momentumState: NonNullable<
    PlannerBuildInput["plannerContext"]["statInterpretation"]
  >["momentumState"],
): NonNullable<PlannerBuildInput["plannerContext"]["statInterpretation"]> => ({
  statProfile: {
    scores: {
      vitality: 450,
      wisdom: 480,
      discipline: 520,
      resolve: 470,
      creativity: 410,
      alignment: 465,
    },
    dominantStat: "discipline",
    secondaryStat: "wisdom",
  },
  statNeeds: {
    vitality: { level: "low", reasons: [] },
    wisdom: { level: "low", reasons: [] },
    discipline: { level: "low", reasons: [] },
    resolve: { level: "low", reasons: [] },
    creativity: { level: "low", reasons: [] },
    alignment: { level: "low", reasons: [] },
  },
  momentumState,
  recentMissInterpretation: "normal_variance",
  narrativeBrief: "You're in a solid rhythm.",
  dailyNarrative: "Locked-in day",
});

const campaignFollowUpContext = (
  starterIntent: NonNullable<
    PlannerBuildInput["plannerContext"]["starterIntent"]
  >,
): Partial<PlannerBuildInput["plannerContext"]> => ({
  starterIntent,
  activeEpics: [
    {
      id: "epic-consent-1",
      title: "Podcast launch",
      endDate: "2026-05-06",
      progressPercentage: 52,
      daysRemaining: 18,
    },
  ],
  tasks: [],
  recentCompletedTasks: [
    {
      id: "task-consent-done-1",
      title: "Pick launch artwork",
      taskDate: "2026-04-17",
      scheduledTime: "11:00",
      estimatedDuration: 30,
      recurrencePattern: null,
      completed: true,
      completedAt: "2026-04-17T18:00:00.000Z",
      priority: "medium",
      epicId: "epic-consent-1",
      epicTitle: "Podcast launch",
    },
  ],
  priorityScores: [
    {
      id: "epic:epic-consent-1",
      kind: "epic",
      title: "Podcast launch",
      score: 82,
      reasons: [
        "This campaign has momentum, but the next move is still undefined.",
      ],
      epicId: "epic-consent-1",
    },
  ],
  scheduleInsights: {
    horizon: "day",
    selectedDate: "2026-04-18",
    dayLoads: [
      {
        date: "2026-04-18",
        totalMinutes: 0,
        taskCount: 0,
        status: "open",
      },
    ],
    overloadedDates: [],
    emptyDates: ["2026-04-18"],
    conflicts: [],
    suggestedSlots: [
      {
        date: "2026-04-18",
        time: "11:00",
        endTime: "11:30",
        score: 88,
        reason: "Open slot for a clean follow-up move.",
      },
    ],
    moveSuggestions: [],
    summary: "Today has room for one follow-up move.",
  },
});

Deno.test("planning launchers require consent before proposal cards", () => {
  const cases: Array<{
    name: string;
    message: string;
    horizon?: PlannerBuildInput["horizon"];
    plannerContext: Partial<PlannerBuildInput["plannerContext"]>;
  }> = [
    {
      name: "plan_week",
      message: "Plan my week",
      horizon: "week",
      plannerContext: campaignFollowUpContext("plan_week"),
    },
    {
      name: "low_energy_adjust",
      message: "Please lighten today",
      plannerContext: {
        starterIntent: "low_energy_adjust",
        statInterpretation: {
          ...plannerStatInterpretation("slipping"),
          statNeeds: {
            vitality: {
              level: "high",
              reasons: ["You've been pushing output harder than recovery."],
            },
            wisdom: { level: "low", reasons: [] },
            discipline: { level: "low", reasons: [] },
            resolve: { level: "low", reasons: [] },
            creativity: { level: "low", reasons: [] },
            alignment: { level: "low", reasons: [] },
          },
        },
      },
    },
    {
      name: "advance_campaign_start",
      message: "Advance my campaign",
      plannerContext: campaignFollowUpContext("advance_campaign_start"),
    },
    {
      name: "make_room",
      message: "Make room",
      plannerContext: campaignFollowUpContext("make_room"),
    },
    {
      name: "what_matters",
      message: "What matters most today?",
      plannerContext: campaignFollowUpContext("what_matters"),
    },
    {
      name: "briefing_followup",
      message: "Prepare me for tomorrow",
      plannerContext: campaignFollowUpContext("briefing_followup"),
    },
    {
      name: "relationship_touch",
      message: "Relationship touch",
      plannerContext: {
        starterIntent: "relationship_touch",
        contactsNeedingAttention: [
          {
            id: "contact-consent-1",
            name: "Mom",
            daysSinceContact: 9,
            hasOverdueReminder: true,
            reminderReason: "Call back this week",
          },
        ],
      },
    },
  ];

  for (const testCase of cases) {
    const result = buildPlannerResponse(baseInput({
      message: testCase.message,
      horizon: testCase.horizon ?? "day",
      plannerContext: testCase.plannerContext,
    }));

    assertEquals(result.mode, "conversational", testCase.name);
    assertEquals(result.proposals.length, 0, testCase.name);
    assertEquals(
      result.followUpQuestions[0]?.id,
      "planning_launcher_consent",
      testCase.name,
    );
    assertEquals(
      result.followUpQuestions[0]?.options,
      ["Yes", "No"],
      testCase.name,
    );
    assertEquals(
      result.structuredResponse?.intent.shouldCreateQuest ?? false,
      false,
      testCase.name,
    );
  }
});

Deno.test("typed planning launchers infer through explicit general starter before consent", () => {
  const cases: Array<{
    name: string;
    message: string;
    horizon?: PlannerBuildInput["horizon"];
    plannerContext: Partial<PlannerBuildInput["plannerContext"]>;
  }> = [
    {
      name: "briefing_followup",
      message: "Prepare me for tomorrow",
      plannerContext: {
        ...campaignFollowUpContext("briefing_followup"),
        starterIntent: "general",
      },
    },
  ];

  for (const testCase of cases) {
    const result = buildPlannerResponse(baseInput({
      message: testCase.message,
      horizon: testCase.horizon ?? "day",
      plannerContext: testCase.plannerContext,
    }));

    assertEquals(result.mode, "conversational", testCase.name);
    assertEquals(result.proposals.length, 0, testCase.name);
    assertEquals(
      result.followUpQuestions[0]?.id,
      "planning_launcher_consent",
      testCase.name,
    );
  }
});

Deno.test("typed plan my week does not infer an explicit planning launcher", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    plannerContext: {
      ...campaignFollowUpContext("plan_week"),
      starterIntent: "general",
    },
  }));

  assertEquals(result.proposals.length, 0);
  assertEquals(result.mode, "conversational");
  assertEquals(
    result.followUpQuestions[0]?.id === "planning_launcher_consent",
    false,
  );
  assertEquals(result.followUpQuestions[0]?.id, "details");
});

Deno.test("typed week planning aliases stay conversational instead of quest capture", () => {
  const cases = [
    {
      message: "What does this week look like?",
      parsedText: "What does this week look like",
    },
    { message: "What's my week like?", parsedText: "What's my week like" },
    { message: "Plan the week", parsedText: "" },
    { message: "weekly planning", parsedText: "planning" },
    { message: "What should I do this week?", parsedText: "" },
    { message: "week ahead", parsedText: "" },
    { message: "Schedule my week", parsedText: "" },
  ];

  for (const testCase of cases) {
    const result = buildPlannerResponse(baseInput({
      message: testCase.message,
      horizon: "week",
      parsedInput: {
        text: testCase.parsedText,
      },
      plannerContext: {
        ...campaignFollowUpContext("plan_week"),
        starterIntent: "general",
      },
    }));

    assertEquals(result.mode, "conversational", testCase.message);
    assertEquals(result.proposals.length, 0, testCase.message);
    assertEquals(
      result.followUpQuestions[0]?.id,
      "details",
      testCase.message,
    );
    assertEquals(result.sessionState.draft, {}, testCase.message);
  }
});

Deno.test("planning launcher consent yes replays free-up-after proposals", () => {
  const makeRoomContext: Partial<PlannerBuildInput["plannerContext"]> = {
    starterIntent: "make_room",
    tasks: [
      plannerTask({
        id: "task-free-after-1",
        title: "Evening admin",
        taskDate: "2026-04-18",
        scheduledTime: "17:30",
        estimatedDuration: 30,
      }),
    ],
  };
  const initial = buildPlannerResponse(baseInput({
    message: "Free me up after 5",
    plannerContext: makeRoomContext,
  }));

  const confirmed = buildPlannerResponse(baseInput({
    message: "Yes please",
    sessionState: initial.sessionState,
    plannerContext: makeRoomContext,
  }));

  assertEquals(initial.proposals.length, 0);
  assertEquals(
    initial.followUpQuestions[0]?.prompt,
    "Would you like me to draft those schedule changes?",
  );
  assertEquals(confirmed.mode, "proposal");
  assertEquals(confirmed.proposals.length, 1);
  assertEquals(confirmed.proposals[0]?.kind, "update_quest");
  assertEquals(
    (confirmed.proposals[0]?.payload as { taskId?: string }).taskId,
    "task-free-after-1",
  );
});

Deno.test("planning launcher quest consent yes asks for the quest name first", () => {
  const relationshipContext = {
    starterIntent: "relationship_touch" as const,
    contactsNeedingAttention: [
      {
        id: "contact-consent-2",
        name: "Mom",
        daysSinceContact: 9,
        hasOverdueReminder: true,
        reminderReason: "Call back this week",
      },
    ],
  };
  const initial = buildPlannerResponse(baseInput({
    message: "Relationship touch",
    plannerContext: relationshipContext,
  }));

  const confirmed = buildPlannerResponse(baseInput({
    message: "Yep, let's do it",
    sessionState: initial.sessionState,
    plannerContext: relationshipContext,
  }));

  assertEquals(initial.proposals.length, 0);
  assertEquals(
    initial.followUpQuestions[0]?.prompt,
    "Would you like to form a quest?",
  );
  assertEquals(/\bdrafted\b/i.test(initial.reply), false);
  assertEquals(/\bconfirmable\b/i.test(initial.reply), false);
  assertEquals(confirmed.mode, "conversational");
  assertEquals(confirmed.proposals.length, 0);
  assertEquals(confirmed.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(confirmed.sessionState.draft, { draftKind: "create_quest" });
  assertStringIncludes(confirmed.reply, "what should the quest be called");
});

Deno.test("advance campaign quest consent yes asks for the quest name first", () => {
  const campaignContext = campaignFollowUpContext("advance_campaign_start");
  const initial = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: campaignContext,
  }));

  const confirmed = buildPlannerResponse(baseInput({
    message: "Yes please",
    sessionState: initial.sessionState,
    plannerContext: campaignContext,
  }));

  assertEquals(initial.proposals.length, 0);
  assertEquals(
    initial.followUpQuestions[0]?.prompt,
    "Would you like to form a quest?",
  );
  assertEquals(confirmed.mode, "conversational");
  assertEquals(confirmed.proposals.length, 0);
  assertEquals(confirmed.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(confirmed.sessionState.draft, { draftKind: "create_quest" });
  assertStringIncludes(confirmed.reply, "what should the quest be called");
});

Deno.test("planning launcher consent no accepts natural refusal copy", () => {
  const initial = buildPlannerResponse(baseInput({
    message: "Make room",
    plannerContext: campaignFollowUpContext("make_room"),
  }));

  const declined = buildPlannerResponse(baseInput({
    message: "No thanks",
    sessionState: initial.sessionState,
    plannerContext: campaignFollowUpContext("make_room"),
  }));

  assertEquals(declined.mode, "conversational");
  assertEquals(declined.proposals.length, 0);
  assertEquals(declined.followUpQuestions.length, 0);
  assertEquals(declined.sessionState.planningConsent, null);
  assertStringIncludes(declined.reply, "not a draft");
});

Deno.test("turns a one-off request into a quest without forcing schedule details", () => {
  const result = buildPlannerResponse(baseInput());

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "quest");
});

Deno.test("uses the AI-estimated activity duration for new quest drafts when no duration is specified", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Draft investor memo",
    parsedInput: {
      text: "Draft investor memo",
      estimatedDuration: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.93,
      reasoning: "One-off work block",
      suggestedActivityDurationMinutes: 60,
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    60,
  );
});

Deno.test("prefers a historical quest duration over the generic AI estimate for new drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout tomorrow",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    parsedInput: {
      text: "Workout",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.93,
      reasoning: "One-off work block",
      suggestedActivityDurationMinutes: 30,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-workout-history-1",
          title: "Workout",
          taskDate: "2026-04-16",
          scheduledTime: "17:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T18:00:00.000Z",
          priority: "medium",
        },
      ],
      activeEpics: [],
      rituals: [],
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    45,
  );
});

Deno.test("prefers learned actual session duration over estimated duration", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout tomorrow",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    parsedInput: {
      text: "Workout",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.93,
      reasoning: "One-off work block",
      suggestedActivityDurationMinutes: 30,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-workout-actual-history-1",
          title: "Workout",
          taskDate: "2026-04-16",
          scheduledTime: "17:00",
          estimatedDuration: 45,
          actualDurationMinutes: 60,
          actualTimeSpent: 75,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T18:00:00.000Z",
          priority: "medium",
          category: "body",
        },
      ],
      activeEpics: [],
      rituals: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    60,
  );
});

Deno.test("uses fuzzy title history before the generic AI duration", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Draft investor memo",
    parsedInput: {
      text: "Draft investor memo",
      estimatedDuration: null,
      category: "work",
    },
    classificationHint: {
      type: "quest",
      confidence: 0.93,
      reasoning: "One-off work block",
      suggestedActivityDurationMinutes: 30,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-investor-memo-history-1",
          title: "Write investor memo",
          taskDate: "2026-04-16",
          scheduledTime: "10:00",
          estimatedDuration: 90,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T11:30:00.000Z",
          priority: "high",
          category: "work",
        },
      ],
      activeEpics: [],
      rituals: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    90,
  );
});

Deno.test("uses category duration history when the title is new", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Book dentist appointment",
    parsedInput: {
      text: "Book dentist appointment",
      estimatedDuration: null,
      category: "admin",
    },
    classificationHint: {
      type: "quest",
      confidence: 0.9,
      reasoning: "One-off admin block",
      suggestedActivityDurationMinutes: 60,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-admin-history-1",
          title: "Email receipts",
          taskDate: "2026-04-16",
          scheduledTime: "09:00",
          estimatedDuration: 20,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T09:20:00.000Z",
          priority: "medium",
          category: "admin",
        },
        {
          id: "task-admin-history-2",
          title: "Renew registration",
          taskDate: "2026-04-15",
          scheduledTime: "13:00",
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-15T14:00:00.000Z",
          priority: "medium",
          category: "admin",
        },
      ],
      activeEpics: [],
      rituals: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    20,
  );
});

Deno.test("uses the cleaned workout title for planner-created quest proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Add workout to today's schedule for 3pm",
    parsedInput: {
      text: "workout",
      scheduledTime: "15:00",
      scheduledDate: "2026-04-18",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Workout",
  );
});

Deno.test("normalizes conversational scheduled quest titles before building planner proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm going to grab lunch with Zach today at 1",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T12:34:00-07:00",
    parsedInput: {
      text: "I'm going to grab lunch with Zach",
      scheduledTime: "13:00",
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].title, "Create Grab Lunch With Zach");
  assertEquals(
    result.proposals[0].summary,
    'Create a quest for "Grab Lunch With Zach" on 2026-04-19 at 1:00 pm.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Grab Lunch With Zach",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "13:00",
  );
});

Deno.test("prefers the timed clause over later untimed asks for scheduled quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "I have a sales meeting at 4 today. This rest of my 9-5 I want to fill with other outside sales fitting tasks. I also want to get in a workout and work on coding the app later - you'd be able to do that?",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    parsedInput: {
      text:
        "I have a sales meeting . This rest of my I want to fill with other outside sales fitting tasks. I also want to get in a workout and work on coding the app later - you'd be able to do that",
      scheduledTime: "16:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.proposals[0].title, "Create Sales Meeting");
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).taskText,
    "Sales Meeting",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).scheduledTime,
    "16:00",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).category,
    undefined,
  );
});

Deno.test("lets a fresh task title override an unsaved draft instead of reusing it", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T09:00:00-07:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        scheduledTime: "08:00",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "workout",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].title, "Create workout");
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "workout",
  );
  assertEquals(result.reply.includes("saved calendar event"), false);
});

Deno.test("lets a fresh scheduled request override an unsaved draft instead of merging into it", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout at 5 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T09:00:00-07:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        scheduledTime: "08:00",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "workout",
      scheduledTime: "17:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
    }).taskText,
    "Workout",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
  assertEquals(result.reply.includes("saved calendar event"), false);
});

Deno.test("calls out saved calendar conflicts for scheduled quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Sales meeting at 4 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    parsedInput: {
      text: "sales meeting",
      scheduledTime: "16:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [{
        id: "event-1",
        title: "Client Call",
        start: "2026-04-20T16:00:00-07:00",
        end: "2026-04-20T17:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
    },
  }));

  assertEquals(result.proposals[0].title, "Create Sales Meeting");
  assertStringIncludes(result.reply, 'saved calendar event "Client Call"');
  assertStringIncludes(result.reply, "4:00 pm");
});

Deno.test("calls out saved calendar conflicts for explicit future drafts using the user's offset", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout on April 23, 2026 at 6:00 pm",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    horizon: "week",
    parsedInput: {
      text: "workout",
      scheduledTime: "18:00",
      scheduledDate: "2026-04-23",
      estimatedDuration: 45,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [{
        id: "event-1",
        title: "Dinner Reservation",
        start: "2026-04-23T18:15:00-07:00",
        end: "2026-04-23T19:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-23",
        dayLoads: [{
          date: "2026-04-23",
          totalMinutes: 240,
          taskCount: 4,
          status: "busy",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Thursday is fairly busy.",
      },
    },
  }));

  assertEquals(result.proposals[0].title, "Create Workout");
  assertStringIncludes(
    result.reply,
    'saved calendar event "Dinner Reservation"',
  );
  assertStringIncludes(result.reply, "6:15 pm-7:00 pm");
});

Deno.test("treats a simple timed utterance as a ready-to-confirm quest draft", () => {
  const result = buildPlannerResponse(baseInput({
    message: "gym at 5pm tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "gym",
      scheduledTime: "17:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].title, "Create Gym");
  assertEquals(
    result.proposals[0].summary,
    'Create a quest for "Gym" on 2026-04-20 at 5:00 pm.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Gym",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
});

Deno.test("normalizes parsed input server-side for question-form scheduling requests", () => {
  const result = buildPlannerResponse({
    ...baseInput({
      message: "can you put gym at 5pm tomorrow?",
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:30:00-07:00",
    }),
    parsedInput: null,
  });

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Gym",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
});

Deno.test("generic plan_day starter with no anchors asks what kind of day it is", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "plan_day",
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertStringIncludes(result.reply, "What kind of day");
  assertEquals(result.sessionState.pendingStarterIntent, "plan_day");
  assertEquals(result.structuredResponse, null);
});

Deno.test("bare plan_day starter asks a follow-up even when parsed text is stale", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me plan today",
    parsedInput: {
      text: "Call mom",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "plan_day",
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertStringIncludes(result.reply, "What kind of day");
  assertEquals(result.sessionState.pendingStarterIntent, "plan_day");
});

Deno.test("generic plan_day starter with anchors asks a context-aware question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "plan_day",
      tasks: [
        {
          id: "task-anchor-1",
          title: "Ship landing page copy",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
      ],
      priorityScores: [
        {
          id: "task:task-anchor-1",
          kind: "task",
          title: "Ship landing page copy",
          score: 86,
          reasons: ["Moves the relaunch forward."],
          taskId: "task-anchor-1",
          targetDate: "2026-04-18",
        },
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertStringIncludes(result.reply, "focusing");
  assertEquals(result.followUpQuestions[0]?.options, [
    "Ship landing page copy",
  ]);
  assertEquals(result.sessionState.pendingStarterIntent, "plan_day");
});

Deno.test("bare plan_day with campaign rituals still asks before drafting", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
    },
    plannerContext: {
      starterIntent: "plan_day",
      activeEpics: [{
        id: "epic-muscle",
        title: "Gain 10 pounds of muscle",
        endDate: null,
        progressPercentage: 25,
        habitCount: 2,
      }],
      tasks: [
        plannerTask({
          id: "ritual-task-1",
          title: "Weekly Meal Prep",
          taskDate: "2026-04-18",
          habitSourceId: "habit-meal-prep",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 120,
        }),
        plannerTask({
          id: "ritual-task-2",
          title: "Progress Tracking",
          taskDate: "2026-04-18",
          habitSourceId: "habit-progress",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 30,
        }),
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertEquals(result.structuredResponse, null);
  assertEquals(result.sessionState.pendingStarterIntent, "plan_day");
});

Deno.test("plan_day no-room copy explains hidden campaign ritual load", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Focus",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T16:38:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    parsedInput: {
      text: "Focus",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [{
        id: "epic-muscle",
        title: "Gain 10 pounds of muscle",
        endDate: null,
        progressPercentage: 25,
        habitCount: 4,
      }],
      tasks: [
        plannerTask({
          id: "ritual-task-1",
          title: "Weekly Meal Prep",
          taskDate: "2026-04-18",
          habitSourceId: "habit-meal-prep",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 120,
        }),
        plannerTask({
          id: "ritual-task-2",
          title: "Progress Tracking",
          taskDate: "2026-04-18",
          habitSourceId: "habit-progress",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 30,
        }),
        plannerTask({
          id: "ritual-task-3",
          title: "Strength Session",
          taskDate: "2026-04-18",
          habitSourceId: "habit-strength",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 60,
        }),
        plannerTask({
          id: "ritual-task-4",
          title: "Protein Check",
          taskDate: "2026-04-18",
          habitSourceId: "habit-protein",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 15,
        }),
        plannerTask({
          id: "ritual-task-5",
          title: "Hydration Check",
          taskDate: "2026-04-18",
          habitSourceId: "habit-hydration",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 15,
        }),
        plannerTask({
          id: "ritual-task-6",
          title: "Recovery Stretch",
          taskDate: "2026-04-18",
          habitSourceId: "habit-recovery",
          epicId: "epic-muscle",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 15,
        }),
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 0,
          taskCount: 0,
          status: "open",
        }],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
      statInterpretation: plannerStatInterpretation("locked_in"),
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "campaign work");
  assertStringIncludes(result.reply, "Weekly Meal Prep");
  assertStringIncludes(result.reply, "campaign drawer");
  assertEquals(result.structuredResponse?.planDay?.dayAssessment, "busy");
  assertEquals(
    result.structuredResponse?.planDay?.campaignFocus?.campaignTitle,
    "Gain 10 pounds of muscle",
  );
  assertEquals(
    result.structuredResponse?.planDay?.campaignFocus?.focusItems.includes(
      "Progress Tracking",
    ),
    true,
  );
});

Deno.test("plan_day ignores stale campaign links when the campaign is not active", () => {
  const staleTasks = Array.from({ length: 4 }, (_, index) =>
    plannerTask({
      id: `stale-campaign-task-${index + 1}`,
      title: [
        "Stretch review",
        "Nutrition cleanup",
        "Mileage note",
        "Recovery pass",
      ][index] ?? "Old campaign task",
      taskDate: "2026-04-18",
      epicId: "epic-gone",
      epicTitle: "Ghost campaign",
      estimatedDuration: 30,
    }));
  const result = buildPlannerResponse(baseInput({
    message: "Focus",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T16:38:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    parsedInput: {
      text: "Focus",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [],
      tasks: staleTasks,
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 0,
          taskCount: 0,
          status: "open",
        }],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
      statInterpretation: plannerStatInterpretation("locked_in"),
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.structuredResponse?.planDay?.campaignFocus, null);
  assertEquals(result.reply.includes("campaign drawer"), false);
  assertEquals(result.reply.includes("Ghost campaign"), false);
  assertEquals(result.reply.includes("stalled"), false);
});

Deno.test("plan_day tool prompt strips stale campaign ritual context", () => {
  const input = baseInput({
    message: "Focus",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T16:38:00-07:00",
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [{
        id: "epic-active",
        title: "Active Campaign",
        endDate: "2026-05-01",
        progressPercentage: 20,
        habitCount: 1,
      }],
      tasks: [
        plannerTask({
          id: "stale-ritual",
          title: "Daily Hydration",
          taskDate: "2026-04-18",
          habitSourceId: "habit-hydration",
          epicId: "epic-deleted",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 5,
        }),
        plannerTask({
          id: "stale-quest",
          title: "Old campaign admin",
          taskDate: "2026-04-18",
          epicId: "epic-deleted",
          epicTitle: "Gain 10 pounds of muscle",
          estimatedDuration: 20,
        }),
      ],
      inboxTasks: [
        plannerTask({
          id: "stale-inbox",
          title: "Deleted campaign inbox",
          taskDate: null,
          epicId: "epic-deleted",
          epicTitle: "Gain 10 pounds of muscle",
        }),
      ],
      rituals: [{
        id: "habit-hydration",
        title: "Daily Hydration",
        epicId: "epic-deleted",
        epicTitle: "Gain 10 pounds of muscle",
        frequency: "daily",
        preferredTime: null,
      }],
      priorityScores: [
        {
          id: "epic:orphan-deleted",
          kind: "epic",
          title: "Gain 10 pounds of muscle",
          score: 91,
          reasons: ["legacy orphan campaign score"],
          epicId: null,
        },
        {
          id: "ritual:orphan-hydration",
          kind: "ritual",
          title: "Daily Hydration",
          score: 88,
          reasons: ["legacy orphan ritual score"],
          ritualId: "habit-hydration",
          epicId: null,
        },
      ],
    },
  });

  const prompt = JSON.parse(buildPlanDayToolUserPrompt(input, []));
  const planDayContext = prompt.planDayContext;
  const protectedData = collectPlannerContextProtectedDataText(input);

  assertEquals(
    planDayContext.pendingTasksToday.some((task: { title: string }) =>
      task.title === "Daily Hydration"
    ),
    false,
  );
  assertEquals(planDayContext.pendingTasksToday[0]?.title, "Old campaign admin");
  assertEquals(planDayContext.pendingTasksToday[0]?.epicTitle, null);
  assertEquals(planDayContext.inboxTasks[0]?.epicTitle, null);
  assertEquals(planDayContext.rituals.length, 0);
  assertEquals(JSON.stringify(prompt).includes("Gain 10 pounds of muscle"), false);
  assertEquals(protectedData.includes("Daily Hydration"), false);
  assertEquals(protectedData.includes("Gain 10 pounds of muscle"), false);
});

Deno.test("plan_day no-room reply names what is loading the day when no campaign focus dominates", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Focus",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
      planDayEnergy: "medium",
    },
    parsedInput: {
      text: "Focus",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [],
      tasks: [
        plannerTask({
          id: "standalone-1",
          title: "Pay landlord",
          taskDate: "2026-04-18",
          estimatedDuration: 15,
        }),
        plannerTask({
          id: "standalone-2",
          title: "Reply to recruiter",
          taskDate: "2026-04-18",
          estimatedDuration: 20,
        }),
        plannerTask({
          id: "standalone-3",
          title: "Doctor appt prep",
          taskDate: "2026-04-18",
          estimatedDuration: 30,
        }),
        plannerTask({
          id: "standalone-4",
          title: "Pick up groceries",
          taskDate: "2026-04-18",
          estimatedDuration: 45,
        }),
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 110,
          taskCount: 4,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "4");
  assertStringIncludes(result.reply, "quests");
});

Deno.test("plan_day reply surfaces an at-risk campaign callout when one exists", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Focus",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
      planDayEnergy: "medium",
    },
    parsedInput: {
      text: "Focus",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [{
        id: "epic-relaunch",
        title: "Website relaunch",
        endDate: "2026-04-22",
        progressPercentage: 25,
        daysRemaining: 4,
        habitCount: 1,
      }],
      tasks: [
        plannerTask({
          id: "standalone-1",
          title: "Pay landlord",
          taskDate: "2026-04-18",
          estimatedDuration: 15,
        }),
        plannerTask({
          id: "standalone-2",
          title: "Reply to recruiter",
          taskDate: "2026-04-18",
          estimatedDuration: 20,
        }),
        plannerTask({
          id: "standalone-3",
          title: "Doctor appt prep",
          taskDate: "2026-04-18",
          estimatedDuration: 30,
        }),
        plannerTask({
          id: "standalone-4",
          title: "Pick up groceries",
          taskDate: "2026-04-18",
          estimatedDuration: 45,
        }),
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 110,
          taskCount: 4,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "Website relaunch");
  assertStringIncludes(result.reply, "at risk");
});

Deno.test("plan_day follow-up stays conversational after a focus answer", () => {
  const result = buildPlannerResponse(baseInput({
    message: "focused",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    parsedInput: {
      text: "focused",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [],
      tasks: [],
      inboxTasks: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    result.structuredResponse?.planDay?.suggestedQuests.length,
    0,
  );
  assertEquals(result.sessionState.pendingStarterIntent, "plan_day");
  assertStringIncludes(result.reply, "looks open");
});

Deno.test("plan_day follow-up preserves unquoted dashed task titles in prose", () => {
  const input = baseInput({
    message: "focused",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    parsedInput: {
      text: "focused",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [],
      tasks: [
        plannerTask({
          id: "task-budget-review",
          title: "Budget - review",
          taskDate: "2026-04-18",
        }),
      ],
      inboxTasks: [],
      rituals: [],
      calendarEvents: [],
      priorityScores: [{
        id: "task:task-budget-review",
        kind: "task",
        title: "Budget - review",
        score: 92,
        reasons: ["This is the clearest focus item."],
        taskId: "task-budget-review",
      }],
    },
  });
  const result = buildPlannerResponse(input);
  const finalResult = normalizePlannerBuildResultText(result, {
    protectedDataText: collectPlannerContextProtectedDataText(input),
  });

  assertStringIncludes(result.reply, "Budget - review");
  assertEquals(result.reply.includes("Budget. Review"), false);
  assertStringIncludes(
    result.structuredResponse?.planDay?.message ?? "",
    "Budget - review",
  );
  assertStringIncludes(finalResult.reply, "Budget - review");
  assertEquals(finalResult.reply.includes("Budget. Review"), false);
});

Deno.test("plan_day keeps the consent gate alive after a conversational follow-up", () => {
  const focusResult = buildPlannerResponse(baseInput({
    message: "Recovery",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    parsedInput: {
      text: "Recovery",
    },
    plannerContext: {
      starterIntent: undefined,
      activeEpics: [],
      tasks: [],
      inboxTasks: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  const concreteResult = buildPlannerResponse(baseInput({
    message: "clean room",
    parsedInput: {
      text: "clean room",
    },
    sessionState: focusResult.sessionState,
    plannerContext: {
      starterIntent: undefined,
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(focusResult.sessionState.pendingStarterIntent, "plan_day");
  assertEquals(concreteResult.mode, "conversational");
  assertEquals(concreteResult.proposals.length, 0);
  assertEquals(concreteResult.sessionState.draft, {});
  assertEquals(
    concreteResult.followUpQuestions[0]?.id,
    "plan_day_quest_consent",
  );
  assertEquals(
    concreteResult.followUpQuestions[0]?.prompt,
    "Would you like to form a quest?",
  );
});

Deno.test("plan_day lingering conversation state does not override explicit quest capture", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
    },
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: [],
    },
    plannerContext: {
      starterIntent: undefined,
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.reply, "Quest?");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(result.sessionState.draft, { draftKind: "create_quest" });
});

Deno.test("plan_day concrete follow-up asks before forming a quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "clean room",
    parsedInput: {
      text: "Plan my day",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    sessionState: {
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertEquals(result.followUpQuestions[0]?.id, "plan_day_quest_consent");
  assertEquals(result.followUpQuestions[0]?.options, ["Yes", "No"]);
  assertEquals(
    result.followUpQuestions[0]?.prompt,
    "Would you like to form a quest?",
  );
  assertEquals(result.sessionState.draft, {});
  assertEquals(result.sessionState.openQuestionIds, ["plan_day_quest_consent"]);
  assertEquals(
    result.structuredResponse?.planDay?.suggestedQuests.length,
    0,
  );
  assertStringIncludes(
    result.reply,
    "I won't turn that into a quest automatically",
  );
});

Deno.test("plan_day quest consent no keeps the turn read-only", () => {
  const result = buildPlannerResponse(baseInput({
    message: "No thanks",
    sessionState: {
      draft: {},
      openQuestionIds: ["plan_day_quest_consent"],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.draft, {});
  assertStringIncludes(result.reply, "not a quest");
});

Deno.test("plan_day quest consent yes asks for details before quest capture", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Yep, let's do it",
    sessionState: {
      draft: {},
      openQuestionIds: ["plan_day_quest_consent"],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 1);
  assertEquals(result.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(result.sessionState.draft, { draftKind: "create_quest" });
  assertStringIncludes(result.reply, "what should the quest be called");
});

Deno.test("plan_day starter with a focus direction stays conversational", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Work",
    parsedInput: {
      text: "Work",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "plan_day",
      tasks: [
        plannerTask({
          id: "task-scheduled-1",
          title: "Ship landing page copy",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 60,
        }),
      ],
      priorityScores: [
        {
          id: "task:task-scheduled-1",
          kind: "task",
          title: "Ship landing page copy",
          score: 86,
          reasons: ["Moves the relaunch forward."],
          taskId: "task-scheduled-1",
          targetDate: "2026-04-18",
        },
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    result.structuredResponse?.planDay?.suggestedQuests.length,
    0,
  );
  assertStringIncludes(result.reply, "I won't draft it unless you ask");
});

Deno.test("drafts one proposal per extracted action in aggressive bundle mode", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "I want to clean my house, work on building the app, and workout later",
    parsedInput: {
      text:
        "I want to clean my house, work on building the app, and workout later",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 60,
          taskCount: 1,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "17:30",
            endTime: "18:30",
            score: 80,
            reason: "Open after-work slot",
          },
          {
            date: "2026-04-18",
            time: "18:45",
            endTime: "20:15",
            score: 78,
            reason: "Focus block after dinner",
          },
          {
            date: "2026-04-18",
            time: "20:15",
            endTime: "21:15",
            score: 72,
            reason: "Late workout window",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 3);
  assertEquals(
    result.proposals.every((proposal) => proposal.kind === "create_quest"),
    true,
  );
  assertStringIncludes(result.reply, "I drafted 3 quests");
  assertEquals(
    result.proposals.map((proposal) => proposal.title),
    [
      "Create Clean My House",
      "Create Work On Building The App",
      "Create Workout",
    ],
  );
});

Deno.test("plan_day scheduled concrete task asks consent instead of drafting into a conflict", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Sales meeting at 4 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
    },
    parsedInput: {
      text: "sales meeting",
      scheduledTime: "16:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      calendarEvents: [{
        id: "event-1",
        title: "Client Call",
        start: "2026-04-20T16:00:00-07:00",
        end: "2026-04-20T17:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions[0]?.id, "plan_day_quest_consent");
  assertEquals(
    result.followUpQuestions[0]?.prompt,
    "Would you like to form a quest?",
  );
  assertEquals(result.sessionState.draft, {});
});

Deno.test("drafts confirmable moves for free-me-up-after requests", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Free me up after 5",
    currentDate: "2026-04-18",
    sessionState: confirmedPlanningConsent("make_room", "Free me up after 5"),
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Prep investor update",
          taskDate: "2026-04-18",
          scheduledTime: "17:30",
          estimatedDuration: 45,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(result.proposals[0].kind, "update_quest");
  assertEquals(
    (result.proposals[0].payload as {
      updates: { task_date: string };
    }).updates.task_date,
    "2026-04-19",
  );
});

Deno.test("make_room free-me-up-after asks consent before drafting moves", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Free me up after 5",
    currentDate: "2026-04-18",
    plannerContext: {
      starterIntent: "make_room",
      tasks: [
        {
          id: "task-1",
          title: "Prep investor update",
          taskDate: "2026-04-18",
          scheduledTime: "17:30",
          estimatedDuration: 45,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions[0]?.id, "planning_launcher_consent");
  assertEquals(result.sessionState.draft, {});
  assertEquals(/\bdrafted\b/i.test(result.reply), false);
  assertEquals(/\breview\b/i.test(result.reply), false);
  assertStringIncludes(
    result.followUpQuestions[0]?.prompt ?? "",
    "draft those schedule changes",
  );
});

Deno.test("low-energy fallback returns a priority overview when no recovery block is available", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm tired today, make it light",
    currentDate: "2026-04-18",
    sessionState: confirmedPlanningConsent(
      "low_energy_adjust",
      "I'm tired today, make it light",
    ),
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Deep work block",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 90,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-2",
          title: "Inbox cleanup",
          taskDate: "2026-04-18",
          scheduledTime: "16:00",
          estimatedDuration: 30,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "low",
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Deep work block",
          score: 80,
          reasons: ["due today"],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Inbox cleanup",
          score: 32,
          reasons: ["can move cleanly"],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "16:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.priorityOverview !== null, true);
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Deep work block",
  );
});

Deno.test("creates a relationship touch proposal with contact context", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Relationship touch",
    sessionState: confirmedPlanningConsent(
      "relationship_touch",
      "Relationship touch",
    ),
    plannerContext: {
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
          reminderReason: "Call back this week",
        },
      ],
      starterIntent: "relationship_touch",
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "18:00",
            endTime: "18:30",
            score: 88,
            reason: "Open after work",
          },
        ],
        moveSuggestions: [],
        summary: "The evening is pretty open.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (result.proposals[0].payload as { contactId: string }).contactId,
    "contact-1",
  );
  assertStringIncludes(result.proposals[0].title, "Mom");
  assertEquals(
    (result.proposals[0].payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    15,
  );
});

Deno.test("relationship touch shrinks to fit a shorter open slot", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Relationship touch",
    sessionState: confirmedPlanningConsent(
      "relationship_touch",
      "Relationship touch",
    ),
    plannerContext: {
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
          reminderReason: "Call back this week",
        },
      ],
      starterIntent: "relationship_touch",
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "18:00",
            endTime: "18:10",
            score: 88,
            reason: "Quick open slot",
          },
        ],
        moveSuggestions: [],
        summary: "The evening has one short gap.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (result.proposals[0].payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    10,
  );
  assertStringIncludes(
    result.proposals[0]?.summary ?? "",
    'Create a quest to reach out to "Mom" at 6:00 pm.',
  );
  assertEquals(
    (result.proposals[0].payload as { scheduledTime?: string | null })
      .scheduledTime,
    "18:00",
  );
});

Deno.test(
  "relationship touch prefers historical duration before slot fit",
  () => {
    const result = buildPlannerResponse(baseInput({
      message: "Relationship touch",
      sessionState: confirmedPlanningConsent(
        "relationship_touch",
        "Relationship touch",
      ),
      plannerContext: {
        contactsNeedingAttention: [
          {
            id: "contact-1",
            name: "Mom",
            daysSinceContact: 9,
            hasOverdueReminder: true,
            reminderReason: "Call back this week",
          },
        ],
        recentCompletedTasks: [
          {
            id: "task-contact-history-2",
            title: "Reach out to Mom",
            taskDate: "2026-04-16",
            scheduledTime: "18:00",
            estimatedDuration: 30,
            recurrencePattern: null,
            completed: true,
            completedAt: "2026-04-16T18:30:00.000Z",
            priority: "medium",
          },
        ],
        starterIntent: "relationship_touch",
        scheduleInsights: {
          horizon: "day",
          selectedDate: "2026-04-18",
          dayLoads: [],
          overloadedDates: [],
          emptyDates: [],
          conflicts: [],
          suggestedSlots: [
            {
              date: "2026-04-18",
              time: "18:00",
              endTime: "18:30",
              score: 88,
              reason: "Open after work",
            },
          ],
          moveSuggestions: [],
          summary: "The evening is pretty open.",
        },
      },
    }));

    assertEquals(result.mode, "proposal");
    assertEquals(result.proposals[0].kind, "create_quest");
    assertEquals(
      (result.proposals[0].payload as { estimatedDuration?: number | null })
        .estimatedDuration,
      30,
    );
  },
);

Deno.test("turns high vitality need into a confirmable recovery block", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Please lighten today",
    sessionState: confirmedPlanningConsent(
      "low_energy_adjust",
      "Please lighten today",
    ),
    plannerContext: {
      starterIntent: "low_energy_adjust",
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 320,
            wisdom: 510,
            discipline: 560,
            resolve: 430,
            creativity: 380,
            alignment: 470,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: {
            level: "high",
            reasons: ["You've been pushing output harder than recovery."],
          },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "slipping",
        recentMissInterpretation: "low_energy",
        narrativeBrief:
          "This looks more strained than lazy. I'm protecting the essentials and rebuilding vitality first.",
        dailyNarrative: "Vitality protection day",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 240,
            taskCount: 4,
            status: "overloaded",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "15:00",
            endTime: "15:30",
            score: 82,
            reason: "Open afternoon space",
          },
        ],
        moveSuggestions: [],
        summary: "Today is overloaded.",
      },
      tasks: [],
      inboxTasks: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(result.reply, "rebuilding vitality first");
  assertStringIncludes(
    result.proposals[0]?.summary ?? "",
    "Create a 30-minute recovery reset at 3:00 pm.",
  );
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Recovery reset",
  );
});

Deno.test("recovery block shrinks to fit a shorter open slot", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Please lighten today",
    sessionState: confirmedPlanningConsent(
      "low_energy_adjust",
      "Please lighten today",
    ),
    plannerContext: {
      starterIntent: "low_energy_adjust",
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 320,
            wisdom: 510,
            discipline: 560,
            resolve: 430,
            creativity: 380,
            alignment: 470,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: {
            level: "high",
            reasons: ["You've been pushing output harder than recovery."],
          },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "slipping",
        recentMissInterpretation: "low_energy",
        narrativeBrief:
          "This looks more strained than lazy. I'm protecting the essentials and rebuilding vitality first.",
        dailyNarrative: "Vitality protection day",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 240,
            taskCount: 4,
            status: "overloaded",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "15:00",
            endTime: "15:20",
            score: 82,
            reason: "Open afternoon space",
          },
        ],
        moveSuggestions: [],
        summary: "Today is overloaded.",
      },
      tasks: [],
      inboxTasks: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(
    result.proposals[0]?.summary ?? "",
    "Create a 20-minute recovery reset at 3:00 pm.",
  );
  assertEquals(
    (result.proposals[0].payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    20,
  );
});

Deno.test("recovery block prefers historical duration before slot fit", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Please lighten today",
    sessionState: confirmedPlanningConsent(
      "low_energy_adjust",
      "Please lighten today",
    ),
    plannerContext: {
      starterIntent: "low_energy_adjust",
      recentCompletedTasks: [
        {
          id: "task-recovery-history-2",
          title: "Recovery reset",
          taskDate: "2026-04-16",
          scheduledTime: "15:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T15:45:00.000Z",
          priority: "medium",
        },
      ],
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 320,
            wisdom: 510,
            discipline: 560,
            resolve: 430,
            creativity: 380,
            alignment: 470,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: {
            level: "high",
            reasons: ["You've been pushing output harder than recovery."],
          },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "slipping",
        recentMissInterpretation: "low_energy",
        narrativeBrief:
          "This looks more strained than lazy. I'm protecting the essentials and rebuilding vitality first.",
        dailyNarrative: "Vitality protection day",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 240,
            taskCount: 4,
            status: "overloaded",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "15:00",
            endTime: "15:45",
            score: 82,
            reason: "Open afternoon space",
          },
        ],
        moveSuggestions: [],
        summary: "Today is overloaded.",
      },
      tasks: [],
      inboxTasks: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(
    result.proposals[0]?.summary ?? "",
    "Create a 45-minute recovery reset at 3:00 pm.",
  );
  assertEquals(
    (result.proposals[0].payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    45,
  );
});

Deno.test("keeps vague one-off placement requests confirmable without a concrete time", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Schedule gym tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "gym",
      scheduledTime: null,
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    null,
  );
});

Deno.test("treats concrete scheduled actions as quests even when the classifier says epic", () => {
  const result = buildPlannerResponse(baseInput({
    message: "study for the bar at 5 tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "study for the bar",
      scheduledTime: "17:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.95,
      reasoning: "Long-term goal",
      suggestedDeadline: "2026-08-01",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("recovers the quest title from the raw message when parsed text is scaffold-only", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Add workout to today's schedule for 3pm",
    parsedInput: {
      text: "Add to 's schedule for",
      scheduledTime: "15:00",
      scheduledDate: "2026-04-18",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Workout",
  );
});

Deno.test("defaults repeated standalone work to a recurring quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write for my newsletter every weekday",
    parsedInput: {
      text: "Write for my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: 30,
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.88,
      reasoning: "Repeated task",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(result.proposals[0].summary, "recurring quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("promotes multi-step goals to campaigns", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Get my real estate license by August",
    parsedInput: {
      text: "Get my real estate license",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.94,
      reasoning: "Long-term goal",
      suggestedDeadline: "2026-08-01",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(result.proposals[0].readyToConfirm, false);
  assertEquals(result.proposals[0].missingFields?.includes("time of day"), true);
  assertEquals(result.followUpQuestions.some((question) => question.field === "time_of_day"), true);
  assertEquals(result.sessionState.lastClassification, "epic");
});

Deno.test("uses separate AI estimates for campaign target days and starter session duration", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare for the bar exam",
    parsedInput: {
      text: "Prepare for the bar exam",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.95,
      reasoning: "Long-term exam prep",
      suggestedDuration: 84,
      suggestedActivityDurationMinutes: 60,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        target_days?: number | null;
        habits?: Array<{
          estimated_minutes?: number | null;
        }>;
      }
    ).target_days,
    84,
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        target_days?: number | null;
        habits?: Array<{
          estimated_minutes?: number | null;
        }>;
      }
    ).habits?.[0]?.estimated_minutes,
    60,
  );
});

Deno.test("prefers a historical starter ritual duration over the generic AI estimate for new campaigns", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I want to launch a new campaign for Launch Sprint",
    parsedInput: {
      text: "Launch Sprint",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.91,
      reasoning: "Multi-step outcome",
      suggestedDuration: 84,
      suggestedActivityDurationMinutes: 60,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [
        {
          id: "ritual-campaign-history-1",
          epicId: "old-epic-1",
          epicTitle: "Old Launch Sprint",
          title: "Work on Launch Sprint",
          frequency: "daily",
          preferredTime: "09:00",
          estimatedMinutes: 90,
        },
      ],
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 60,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        target_days?: number | null;
        habits?: Array<{
          estimated_minutes?: number | null;
        }>;
      }
    ).target_days,
    84,
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        habits?: Array<{
          estimated_minutes?: number | null;
        }>;
      }
    ).habits?.[0]?.estimated_minutes,
    90,
  );
});

Deno.test("prefers a ritual's learned actual session duration over its template estimate", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I want to launch a new campaign for Launch Sprint",
    parsedInput: {
      text: "Launch Sprint",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.91,
      reasoning: "Multi-step outcome",
      suggestedDuration: 84,
      suggestedActivityDurationMinutes: 30,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [
        {
          id: "ritual-campaign-actual-history-1",
          epicId: "old-epic-1",
          epicTitle: "Old Launch Sprint",
          title: "Work on Launch Sprint",
          frequency: "daily",
          preferredTime: "09:00",
          estimatedMinutes: 90,
          actualDurationMinutes: 60,
        },
      ],
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        habits?: Array<{
          estimated_minutes?: number | null;
        }>;
      }
    ).habits?.[0]?.estimated_minutes,
    60,
  );
});

Deno.test("ties repeated campaign work to a ritual when an active campaign is referenced", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Practice interview answers every weekday for Launch Sprint",
    parsedInput: {
      text: "Practice interview answers",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: 25,
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.86,
      reasoning: "Repeated work",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-1",
        title: "Launch Sprint",
        endDate: "2026-06-15",
      }],
      rituals: [],
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 60,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_ritual");
  assertEquals(result.proposals[0].readyToConfirm, false);
  assertEquals(result.proposals[0].missingFields?.includes("time of day"), true);
  assertEquals(result.followUpQuestions.some((question) => question.field === "time_of_day"), true);
  assertStringIncludes(result.proposals[0].summary, "Launch Sprint");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedMinutes?: number | null;
      }
    ).estimatedMinutes,
    25,
  );
});

Deno.test("uses the AI-estimated activity duration for ritual drafts when no duration is specified", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Practice interview answers every weekday for Launch Sprint",
    parsedInput: {
      text: "Practice interview answers",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.9,
      reasoning: "Repeated work tied to an active campaign",
      suggestedActivityDurationMinutes: 60,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-ritual-estimate-1",
        title: "Launch Sprint",
        endDate: "2026-06-15",
      }],
      rituals: [],
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 60,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_ritual");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedMinutes?: number | null;
      }
    ).estimatedMinutes,
    60,
  );
});

Deno.test("uses suggest_reminder for reminder-only tweaks on existing quests", () => {
  const result = buildPlannerResponse(baseInput({
    message: "remind me 30 minutes before workout",
    parsedInput: {
      text: "workout",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    plannerContext: {
      tasks: [{
        id: "task-1",
        title: "Workout",
        taskDate: "2026-04-20",
        scheduledTime: "17:00",
        estimatedDuration: 45,
        recurrencePattern: null,
      }],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "suggest_reminder");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      updates: {
        reminder_enabled?: boolean;
        reminder_minutes_before?: number | null;
      };
    }).updates.reminder_enabled,
    true,
  );
  assertEquals(
    (result.proposals[0].payload as {
      updates: {
        reminder_enabled?: boolean;
        reminder_minutes_before?: number | null;
      };
    }).updates.reminder_minutes_before,
    30,
  );
});

Deno.test("does not overwrite an existing quest duration from an inferred AI estimate alone", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move workout to tomorrow",
    parsedInput: {
      text: "workout",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.91,
      reasoning: "Existing one-off quest",
      suggestedActivityDurationMinutes: 60,
    },
    plannerContext: {
      tasks: [{
        id: "task-update-duration-1",
        title: "Workout",
        taskDate: "2026-04-18",
        scheduledTime: "15:00",
        estimatedDuration: 30,
        recurrencePattern: null,
        completed: false,
        priority: "medium",
      }],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_quest");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        updates?: {
          estimated_duration?: number | null;
        };
      }
    ).updates?.estimated_duration,
    undefined,
  );
});

Deno.test("uses update_ritual for reminder-only tweaks on existing rituals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "remind me 10 minutes before morning pages",
    parsedInput: {
      text: "morning pages",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-1",
        title: "Creative Reset",
        endDate: "2026-06-15",
      }],
      rituals: [{
        id: "ritual-1",
        epicId: "epic-1",
        epicTitle: "Creative Reset",
        title: "Morning Pages",
        frequency: "daily",
        preferredTime: "08:00",
      }],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_ritual");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      reminderEnabled?: boolean | null;
      reminderMinutesBefore?: number | null;
    }).reminderEnabled,
    true,
  );
  assertEquals(
    (result.proposals[0].payload as {
      reminderEnabled?: boolean | null;
      reminderMinutesBefore?: number | null;
    }).reminderMinutesBefore,
    10,
  );
});

Deno.test("does not overwrite an existing ritual duration from an inferred AI estimate alone", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move Morning review to 9am",
    parsedInput: {
      text: "Morning review",
      scheduledTime: "09:00",
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.9,
      reasoning: "Existing ritual adjustment",
      suggestedActivityDurationMinutes: 60,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-ritual-update-1",
        title: "Launch Sprint",
        endDate: "2026-06-15",
      }],
      rituals: [{
        id: "ritual-update-duration-1",
        epicId: "epic-ritual-update-1",
        epicTitle: "Launch Sprint",
        title: "Morning review",
        frequency: "daily",
        preferredTime: "08:00",
      }],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_ritual");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedMinutes?: number | null;
      }
    ).estimatedMinutes,
    undefined,
  );
});

Deno.test("uses follow-up answers to preserve the existing draft and learn time preferences", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Morning because I'm sharper before email",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
        cadence: "weekdays",
      },
      openQuestionIds: ["time_of_day", "time_reason", "end_date"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "habit",
    },
    parsedInput: {
      text: "Morning because I'm sharper before email",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.7,
      reasoning: "Answer to cadence questions",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.sessionState.draft.title, "Write for my newsletter");
  assertEquals(result.memoryUpdates.preferredTimeOfDay, "morning");
  assertStringIncludes(
    result.memoryUpdates.preferredTimeReason ?? "",
    "sharper",
  );
});

Deno.test("treats a bare clock reply as answering the open time question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "08:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "08:00",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.7,
      reasoning: "Answer to timing question",
    },
  }));

  assertEquals(result.sessionState.draft.scheduledTime, "08:00");
  assertEquals(result.followUpQuestions.map((question) => question.field), []);
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(
    result.proposals[0].missingFields?.includes("time of day") ?? false,
    false,
  );
});

Deno.test("treats a dated slot reply as answering both the day and time question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "2026-04-19 08:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "2026-04-19 08:00",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "quest",
      confidence: 0.7,
      reasoning: "Answer to timing question",
    },
  }));

  assertEquals(result.sessionState.draft.scheduledDate, "2026-04-19");
  assertEquals(result.sessionState.draft.scheduledTime, "08:00");
  assertEquals(result.followUpQuestions.map((question) => question.field), []);
  assertEquals(result.proposals[0].readyToConfirm, true);
});

Deno.test("asks what the user wants to get done before checking openings for vague planning prompts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me plan today.",
    parsedInput: {
      text: "Help me plan today.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "09:00",
            endTime: "10:00",
            score: 92,
            reason: "Fits your usual morning rhythm.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "details",
  ]);
  assertStringIncludes(result.reply, "what you want to get done");
  assertStringIncludes(
    result.followUpQuestions[0]?.prompt ?? "",
    "What do you want to get done",
  );
  assertEquals(result.reply.includes("open windows"), false);
});

Deno.test("uses the answer to the intent-first question to resume the normal proposal flow", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write my launch notes",
    parsedInput: {
      text: "Write my launch notes",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    sessionState: {
      draft: {},
      openQuestionIds: ["details"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "09:00",
            endTime: "10:00",
            score: 92,
            reason: "Fits your usual morning rhythm.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.reply, "I drafted this as a quest");
});

Deno.test("does not jump straight to timing questions for broad day-planning asks", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my writing session",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 120,
            taskCount: 2,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "09:00",
            endTime: "10:00",
            score: 92,
            reason: "Fits your usual morning rhythm.",
          },
          {
            date: "2026-04-18",
            time: "13:30",
            endTime: "14:30",
            score: 81,
            reason: "Keeps the day balanced.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
      },
      plannerMemory: {
        preferredTimeOfDay: "morning",
        preferredTimeReason: "you're sharp before email",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.reply, "I drafted this as a quest");
});

Deno.test("keeps overloaded-day guidance in the reply without blocking confirmation", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write my launch notes",
    horizon: "week",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 360,
            taskCount: 6,
            status: "overloaded",
          },
          {
            date: "2026-04-19",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-19",
            time: "10:00",
            endTime: "11:00",
            score: 88,
            reason: "This day is light.",
          },
        ],
        moveSuggestions: [
          {
            fromDate: "2026-04-18",
            toDate: "2026-04-19",
            taskId: "task-1",
            taskTitle: "Write my launch notes",
            suggestedTime: "10:00",
            reason: "Sunday has room at 10:00.",
          },
        ],
        summary:
          "1 week day is overloaded. Write my launch notes could move to 2026-04-19 at 10:00.",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "I drafted this as a quest");
});

Deno.test("answers schedule questions with quests and connected calendar events without creating proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have scheduled today?",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T21:00:00.000Z",
          end: "2026-04-18T22:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout (was at 9:00 am)");
  assertStringIncludes(result.reply, "Therapy");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
});

Deno.test("schedule questions keep campaign follow-up suggestions read-only", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have scheduled today?",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-schedule-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-schedule-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      activeEpics: [
        {
          id: "epic-schedule-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-schedule-followup-1",
          title: "Therapy",
          start: "2026-04-18T21:00:00.000Z",
          end: "2026-04-18T22:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "13:30",
            endTime: "13:45",
            score: 88,
            reason: "Open slot for a quick campaign follow-up before Therapy.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room before the afternoon.",
      },
      priorityScores: [
        {
          id: "epic:epic-schedule-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-schedule-followup-1",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.plannerContract?.mode, "schedule_read");
  assertEquals(result.plannerContract?.writePolicy, "read_only");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "conversation");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Therapy");
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(result.structuredResponse?.comingUp?.nextBestAction?.proposalId),
    false,
  );
});

Deno.test("treats the route starter like a schedule overview instead of a quest draft", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "12:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout (at 12:00 pm)");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
});

Deno.test("treats an empty route request like a short empty schedule summary", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.reply, "Today: nothing scheduled.");
  assertEquals(result.reply.includes("time is all you got"), false);
  assertEquals(result.reply.includes("bullshit"), false);
});

Deno.test("reads upcoming named weekdays instead of falling back to today", () => {
  const result = buildPlannerResponse(baseInput({
    message: "How does my upcoming Saturday look?",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T09:30:00-07:00",
    parsedInput: {
      text: "How does my upcoming Saturday look?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Long run",
          taskDate: "2026-04-25",
          scheduledTime: "09:00",
          estimatedDuration: 90,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Saturday, April 25:");
  assertStringIncludes(result.reply, "Long run (at 9:00 am)");
  assertEquals(result.reply.includes("Here's the shape of today."), false);
});

Deno.test("goal_breakdown_start opens with one assistant-led goal prompt", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What goal do you want to break down?",
    parsedInput: {
      text: "What goal do you want to break down?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "goal_breakdown_start",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.draft.title ?? null, null);
  assertEquals(
    result.sessionState.pendingStarterIntent,
    "goal_breakdown_start",
  );
  assertStringIncludes(result.reply, "goal");
});

Deno.test("uses the follow-up goal after the launcher starter instead of reusing starter copy as the title", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "What goal do you want to break down?",
    parsedInput: {
      text: "What goal do you want to break down?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "goal_breakdown_start",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Get my real estate license by August",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Get my real estate license",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    classificationHint: {
      type: "epic",
      confidence: 0.94,
      reasoning: "Long-term goal",
      suggestedDeadline: "2026-08-01",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(result.proposals[0].title, "Create Get my real estate license");
  assertEquals(result.sessionState.draft.title, "Get my real estate license");
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
});

Deno.test("quest_capture asks for the quest and timing before drafting", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(result.sessionState.draft.draftKind, "create_quest");
  assertEquals(result.reply, "Quest?");
});

Deno.test("quest_capture turns a complete follow-up answer into a ready quest draft", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter tomorrow at 18:00",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: "18:00",
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Write My Newsletter",
  );
  assertEquals(
    (result.proposals[0].payload as { scheduledTime: string | null })
      .scheduledTime,
    "18:00",
  );
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
});

Deno.test("quest_capture gives explicit follow-up timing precedence over schedule summaries and learned patterns", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Workout at 5",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T11:33:00-07:00",
    sessionState: {
      ...intake.sessionState,
      preferredTimeOfDay: "afternoon",
      preferredTimeReason: "usual afternoon rhythm",
    },
    parsedInput: {
      text: "workout",
      scheduledTime: "17:00",
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    plannerContext: {
      plannerMemory: {
        preferredTimeOfDay: "afternoon",
        preferredTimeReason: "usual afternoon rhythm",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [{
          date: "2026-04-20",
          time: "13:00",
          endTime: "13:30",
          score: 92,
          reason: "Matches your usual afternoon rhythm",
        }],
        moveSuggestions: [],
        summary:
          "Today has room at 13:00. Matches your usual afternoon rhythm.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(
    (result.proposals[0].payload as {
      scheduledTime: string | null;
      taskDate: string | null;
    }).scheduledTime,
    "17:00",
  );
  assertEquals(
    (result.proposals[0].payload as {
      scheduledTime: string | null;
      taskDate: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    'Create a quest for "Workout" at 5:00 pm.',
  );
  assertStringIncludes(result.reply, "today at 5:00 pm");
  assertEquals(result.reply.includes("1:00 pm"), false);
  assertEquals(result.reply.includes("usual afternoon rhythm"), false);
  assertEquals(result.reply.includes("assuming"), false);
  assertEquals(result.memoryUpdates.preferredTimeOfDay, "evening");
  assertEquals(result.memoryUpdates.preferredTimeReason ?? null, null);
  assertEquals(result.sessionState.preferredTimeOfDay, "evening");
  assertEquals(result.sessionState.preferredTimeReason ?? null, null);
  assertEquals(result.sessionState.draft.timeReason ?? null, null);
});

Deno.test("quest_capture turns a bare quest title into a ready inbox draft", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    result.proposals[0].summary,
    'Capture "Write my newsletter" in Inbox so you can schedule it later.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).taskDate,
    null,
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).scheduledTime,
    null,
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).source,
    "inbox",
  );
});

Deno.test("quest_capture uses the selected day's best open slot for a bare quest title", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T10:30:00-07:00",
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-20",
            time: "18:00",
            endTime: "18:30",
            score: 92,
            reason: "Open evening window",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room in the evening.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming that slot based on your open window",
  );
});

Deno.test("quest_capture uses the preferred time window for a bare quest title when no slot is available", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T10:30:00-07:00",
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      plannerMemory: {
        preferredTimeOfDay: "evening",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has flexibility.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming your usual evening pattern",
  );
});

Deno.test("quest_capture uses a matching suggested slot for date-only replies", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-19",
            time: "18:00",
            endTime: "18:30",
            score: 92,
            reason: "Open evening window",
          },
        ],
        moveSuggestions: [],
        summary: "Tomorrow has room in the evening.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming that slot based on your open window",
  );
  assertStringIncludes(
    result.reply,
    "assuming 2026-04-19 at 6:00 pm based on your open slot",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
});

Deno.test("quest_capture uses planner memory when a date-only reply has no matching slot", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      plannerMemory: {
        preferredTimeOfDay: "evening",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Tomorrow still has some flexibility.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming your usual evening pattern",
  );
  assertStringIncludes(
    result.reply,
    "assuming 2026-04-19 at 6:00 pm based on your usual evening pattern",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
});

Deno.test("quest_capture keeps a date-only reply confirmable when no safe time assumption exists", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Tomorrow is unscheduled so far.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    null,
  );
});

Deno.test("quest_capture asks only for the quest details when the user replies with timing first", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      starterIntent: "quest_capture",
    },
  }));

  const timingOnly = buildPlannerResponse(baseInput({
    message: "Tomorrow at 18:00",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Tomorrow at 18:00",
      scheduledTime: "18:00",
      scheduledDate: "2026-04-19",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
  }));

  assertEquals(timingOnly.followUpQuestions.map((question) => question.field), [
    "details",
  ]);

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter",
    sessionState: timingOnly.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(
    (result.proposals[0].payload as { scheduledTime: string | null })
      .scheduledTime,
    "18:00",
  );
});

Deno.test("upcoming_start returns the today-and-tomorrow digest immediately", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "15:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
        {
          id: "task-2",
          title: "Inbox cleanup",
          taskDate: "2026-04-19",
          scheduledTime: "09:30",
          estimatedDuration: 30,
          recurrencePattern: null,
        },
        {
          id: "task-3",
          title: "Prep therapy notes",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 20,
          recurrencePattern: null,
          priority: "high",
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T21:00:00.000Z",
          end: "2026-04-18T22:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Therapy");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertStringIncludes(result.reply, "Inbox cleanup (at 9:30 am)");
  assertEquals(result.structuredResponse?.comingUp !== null, true);
  assertEquals(result.structuredResponse?.comingUp?.remainingToday.length, 3);
  assertEquals(
    result.structuredResponse?.comingUp?.nextEvent?.title,
    "Therapy",
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Prep therapy notes",
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.proposalId ?? null,
    null,
  );
});

Deno.test("plan_week returns a structured weekly summary with priorities and load signals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-04-24",
          progressPercentage: 58,
          daysRemaining: 6,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Finalize launch checklist",
          taskDate: "2026-04-20",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
        {
          id: "task-2",
          title: "Prep investor notes",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Launch prep",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "08:00",
        },
      ],
      calendarEvents: [
        {
          id: "event-1",
          title: "Launch workshop",
          start: "2026-04-20T17:00:00.000Z",
          end: "2026-04-20T22:30:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 88,
          reasons: ["Launch prep is the campaign to protect this week."],
          epicId: "epic-1",
        },
        {
          id: "task:task-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 82,
          reasons: ["It keeps launch prep moving before the deadline hits."],
          taskId: "task-1",
          epicId: "epic-1",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Prep investor notes",
          score: 79,
          reasons: [
            "It's important work that still needs a clean slot this week.",
          ],
          taskId: "task-2",
        },
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 61,
          reasons: ["It keeps the campaign from drifting."],
          ritualId: "ritual-1",
          epicId: "epic-1",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(result.structuredResponse?.weeklyPlan !== null, true);
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignTitle,
    "Launch prep",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignInterventionLevel,
    "protect",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignHealth
      ?.overdueQuestCount,
    0,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignHealth
      ?.protectedTodayCount,
    0,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.title,
    "Finalize launch checklist",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities.some((quest) =>
      quest.title === "Prep investor notes"
    ),
    true,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.busyDays.includes("Mon"),
    true,
  );
  assertEquals(
    (result.structuredResponse?.weeklyPlan?.openDays.length ?? 0) > 0,
    true,
  );
  assertStringIncludes(result.reply, "Launch prep");
  assertStringIncludes(result.reply, "Deadline in 6 days");
});

Deno.test("plan_week uses recent completed campaign work to back quiet-day health", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Draft episode teaser",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Podcast launch",
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Podcast launch",
          score: 81,
          reasons: ["This is the campaign to keep alive this week."],
          epicId: "epic-1",
        },
        {
          id: "task:task-1",
          kind: "task",
          title: "Draft episode teaser",
          score: 77,
          reasons: ["It is the clearest follow-up after the recent progress."],
          taskId: "task-1",
          epicId: "epic-1",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignTitle,
    "Podcast launch",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignStatus,
    "drifting",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignInterventionLevel,
    "nudge",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignHealth
      ?.daysWithoutMomentum,
    1,
  );
});

Deno.test("plan_week defines the next step when recent campaign progress has no linked follow-up quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-week-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [],
      recentCompletedTasks: [
        {
          id: "task-week-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-week-followup-1",
          epicTitle: "Podcast launch",
        },
        {
          id: "task-week-followup-history-1",
          title: "Define next step for Podcast launch",
          taskDate: "2026-04-10",
          scheduledTime: "10:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-10T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-week-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-week-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 81,
          reasons: [
            "This campaign has momentum, but it needs its next step defined.",
          ],
          epicId: "epic-week-followup-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-21",
            totalMinutes: 45,
            taskCount: 1,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-21"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-21",
            time: "11:00",
            endTime: "11:30",
            score: 88,
            reason: "Good weekly slot for defining the next move.",
          },
        ],
        moveSuggestions: [],
        summary: "Monday has room for one campaign-defining move.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(result.structuredResponse?.intent.intentType, "quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, true);
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.weeklyPlan?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]
      ?.estimatedDurationMinutes,
    30,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignStatus,
    "drifting",
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
        taskDate?: string | null;
        scheduledTime?: string | null;
      }
    ).estimatedDuration,
    30,
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
        taskDate?: string | null;
        scheduledTime?: string | null;
      }
    ).difficulty,
    "medium",
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
        taskDate?: string | null;
        scheduledTime?: string | null;
      }
    ).taskDate,
    "2026-04-21",
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
        taskDate?: string | null;
        scheduledTime?: string | null;
      }
    ).scheduledTime,
    "11:00",
  );
});

Deno.test("plan_week keeps read-only secondary follow-up-definition moves small", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-week-focus-1",
          title: "Client pipeline",
          endDate: "2026-05-02",
          progressPercentage: 66,
          daysRemaining: 14,
        },
        {
          id: "epic-week-secondary-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [
        {
          id: "task-week-focus-1",
          title: "Send proposal follow-up",
          taskDate: "2026-04-21",
          scheduledTime: "10:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-week-focus-1",
          epicTitle: "Client pipeline",
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-week-secondary-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-week-secondary-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-week-focus-1",
          kind: "epic",
          title: "Client pipeline",
          score: 90,
          reasons: ["This is the campaign to protect first this week."],
          epicId: "epic-week-focus-1",
        },
        {
          id: "task:task-week-focus-1",
          kind: "task",
          title: "Send proposal follow-up",
          score: 86,
          reasons: [
            "It is already the clearest move attached to the focus campaign.",
          ],
          taskId: "task-week-focus-1",
          epicId: "epic-week-focus-1",
          targetDate: "2026-04-21",
          suggestedTime: "10:00",
        },
        {
          id: "epic:epic-week-secondary-1",
          kind: "epic",
          title: "Podcast launch",
          score: 72,
          reasons: [
            "This still needs the next step defined after recent progress.",
          ],
          epicId: "epic-week-secondary-1",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  const secondaryFollowUp = result.structuredResponse?.weeklyPlan?.topPriorities
    .find(
      (quest) => quest.title === "Define next step for Podcast launch",
    );
  assertEquals(Boolean(secondaryFollowUp), true);
  assertEquals(secondaryFollowUp?.proposalId ?? null, null);
  assertEquals(secondaryFollowUp?.estimatedDurationMinutes, 20);
  assertEquals(secondaryFollowUp?.estimatedDuration, "20 min");
});

Deno.test("plan_week keeps ritual priorities at the ritual's estimated duration", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [{
        id: "epic-week-ritual-1",
        title: "Website relaunch",
        endDate: "2026-05-01",
        progressPercentage: 30,
        habitCount: 1,
      }],
      tasks: [
        {
          id: "task-week-ritual-support-1",
          title: "Review relaunch notes",
          taskDate: "2026-04-18",
          scheduledTime: "09:30",
          estimatedDuration: 20,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-week-ritual-1",
          epicTitle: "Website relaunch",
        },
      ],
      rituals: [
        {
          id: "ritual-week-1",
          epicId: "epic-week-ritual-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "10:30",
          currentStreak: 3,
          estimatedMinutes: 45,
        },
      ],
      priorityScores: [
        {
          id: "ritual:ritual-week-1",
          kind: "ritual",
          title: "Morning review",
          score: 78,
          reasons: [
            "This ritual is the easiest way to keep the relaunch alive.",
          ],
          ritualId: "ritual-week-1",
          epicId: "epic-week-ritual-1",
          targetDate: "2026-04-21",
          suggestedTime: "10:30",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: ["2026-04-21"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "The week has room to keep the ritual alive.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.title,
    "Keep Morning review",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]
      ?.estimatedDurationMinutes,
    45,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.estimatedDuration,
    "45 min",
  );
});

Deno.test("plan_week escalates a deeply stuck campaign into a must-priority reset move", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-week-reset-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-week-reset-1",
          title: "Build full course sales page",
          taskDate: "2026-04-10",
          scheduledTime: null,
          estimatedDuration: 150,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-week-reset-1",
          epicTitle: "Course launch",
          subtaskTitles: [],
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-week-reset-1",
          kind: "epic",
          title: "Course launch",
          score: 78,
          reasons: ["This campaign has been stuck and needs a reset."],
          epicId: "epic-week-reset-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "adjust_campaign_plan");
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.title,
    "Adjust Course launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.weeklyPlan?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.type,
    "must",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignInterventionLevel,
    "reset",
  );
  assertStringIncludes(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.reason ?? "",
    "reset plan this week",
  );
});

Deno.test("plan_week calls out repeated slip when a campaign has overdue work and no recent momentum", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my week",
    horizon: "week",
    sessionState: confirmedPlanningConsent("plan_week", "Plan my week"),
    plannerContext: {
      starterIntent: "plan_week",
      activeEpics: [
        {
          id: "epic-week-slip-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-week-slip-1",
          title: "Rewrite launch promise",
          taskDate: "2026-04-10",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-week-slip-1",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-week-slip-1",
          kind: "epic",
          title: "Course launch",
          score: 79,
          reasons: ["This campaign has stayed stuck for too long."],
          epicId: "epic-week-slip-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(
    result.structuredResponse?.weeklyPlan?.focusCampaignReason,
    "This campaign has slipped repeatedly without a protected recovery move.",
  );
  assertEquals(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.title,
    "Adjust Course launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.weeklyPlan?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertStringIncludes(
    result.structuredResponse?.weeklyPlan?.topPriorities[0]?.reason ?? "",
    "reset plan this week",
  );
});

Deno.test("briefing_followup returns a reflection bridge into tomorrow", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare me for tomorrow",
    currentDateTime: "2026-04-18T20:30:00-07:00",
    sessionState: confirmedPlanningConsent(
      "briefing_followup",
      "Prepare me for tomorrow",
    ),
    plannerContext: {
      starterIntent: "briefing_followup",
      tasks: [
        {
          id: "task-tomorrow-1",
          title: "Finalize launch checklist",
          taskDate: "2026-04-19",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-04-24",
          progressPercentage: 58,
          daysRemaining: 6,
        },
      ],
      priorityScores: [
        {
          id: "task:task-tomorrow-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 86,
          reasons: ["It is the clearest move to protect first tomorrow."],
          taskId: "task-tomorrow-1",
          epicId: "epic-1",
          targetDate: "2026-04-19",
          suggestedTime: "09:00",
        },
      ],
      reflectionSignals: [
        {
          date: "2026-04-18",
          source: "reflection",
          mood: "steady",
          energy: "medium",
          wins: "Closed the loop on the outline.",
          tomorrowAdjustment:
            "Take a short walk before jumping back into messages.",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-19",
            totalMinutes: 180,
            taskCount: 2,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(result.structuredResponse?.reflectionBridge !== null, true);
  assertEquals(
    result.structuredResponse?.reflectionBridge?.carryForward,
    "Take a short walk before jumping back into messages.",
  );
  assertEquals(
    result.structuredResponse?.reflectionBridge?.tomorrowSummary,
    "light",
  );
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.title,
    "Finalize launch checklist",
  );
  assertEquals(
    result.structuredResponse?.reflectionBridge?.tomorrowSchedule[0]?.title,
    "Finalize launch checklist",
  );
  assertStringIncludes(result.reply, "Take a short walk");
});

Deno.test("briefing_followup names the campaign pressure to carry into tomorrow when no reflection handoff exists", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare me for tomorrow",
    currentDateTime: "2026-04-18T20:30:00-07:00",
    sessionState: confirmedPlanningConsent(
      "briefing_followup",
      "Prepare me for tomorrow",
    ),
    plannerContext: {
      starterIntent: "briefing_followup",
      activeEpics: [
        {
          id: "epic-tomorrow-1",
          title: "Launch prep",
          endDate: "2026-04-21",
          progressPercentage: 24,
          daysRemaining: 3,
        },
      ],
      tasks: [
        {
          id: "task-carry-1",
          title: "Finalize launch checklist",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-tomorrow-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-tomorrow-1",
          kind: "epic",
          title: "Launch prep",
          score: 89,
          reasons: ["Launch prep is too close to ignore tomorrow."],
          epicId: "epic-tomorrow-1",
        },
        {
          id: "task:task-carry-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 82,
          reasons: ["This is the fastest campaign move to protect next."],
          taskId: "task-carry-1",
          epicId: "epic-tomorrow-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-19",
            totalMinutes: 60,
            taskCount: 1,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.title,
    "Finalize launch checklist",
  );
  assertStringIncludes(result.reply, "Launch prep");
  assertStringIncludes(result.reply, "Deadline in 3 days");
});

Deno.test("briefing_followup treats a deeply stuck campaign as a reset move for tomorrow", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare me for tomorrow",
    currentDateTime: "2026-04-18T20:30:00-07:00",
    sessionState: confirmedPlanningConsent(
      "briefing_followup",
      "Prepare me for tomorrow",
    ),
    plannerContext: {
      starterIntent: "briefing_followup",
      activeEpics: [
        {
          id: "epic-tomorrow-reset-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-tomorrow-reset-1",
          title: "Build full course sales page",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 150,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-tomorrow-reset-1",
          epicTitle: "Course launch",
          subtaskTitles: [],
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-tomorrow-reset-history-1",
          title: "Break down Build full course sales page",
          taskDate: "2026-04-16",
          scheduledTime: "09:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T17:00:00.000Z",
          priority: "medium",
          epicId: "epic-tomorrow-reset-1",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-tomorrow-reset-1",
          kind: "epic",
          title: "Course launch",
          score: 78,
          reasons: ["This campaign has been stuck and needs a reset."],
          epicId: "epic-tomorrow-reset-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-19",
            totalMinutes: 60,
            taskCount: 1,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.title,
    "Break down Build full course sales page",
  );
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.type,
    "must",
  );
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction
      ?.estimatedDurationMinutes,
    30,
  );
  assertStringIncludes(result.reply, "campaign to reset tomorrow");
  assertStringIncludes(
    result.structuredResponse?.reflectionBridge?.firstAction?.reason ?? "",
    "restart this campaign tomorrow",
  );
});

Deno.test("briefing_followup carries repeated slip into tomorrow when overdue campaign work stayed stuck", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare me for tomorrow",
    currentDateTime: "2026-04-18T20:30:00-07:00",
    sessionState: confirmedPlanningConsent(
      "briefing_followup",
      "Prepare me for tomorrow",
    ),
    plannerContext: {
      starterIntent: "briefing_followup",
      activeEpics: [
        {
          id: "epic-tomorrow-slip-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-tomorrow-slip-1",
          title: "Rewrite launch promise",
          taskDate: "2026-04-10",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-tomorrow-slip-1",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-tomorrow-slip-1",
          kind: "epic",
          title: "Course launch",
          score: 79,
          reasons: ["This campaign has stayed stuck for too long."],
          epicId: "epic-tomorrow-slip-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-19",
            totalMinutes: 60,
            taskCount: 1,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.title,
    "Adjust Course launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.reflectionBridge?.firstAction?.proposalId,
    ),
    true,
  );
  assertStringIncludes(
    result.reply,
    "slipped repeatedly without a protected recovery move",
  );
  assertStringIncludes(
    result.structuredResponse?.reflectionBridge?.firstAction?.reason ?? "",
    "slipped repeatedly without a protected recovery move",
  );
});

Deno.test("briefing_followup drafts a tomorrow follow-up quest when recent campaign progress has no linked next step", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Prepare me for tomorrow",
    currentDateTime: "2026-04-18T20:30:00-07:00",
    sessionState: confirmedPlanningConsent(
      "briefing_followup",
      "Prepare me for tomorrow",
    ),
    plannerContext: {
      starterIntent: "briefing_followup",
      activeEpics: [
        {
          id: "epic-tomorrow-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [],
      recentCompletedTasks: [
        {
          id: "task-tomorrow-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-tomorrow-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-tomorrow-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but tomorrow needs a clear follow-up move.",
          ],
          epicId: "epic-tomorrow-followup-1",
        },
      ],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-19",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-19",
            time: "09:30",
            endTime: "10:00",
            score: 84,
            reason: "Open slot for a clean next-step definition.",
          },
        ],
        moveSuggestions: [],
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(result.structuredResponse?.intent.intentType, "quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, true);
  assertEquals(
    result.structuredResponse?.reflectionBridge?.firstAction?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.reflectionBridge?.firstAction?.proposalId,
    ),
    true,
  );
  assertEquals(
    (result.proposals[0]?.payload as { taskDate?: string }).taskDate,
    "2026-04-19",
  );
  assertStringIncludes(
    result.structuredResponse?.reflectionBridge?.firstAction?.reason ?? "",
    "define the next step before the momentum fades",
  );
});

Deno.test("upcoming_start can surface a campaign move before the next event", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-campaign-next",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 32,
          daysRemaining: 24,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T18:00:00.000Z",
          end: "2026-04-18T19:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today has room before the afternoon.",
      },
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 88,
          reasons: ["This campaign is starting to slip."],
          epicId: "epic-a",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Outline webinar promise",
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "before Therapy",
  );
});

Deno.test("upcoming_start defines the next step before the next event when recent campaign progress has no linked follow-up quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-upcoming-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-upcoming-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      activeEpics: [
        {
          id: "epic-upcoming-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-followup-1",
          title: "Therapy",
          start: "2026-04-18T18:00:00.000Z",
          end: "2026-04-18T19:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "10:45",
            score: 88,
            reason: "Open slot for a quick campaign follow-up before Therapy.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room before the afternoon.",
      },
      priorityScores: [
        {
          id: "epic:epic-upcoming-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-upcoming-followup-1",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.plannerContract?.mode, "schedule_read");
  assertEquals(result.plannerContract?.writePolicy, "read_only");
  assertEquals(result.proposals.length, 0);
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction
      ?.estimatedDurationMinutes,
    15,
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(result.structuredResponse?.comingUp?.nextBestAction?.proposalId),
    false,
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "before Therapy",
  );
});

Deno.test("upcoming_start keeps a campaign follow-up read-only when there is no clean slot before the next event", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-upcoming-followup-readonly-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-upcoming-followup-readonly-1",
          epicTitle: "Podcast launch",
        },
      ],
      activeEpics: [
        {
          id: "epic-upcoming-followup-readonly-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-followup-readonly-1",
          title: "Therapy",
          start: "2026-04-18T18:00:00.000Z",
          end: "2026-04-18T19:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary:
          "Today has room before the afternoon, but no clean slot is pinned down.",
      },
      priorityScores: [
        {
          id: "epic:epic-upcoming-followup-readonly-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-upcoming-followup-readonly-1",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "conversation");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.proposalId ?? null,
    null,
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "before Therapy",
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "there isn't a clean slot to schedule it automatically",
  );
});

Deno.test("upcoming_start resets the campaign plan before the next event when there is no concrete next step at all", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [],
      activeEpics: [
        {
          id: "epic-upcoming-reset-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 24,
          daysRemaining: 18,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-reset-1",
          title: "Therapy",
          start: "2026-04-18T18:00:00.000Z",
          end: "2026-04-18T19:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today has room before the afternoon.",
      },
      priorityScores: [
        {
          id: "epic:epic-upcoming-reset-1",
          kind: "epic",
          title: "Podcast launch",
          score: 82,
          reasons: [
            "This campaign has no concrete next step and needs a reset move.",
          ],
          epicId: "epic-upcoming-reset-1",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.plannerContract?.mode, "schedule_read");
  assertEquals(result.plannerContract?.writePolicy, "read_only");
  assertEquals(result.proposals.length, 0);
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Adjust Podcast launch",
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction
      ?.estimatedDurationMinutes,
    20,
  );
  assertEquals(
    Boolean(result.structuredResponse?.comingUp?.nextBestAction?.proposalId),
    false,
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "before Therapy",
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "resetting the campaign plan",
  );
});

Deno.test("upcoming_start does not overfill a too-short gap before the next event", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:50:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      recentCompletedTasks: [
        {
          id: "task-upcoming-short-gap-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-upcoming-short-gap-1",
          epicTitle: "Podcast launch",
        },
      ],
      activeEpics: [
        {
          id: "epic-upcoming-short-gap-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-upcoming-short-gap-1",
          title: "Therapy",
          start: "2026-04-18T10:00:00-07:00",
          end: "2026-04-18T11:00:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "10:45",
            score: 88,
            reason: "Open slot for a quick campaign follow-up.",
          },
        ],
        moveSuggestions: [],
        summary: "You only have a short gap before Therapy.",
      },
      priorityScores: [
        {
          id: "epic:epic-upcoming-short-gap-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-upcoming-short-gap-1",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.comingUp?.nextBestAction, null);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Therapy");
});

Deno.test("treats the make-room starter like a read-only prioritization view", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    parsedInput: {
      text: "Help me make room for what matters.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "12:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Here's what I would protect first");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Top ranked next moves");
  assertStringIncludes(result.reply, "Workout");
  assertEquals(result.structuredResponse?.priorityOverview?.title, "Make Room");
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Workout",
  );
});

Deno.test("make_room surfaces campaign pressure when too many campaigns are competing", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    parsedInput: {
      text: "Help me make room for what matters.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-compete-1",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 38,
          daysRemaining: 24,
        },
        {
          id: "epic-b",
          title: "Podcast relaunch",
          endDate: "2026-05-20",
          progressPercentage: 44,
          daysRemaining: 32,
        },
        {
          id: "epic-c",
          title: "Client pipeline",
          endDate: "2026-05-01",
          progressPercentage: 52,
          daysRemaining: 13,
        },
        {
          id: "epic-d",
          title: "Personal brand",
          endDate: "2026-06-01",
          progressPercentage: 18,
          daysRemaining: 44,
        },
      ],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 80,
          reasons: [
            "This campaign matters, but your attention is split too many ways.",
          ],
          epicId: "epic-a",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertStringIncludes(result.reply, "Campaign pressure: Course launch is");
  assertStringIncludes(
    result.reply,
    "Too many active campaigns are competing right now",
  );
  assertStringIncludes(result.reply, "Outline webinar promise");
  assertStringIncludes(
    result.structuredResponse?.priorityOverview?.campaignPressure ?? "",
    "Too many active campaigns are competing right now",
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Outline webinar promise",
  );
});

Deno.test("what_matters keeps slipping campaign task urgency in the ranked summary", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What matters most today?",
    sessionState: confirmedPlanningConsent(
      "what_matters",
      "What matters most today?",
    ),
    parsedInput: {
      text: "What matters most today?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-what-matters-1",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-what-matters-1",
          epicTitle: "Course launch",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-what-matters-1",
          title: "Course launch",
          endDate: "2026-04-21",
          progressPercentage: 22,
          daysRemaining: 3,
        },
      ],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today has room for one strong move.",
      },
      priorityScores: [
        {
          id: "task:task-what-matters-1",
          kind: "task",
          title: "Outline webinar promise",
          score: 74,
          reasons: ["This matters, but it still needs a clean slot."],
          taskId: "task-what-matters-1",
          epicId: "epic-what-matters-1",
        },
      ],
      starterIntent: "what_matters",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertStringIncludes(result.reply, "here's what matters most");
  assertStringIncludes(result.reply, "Outline webinar promise");
  assertStringIncludes(result.reply, "Deadline in 3 days");
  assertStringIncludes(result.reply, "clearest move to protect next");
  assertEquals(
    result.structuredResponse?.priorityOverview?.title,
    "What Matters",
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Outline webinar promise",
  );
});

Deno.test("what_matters recommends adjusting the campaign when repeated slip makes another task the wrong move", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What matters most today?",
    sessionState: confirmedPlanningConsent(
      "what_matters",
      "What matters most today?",
    ),
    parsedInput: {
      text: "What matters most today?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      activeEpics: [
        {
          id: "epic-what-adjust-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-what-adjust-1",
          title: "Rewrite launch promise",
          taskDate: "2026-04-10",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-what-adjust-1",
          epicTitle: "Course launch",
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-what-adjust-history-1",
          title: "Adjust Course launch",
          taskDate: "2026-04-08",
          scheduledTime: "09:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-08T17:00:00.000Z",
          priority: "medium",
          epicId: "epic-what-adjust-1",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-what-adjust-1",
          kind: "epic",
          title: "Course launch",
          score: 81,
          reasons: ["This campaign has stayed stuck for too long."],
          epicId: "epic-what-adjust-1",
        },
      ],
      starterIntent: "what_matters",
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertStringIncludes(
    result.structuredResponse?.priorityOverview?.campaignPressure ?? "",
    "adjust the campaign plan before adding more work",
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.focusCampaignTitle,
    "Course launch",
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.focusCampaignInterventionLevel,
    "reset",
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.focusCampaignHealth
      ?.daysWithoutMomentum,
    8,
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Adjust Course launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.priorityOverview?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]
      ?.estimatedDurationMinutes,
    30,
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
      }
    ).estimatedDuration,
    30,
  );
  assertStringIncludes(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.reason ?? "",
    "reset plan",
  );
});

Deno.test("what_matters drafts a next-step quest when recent campaign progress has no linked follow-up quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What matters most today?",
    sessionState: confirmedPlanningConsent(
      "what_matters",
      "What matters most today?",
    ),
    parsedInput: {
      text: "What matters most today?",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      activeEpics: [
        {
          id: "epic-what-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [],
      recentCompletedTasks: [
        {
          id: "task-what-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-what-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-what-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-what-followup-1",
        },
      ],
      starterIntent: "what_matters",
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, true);
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.priorityOverview?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertStringIncludes(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.reason ?? "",
    "Recent campaign progress needs a concrete follow-up quest",
  );
});

Deno.test("make_room drafts a next-step quest when recent campaign progress has no linked follow-up quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    sessionState: confirmedPlanningConsent(
      "make_room",
      "Help me make room for what matters.",
    ),
    parsedInput: {
      text: "Help me make room for what matters.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      activeEpics: [
        {
          id: "epic-make-room-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [],
      recentCompletedTasks: [
        {
          id: "task-make-room-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-make-room-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-make-room-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-make-room-followup-1",
        },
      ],
      starterIntent: "make_room",
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, true);
  assertEquals(result.structuredResponse?.priorityOverview?.title, "Make Room");
  assertEquals(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.title,
    "Define next step for Podcast launch",
  );
  assertEquals(
    Boolean(
      result.structuredResponse?.priorityOverview?.topPriorities[0]?.proposalId,
    ),
    true,
  );
  assertStringIncludes(
    result.structuredResponse?.priorityOverview?.topPriorities[0]?.reason ?? "",
    "Recent campaign progress needs a concrete follow-up quest",
  );
});

Deno.test("make_room follow-up proposals shrink to fit a short suggested slot", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    sessionState: confirmedPlanningConsent(
      "make_room",
      "Help me make room for what matters.",
    ),
    parsedInput: {
      text: "Help me make room for what matters.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      activeEpics: [
        {
          id: "epic-make-room-slot-followup-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      tasks: [],
      recentCompletedTasks: [
        {
          id: "task-make-room-slot-followup-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-make-room-slot-followup-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-make-room-slot-followup-1",
          kind: "epic",
          title: "Podcast launch",
          score: 80,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-make-room-slot-followup-1",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 10,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "10:40",
            score: 83,
            reason: "Tiny opening for a quick next-step anchor.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has one short opening.",
      },
      starterIntent: "make_room",
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(
    (result.proposals[0]?.payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    10,
  );
});

Deno.test("uses witty_sassy voice for empty-day route reads", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    tonePack: "witty_sassy",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 0,
          taskCount: 0,
          status: "open",
        }],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today is open.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.reply, "Today: nothing scheduled.");
});

Deno.test("uses witty_sassy voice for make-room reads on light days", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    tonePack: "witty_sassy",
    parsedInput: {
      text: "Help me make room for what matters.",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "12:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 45,
          taskCount: 1,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [{
          date: "2026-04-18",
          time: "09:00",
          endTime: "11:00",
          score: 90,
          reason: "Plenty of room left.",
        }],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertStringIncludes(result.reply, "Here's what I would protect first");
  assertStringIncludes(result.reply, "Top ranked next moves");
  assertStringIncludes(result.reply, "Workout");
});

Deno.test("answers the coming-up starter prompt with a schedule summary", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T12:30:00-07:00",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "15:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
        {
          id: "task-2",
          title: "Inbox cleanup",
          taskDate: "2026-04-19",
          scheduledTime: "09:30",
          estimatedDuration: 30,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T14:00:00.000Z",
          end: "2026-04-18T15:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
  assertEquals(result.reply.includes("Week ahead:"), false);
});

Deno.test("answers a typoed coming-up prompt with the same schedule summary", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I hgave coming up?",
    currentDateTime: "2026-04-18T20:32:00-07:00",
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("answers availability questions using both quests and calendar events", () => {
  const result = buildPlannerResponse(baseInput({
    message: "When am I free tomorrow afternoon?",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Deep work",
          taskDate: "2026-04-19",
          scheduledTime: "13:00",
          estimatedDuration: 60,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Doctor",
          start: "2026-04-19T22:00:00.000Z",
          end: "2026-04-19T23:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "21:00",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "Tomorrow");
  assertStringIncludes(result.reply, "afternoon");
  assertStringIncludes(result.reply, "pm");
});

Deno.test("prepares a direct quest move without asking for a time reason when the time is explicit", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move my workout quest to 6 pm",
    parsedInput: {
      text: "Move my workout quest",
      scheduledTime: "18:00",
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout quest",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("creates one proposal per quest for batch rescheduling", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move the rest of my quests to tomorrow",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
        {
          id: "task-2",
          title: "Newsletter",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 60,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 2);
  assertEquals(
    result.proposals.every((proposal) => proposal.kind === "update_quest"),
    true,
  );
  assertEquals(
    result.proposals.every((proposal) => proposal.readyToConfirm),
    true,
  );
});

Deno.test("returns an adjust campaign proposal for complex campaign changes", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "Push Campaign Aurora by two weeks and remove the least important ritual",
    classificationHint: {
      type: "epic",
      confidence: 0.95,
      reasoning: "Campaign adjustment",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-1",
        title: "Campaign Aurora",
        endDate: "2026-06-01",
      }],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Campaign Aurora",
          title: "Practice",
          frequency: "daily",
          preferredTime: "09:00",
        },
      ],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.proposals[0].summary, "Campaign Aurora");
});

Deno.test("explains that external calendar events are read-only when asked to edit one", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move my dentist appointment to 4 pm",
    parsedInput: {
      text: "Move my dentist appointment",
      scheduledTime: "16:00",
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: null,
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Dentist appointment",
          start: "2026-04-18T22:00:00.000Z",
          end: "2026-04-18T23:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "read-only");
});

Deno.test("handles non-planning conversation without creating proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm feeling behind and I need help thinking clearly.",
    classificationHint: {
      type: "brain-dump",
      confidence: 0.9,
      reasoning: "User is processing emotions, not asking for a saved action.",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "I'm here with you");
});

Deno.test("uses witty_sassy voice for conversational planner replies", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm feeling behind and I need help thinking clearly.",
    tonePack: "witty_sassy",
    classificationHint: {
      type: "brain-dump",
      confidence: 0.9,
      reasoning: "User is processing emotions, not asking for a saved action.",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "I'm with you");
  assertStringIncludes(result.reply, "point at the bullshit");
});

Deno.test("uses witty_sassy voice for proposal replies without implying the draft is already saved", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Call mom",
    tonePack: "witty_sassy",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.reply, "spare me the fake ceremony");
  assertEquals(result.reply.includes("already saved"), false);
});

Deno.test("advance_campaign_start surfaces the clearest existing campaign step when momentum is already moving", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-05-05",
          progressPercentage: 62,
          daysRemaining: 17,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Finalize launch checklist",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 88,
          reasons: ["Launch prep has real leverage this week."],
          epicId: "epic-1",
        },
        {
          id: "task:task-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 82,
          reasons: ["It's already lined up for today and moves the campaign."],
          taskId: "task-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(
    result.structuredResponse?.campaignMomentum?.campaignTitle,
    "Launch prep",
  );
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "moving");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "steady",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.nextStep?.title,
    "Finalize launch checklist",
  );
});

Deno.test("advance_campaign_start uses recent completed campaign work as real momentum", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-05-05",
          progressPercentage: 58,
          daysRemaining: 17,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Finalize launch checklist",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-done-1",
          title: "Outline launch sequence",
          taskDate: "2026-04-16",
          scheduledTime: "10:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-16T15:00:00.000Z",
          priority: "medium",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 84,
          reasons: ["Launch prep is still worth protecting this week."],
          epicId: "epic-1",
        },
        {
          id: "task:task-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 78,
          reasons: ["It is the cleanest follow-up after the recent progress."],
          taskId: "task-1",
          epicId: "epic-1",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "drifting");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "nudge",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.healthSnapshot
      ?.daysWithoutMomentum,
    2,
  );
});

Deno.test("advance_campaign_start treats a recent win without a linked follow-up as drifting, not stalled", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-05-05",
          progressPercentage: 54,
          daysRemaining: 17,
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-done-1",
          title: "Finalize launch checklist",
          taskDate: "2026-04-17",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T16:00:00.000Z",
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 82,
          reasons: [
            "This campaign still matters and needs a clean follow-up move.",
          ],
          epicId: "epic-1",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "11:00",
            endTime: "11:30",
            score: 88,
            reason: "Open slot for a clean follow-up move.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room for one follow-up move.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.structuredResponse?.intent.intentType, "quest");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, true);
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "drifting");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "nudge",
  );
  assertStringIncludes(
    result.structuredResponse?.campaignMomentum?.statusReason ?? "",
    "recent progress",
  );
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertStringIncludes(result.proposals[0]?.summary ?? "", "Define next step");
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
      }
    ).estimatedDuration,
    20,
  );
  assertEquals(
    (
      result.proposals[0]?.payload as {
        estimatedDuration?: number | null;
        difficulty?: string | null;
      }
    ).difficulty,
    "medium",
  );
});

Deno.test("advance_campaign_start protects a near-deadline recent win with a next step instead of resetting the campaign", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-04-23",
          progressPercentage: 64,
          daysRemaining: 5,
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-done-1",
          title: "Finalize webinar outline",
          taskDate: "2026-04-17",
          scheduledTime: "10:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 87,
          reasons: [
            "The deadline is close and this campaign still needs a protected follow-up step.",
          ],
          epicId: "epic-1",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 90,
            taskCount: 1,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "14:00",
            endTime: "14:30",
            score: 90,
            reason: "Clean slot for the campaign follow-up move.",
          },
        ],
        moveSuggestions: [],
        summary: "There is still room to protect one launch move today.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "at_risk");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "protect",
  );
  assertStringIncludes(
    result.structuredResponse?.campaignMomentum?.statusReason ?? "",
    "recent progress",
  );
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertStringIncludes(result.proposals[0]?.summary ?? "", "Define next step");
});

Deno.test("advance_campaign_start drafts a next quest when a campaign is stalled", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-2",
          title: "Summer cut",
          endDate: "2026-05-02",
          progressPercentage: 18,
          daysRemaining: 14,
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-2",
          epicTitle: "Summer cut",
          title: "Morning weigh-in",
          frequency: "daily",
          preferredTime: "08:00",
          estimatedMinutes: 45,
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-2",
          kind: "epic",
          title: "Summer cut",
          score: 79,
          reasons: ["This campaign has slipped and needs one clean move."],
          epicId: "epic-2",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "11:00",
            endTime: "11:30",
            score: 91,
            reason: "Open slot for a clean next move.",
          },
        ],
        moveSuggestions: [],
        summary: "Today is open enough for one focused campaign step.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(
    result.structuredResponse?.campaignMomentum?.campaignTitle,
    "Summer cut",
  );
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "stalled");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "reset",
  );
  assertStringIncludes(result.proposals[0].title, "Summer cut");
  assertEquals(
    (result.proposals[0].payload as { epicId?: string | null }).epicId,
    "epic-2",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]?.title,
    "Keep Morning weigh-in",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]
      ?.estimatedDurationMinutes,
    45,
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]
      ?.estimatedDuration,
    "45 min",
  );
});

Deno.test("advance_campaign_start shrinks follow-up proposals to fit a short suggested slot", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-advance-slot-1",
          title: "Podcast launch",
          endDate: "2026-05-06",
          progressPercentage: 52,
          daysRemaining: 18,
        },
      ],
      recentCompletedTasks: [
        {
          id: "task-advance-slot-done-1",
          title: "Pick launch artwork",
          taskDate: "2026-04-17",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: true,
          completedAt: "2026-04-17T18:00:00.000Z",
          priority: "medium",
          epicId: "epic-advance-slot-1",
          epicTitle: "Podcast launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-advance-slot-1",
          kind: "epic",
          title: "Podcast launch",
          score: 79,
          reasons: [
            "This campaign has momentum, but the next move is still undefined.",
          ],
          epicId: "epic-advance-slot-1",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 10,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "11:00",
            endTime: "11:10",
            score: 91,
            reason: "Tiny opening for a quick next-step anchor.",
          },
        ],
        moveSuggestions: [],
        summary: "Today is open enough for one very short next-step move.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(
    (result.proposals[0]?.payload as { estimatedDuration?: number | null })
      .estimatedDuration,
    10,
  );
});

Deno.test("advance_campaign_start drafts a campaign adjustment when pressure is severe", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-3",
          title: "Founder relaunch",
          endDate: "2026-04-21",
          progressPercentage: 22,
          daysRemaining: 3,
        },
      ],
      tasks: [
        {
          id: "task-risk-1",
          title: "Rewrite relaunch offer",
          taskDate: "2026-04-16",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
        },
        {
          id: "task-risk-2",
          title: "Tighten launch CTA",
          taskDate: "2026-04-17",
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
        },
      ],
      rituals: [
        {
          id: "ritual-risk-1",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
          title: "Daily metrics check",
          frequency: "daily",
          preferredTime: "09:00",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-3",
          kind: "epic",
          title: "Founder relaunch",
          score: 93,
          reasons: [
            "The deadline is extremely close and this campaign is slipping.",
          ],
          epicId: "epic-3",
        },
        {
          id: "task:task-risk-1",
          kind: "task",
          title: "Rewrite relaunch offer",
          score: 84,
          reasons: ["This is the highest leverage campaign task left."],
          taskId: "task-risk-1",
          epicId: "epic-3",
          targetDate: "2026-04-16",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.structuredResponse?.intent.intentType, "campaign");
  assertEquals(result.structuredResponse?.intent.shouldCreateQuest, false);
  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "at_risk");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "reset",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal === "Deadline in 3 days."),
    true,
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal.includes("overdue quests")),
    true,
  );
  assertStringIncludes(
    result.structuredResponse?.campaignMomentum?.nextStep?.title ?? "",
    "Adjust Founder relaunch",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]?.title,
    "Rewrite relaunch offer",
  );
});

Deno.test("advance_campaign_start shrinks oversized campaign work into a smaller first move", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-4",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 34,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-big-1",
          title: "Build full course sales page",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 150,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-4",
          epicTitle: "Course launch",
          subtaskTitles: [],
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-4",
          kind: "epic",
          title: "Course launch",
          score: 76,
          reasons: ["This campaign needs a smaller concrete move."],
          epicId: "epic-4",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "13:00",
            endTime: "13:30",
            score: 88,
            reason: "Open slot for a first-pass breakdown.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room for a smaller campaign move.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "stalled");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "reset",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal.includes("too large to start cleanly")),
    true,
  );
  assertStringIncludes(
    result.proposals[0].title,
    "Break down Build full course sales page",
  );
});

Deno.test("advance_campaign_start can recommend a campaign adjustment when too many campaigns are competing", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 38,
          daysRemaining: 24,
        },
        {
          id: "epic-b",
          title: "Podcast relaunch",
          endDate: "2026-05-20",
          progressPercentage: 44,
          daysRemaining: 32,
        },
        {
          id: "epic-c",
          title: "Client pipeline",
          endDate: "2026-05-01",
          progressPercentage: 52,
          daysRemaining: 13,
        },
        {
          id: "epic-d",
          title: "Personal brand",
          endDate: "2026-06-01",
          progressPercentage: 18,
          daysRemaining: 44,
        },
      ],
      tasks: [
        {
          id: "task-compete-1",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 80,
          reasons: [
            "This campaign matters, but your attention is split too many ways.",
          ],
          epicId: "epic-a",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "reset",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal.includes("4 active campaigns")),
    true,
  );
  assertStringIncludes(
    (result.proposals[0].payload as { reason?: string }).reason ?? "",
    "too many active campaigns",
  );
});

Deno.test("advance_campaign_start escalates a deeply stalled campaign into a plan adjustment", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    sessionState: confirmedPlanningConsent(
      "advance_campaign_start",
      "Advance my campaign",
    ),
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-reset-2",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 24,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-reset-2",
          title: "Build full course sales page",
          taskDate: "2026-04-10",
          scheduledTime: null,
          estimatedDuration: 150,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-reset-2",
          epicTitle: "Course launch",
          subtaskTitles: [],
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-reset-2",
          kind: "epic",
          title: "Course launch",
          score: 78,
          reasons: [
            "This campaign has been stuck and needs a reset, not a bigger push.",
          ],
          epicId: "epic-reset-2",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "stalled");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.interventionLevel,
    "reset",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.healthSnapshot
      ?.daysWithoutMomentum,
    8,
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal.includes("last 8 days")),
    true,
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) =>
      signal.includes("slipped repeatedly without a protected recovery move")
    ),
    true,
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.pressureSignals.some((
      signal,
    ) => signal.includes("too large to start cleanly")),
    true,
  );
  assertStringIncludes(result.reply, "slipped more than once");
  assertStringIncludes(
    (result.proposals[0].payload as { requestedSummary?: string })
      .requestedSummary ?? "",
    "smaller recovery move this week",
  );
  assertStringIncludes(
    result.structuredResponse?.campaignMomentum?.nextStep?.title ?? "",
    "Adjust Course launch",
  );
});
