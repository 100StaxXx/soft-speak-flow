Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message = "Expected values to match"): void {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${JSON.stringify(actual)}`);
  }
}

const baseContext = {
  userId: "user-1",
  taskId: "task-1",
  completionSource: "quest",
  title: "Portfolio session",
  campaignTitle: "Launch Week",
  completedAt: "2026-04-29T16:00:00.000Z",
  timezone: "America/Los_Angeles",
  localDate: "2026-04-29",
  localHour: 9,
  localMinute: 0,
  scheduledTime: "08:30",
  taskDate: "2026-04-29",
  difficulty: "medium",
  category: "mind",
  isRitual: false,
  isMainQuest: false,
  wasOverdue: false,
  firstCompletionToday: false,
  firstRitualToday: false,
  completedAllRituals: false,
  currentStreak: 2,
  recentMissedTasks: 0,
  incompleteToday: 1,
  completedToday: 2,
  totalToday: 3,
  isOverloaded: false,
  isBuildingMomentum: false,
  isLateNight: false,
  isDifficult: false,
  mentor: null,
};

function createSupabaseHarness(options: {
  task?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  todayTasks?: Array<Record<string, unknown>>;
  completedAtTasks?: Array<Record<string, unknown>>;
  missedCount?: number;
  mentor?: Record<string, unknown> | null;
} = {}) {
  const todayTasks = options.todayTasks ?? [
    { id: "task-1", completed: true, completed_at: "2026-04-29T16:00:00.000Z" },
    { id: "task-2", completed: true, completed_at: "2026-04-29T15:00:00.000Z" },
    { id: "task-3", completed: false, completed_at: null },
  ];
  const completedAtTasks = options.completedAtTasks ?? todayTasks.filter((entry) => entry.completed_at);

  const defaultTask = {
    id: "task-1",
    task_text: "Portfolio session",
    task_date: "2026-04-29",
    completed: true,
    completed_at: "2026-04-29T16:00:00.000Z",
    scheduled_time: "08:30",
    difficulty: "medium",
    category: "mind",
    habit_source_id: null,
    epic_id: "epic-1",
    is_main_quest: false,
    epics: {
      title: "Launch Week",
      progress_percentage: 20,
      target_days: 14,
      status: "active",
    },
  };

  const defaultProfile = {
    selected_mentor_id: null,
    timezone: "America/Los_Angeles",
    current_habit_streak: 2,
  };

  return {
    from(table: string) {
      const state = {
        table,
        selectOptions: undefined as { count?: string; head?: boolean } | undefined,
        filters: {} as Record<string, unknown>,
      };

      const resolveList = () => {
        if (table === "daily_tasks") {
          if (state.selectOptions?.head) {
            return { data: null, count: options.missedCount ?? 0, error: null };
          }
          if ("gte:completed_at" in state.filters || "lt:completed_at" in state.filters) {
            return { data: completedAtTasks, error: null };
          }
          return { data: todayTasks, error: null };
        }

        if (table === "cost_guardrail_config" || table === "cost_guardrail_state") {
          return { data: [], error: null };
        }

        return { data: [], error: null };
      };

      const builder = {
        select(_columns?: string, opts?: { count?: string; head?: boolean }) {
          state.selectOptions = opts;
          return builder;
        },
        eq(column: string, value: unknown) {
          state.filters[column] = value;
          return builder;
        },
        gte(column: string, value: unknown) {
          state.filters[`gte:${column}`] = value;
          return builder;
        },
        lt(column: string, value: unknown) {
          state.filters[`lt:${column}`] = value;
          return builder;
        },
        in(column: string, value: unknown) {
          state.filters[`in:${column}`] = value;
          return builder;
        },
        insert(_payload: unknown) {
          return Promise.resolve({ data: null, error: null });
        },
        upsert(_payload: unknown) {
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "daily_tasks") {
            return Promise.resolve({ data: options.task === undefined ? defaultTask : options.task, error: null });
          }
          if (table === "profiles") {
            return Promise.resolve({ data: options.profile === undefined ? defaultProfile : options.profile, error: null });
          }
          if (table === "mentors") {
            return Promise.resolve({ data: options.mentor ?? null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) {
          return Promise.resolve(resolveList()).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

const authedDeps = (supabase = createSupabaseHarness(), fetchImpl: typeof fetch = fetch) => ({
  protectRequest: async () => ({
    auth: { userId: "user-1", isServiceRole: false },
    supabase: supabase as any,
    requestId: "req-1",
    ipAddress: "127.0.0.1",
    protection: null,
  }),
  fetchImpl,
  now: () => new Date("2026-04-29T16:00:00.000Z"),
});

const postRequest = (body: unknown) =>
  new Request("http://localhost/functions/v1/generate-completion-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

Deno.test("scoreCompletionSignal marks high-signal completions AI eligible", () => {
  const signal = module.scoreCompletionSignal({
    ...baseContext,
    firstCompletionToday: true,
    recentMissedTasks: 2,
    isDifficult: true,
  } as any);

  assert(signal.aiEligible, "Expected first completion plus recovery to be AI eligible");
  assert(signal.reasons.includes("first_completion_today"), "Expected first completion reason");
  assert(signal.reasons.includes("recovery_after_missed_tasks"), "Expected recovery reason");
});

Deno.test("shouldShowMentor omits mentor when none is selected and caps probability", () => {
  const signal = module.scoreCompletionSignal({
    ...baseContext,
    firstCompletionToday: true,
    completedAllRituals: true,
    recentMissedTasks: 2,
    wasOverdue: true,
    isDifficult: true,
    isBuildingMomentum: true,
    isLateNight: true,
  } as any);

  const withoutMentor = module.shouldShowMentor(baseContext as any, signal);
  assertEquals(withoutMentor.probability, 0, "Expected no mentor probability without selected mentor");

  const withMentor = module.shouldShowMentor({
    ...baseContext,
    firstCompletionToday: true,
    completedAllRituals: true,
    recentMissedTasks: 2,
    wasOverdue: true,
    isDifficult: true,
    isBuildingMomentum: true,
    isLateNight: true,
    mentor: { id: "mentor-1", name: "Aurelius", slug: "wise", tone_description: "calm", style: "wise" },
  } as any, signal);
  assertEquals(withMentor.probability, 0.6, "Expected mentor probability to cap at 60%");
});

Deno.test("buildFallbackFeedback keeps deterministic copy short and contextual", () => {
  const feedback = module.buildFallbackFeedback({
    ...baseContext,
    wasOverdue: true,
  } as any);

  assertEquals(feedback.companion.tone, "recovery");
  assert(feedback.companion.message.includes("Portfolio session"), "Expected task title in fallback");
  assert(feedback.companion.message.length <= 150, "Expected compact fallback message");
});

Deno.test("buildFallbackFeedback uses ritual campaign copy before generic campaign copy", () => {
  const feedback = module.buildFallbackFeedback({
    ...baseContext,
    completionSource: "ritual",
    isRitual: true,
    wasOverdue: false,
    completedAllRituals: false,
  } as any);

  assertEquals(feedback.companion.tone, "locked_in");
  assertEquals(feedback.companion.message, "Portfolio session is complete. Launch Week just moved forward.");
});

Deno.test("generate-completion-feedback passes through auth failures", async () => {
  const response = await module.handleGenerateCompletionFeedback(postRequest({ taskId: "task-1" }), {
    protectRequest: async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    fetchImpl: fetch,
    now: () => new Date("2026-04-29T16:00:00.000Z"),
  });

  assertEquals(response.status, 401);
});

Deno.test("generate-completion-feedback rejects malformed requests", async () => {
  const response = await module.handleGenerateCompletionFeedback(postRequest({ taskId: "" }), authedDeps());
  assertEquals(response.status, 400);
});

Deno.test("generate-completion-feedback hides non-owned task ids", async () => {
  const response = await module.handleGenerateCompletionFeedback(
    postRequest({ taskId: "task-1" }),
    authedDeps(createSupabaseHarness({ task: null })),
  );

  assertEquals(response.status, 404);
});

Deno.test("generate-completion-feedback returns fallback without AI for routine completions", async () => {
  let fetchCalled = false;
  const fetchImpl = (() => {
    fetchCalled = true;
    return Promise.resolve(new Response("{}"));
  }) as typeof fetch;

  const response = await module.handleGenerateCompletionFeedback(
    postRequest({ taskId: "task-1", completionSource: "quest" }),
    authedDeps(createSupabaseHarness(), fetchImpl),
  );

  const json = await response.json();
  assertEquals(response.status, 200);
  assertEquals(fetchCalled, false, "Expected routine completion to avoid live AI");
  assertEquals(json.companion.tone, "proud");
  assertEquals(json.mentor, undefined);
});

Deno.test("generate-completion-feedback counts inbox completions by completed_at local day", async () => {
  const previousKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");
  try {
    let fetchCalled = false;
    const fetchImpl = (() => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}"));
    }) as typeof fetch;

    const response = await module.handleGenerateCompletionFeedback(
      postRequest({ taskId: "task-1", completionSource: "inbox" }),
      authedDeps(createSupabaseHarness({
        task: {
          id: "task-1",
          task_text: "Inbox quest",
          task_date: null,
          completed: true,
          completed_at: "2026-04-29T16:00:00.000Z",
          scheduled_time: null,
          difficulty: "medium",
          category: "mind",
          habit_source_id: null,
          epic_id: null,
          is_main_quest: false,
          epics: null,
        },
        todayTasks: [],
        completedAtTasks: [
          { id: "task-1", completed: true, completed_at: "2026-04-29T16:00:00.000Z" },
          { id: "task-2", completed: true, completed_at: "2026-04-29T15:00:00.000Z" },
          { id: "task-3", completed: true, completed_at: "2026-04-29T14:00:00.000Z" },
        ],
      }), fetchImpl),
    );

    const json = await response.json();
    assertEquals(response.status, 200);
    assertEquals(fetchCalled, false, "Expected repeated inbox completions not to be first-win AI calls");
    assertEquals(json.companion.tone, "locked_in");
    assert(!json.companion.message.includes("First win"), "Expected non-first inbox copy");
  } finally {
    if (previousKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", previousKey);
  }
});

Deno.test("generate-completion-feedback accepts valid AI output for high-signal completions", async () => {
  const previousKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");
  try {
    let fetchCalled = false;
    const fetchImpl = (() => {
      fetchCalled = true;
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              companion: {
                message: "You got the portfolio session done after a packed day.",
                tone: "locked_in",
              },
              mentor: {
                show: true,
                personality: "Disciplined",
                message: "That is the standard. Keep it there.",
              },
            }),
          },
        }],
        usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }) as typeof fetch;

    const response = await module.handleGenerateCompletionFeedback(
      postRequest({ taskId: "task-1", completionSource: "quest" }),
      authedDeps(createSupabaseHarness({
        profile: {
          selected_mentor_id: "mentor-1",
          timezone: "America/Los_Angeles",
          current_habit_streak: 8,
        },
        todayTasks: [
          { id: "task-1", completed: true, completed_at: "2026-04-29T16:00:00.000Z" },
        ],
        mentor: {
          id: "mentor-1",
          name: "Aurelius",
          slug: "disciplined",
          tone_description: "disciplined and elite",
          style: "disciplined",
        },
      }), fetchImpl),
    );

    const json = await response.json();
    assertEquals(response.status, 200);
    assert(fetchCalled, "Expected live AI fetch for high-signal completion");
    assertEquals(json.companion.message, "You got the portfolio session done after a packed day.");
    assertEquals(json.companion.tone, "locked_in");
    assertEquals(json.mentor.message, "That is the standard. Keep it there.");
  } finally {
    if (previousKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", previousKey);
  }
});

Deno.test("generate-completion-feedback suppresses mentor output when no mentor is selected", async () => {
  const previousKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");
  try {
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              companion: {
                message: "First win of the day. Launch moved closer.",
                tone: "proud",
              },
              mentor: {
                show: true,
                personality: "Disciplined",
                message: "This should not render.",
              },
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))) as typeof fetch;

    const response = await module.handleGenerateCompletionFeedback(
      postRequest({ taskId: "task-1", completionSource: "quest" }),
      authedDeps(createSupabaseHarness({
        todayTasks: [
          { id: "task-1", completed: true, completed_at: "2026-04-29T16:00:00.000Z" },
        ],
      }), fetchImpl),
    );

    const json = await response.json();
    assertEquals(response.status, 200);
    assertEquals(json.companion.message, "First win of the day. Launch moved closer.");
    assertEquals(json.mentor, undefined);
  } finally {
    if (previousKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", previousKey);
  }
});

Deno.test("generate-completion-feedback falls back when AI output is invalid", async () => {
  const previousKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");
  try {
    const fetchImpl = (() =>
      Promise.resolve(new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              companion: { message: "Great job.", tone: "corny" },
              mentor: { show: true, personality: "Disciplined", message: "Do it again." },
            }),
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))) as typeof fetch;

    const response = await module.handleGenerateCompletionFeedback(
      postRequest({ taskId: "task-1", completionSource: "quest" }),
      authedDeps(createSupabaseHarness({
        todayTasks: [
          { id: "task-1", completed: true, completed_at: "2026-04-29T16:00:00.000Z" },
        ],
      }), fetchImpl),
    );

    const json = await response.json();
    assertEquals(response.status, 200);
    assertEquals(json.companion.tone, "proud");
    assertEquals(json.mentor, undefined);
  } finally {
    if (previousKey === undefined) Deno.env.delete("OPENAI_API_KEY");
    else Deno.env.set("OPENAI_API_KEY", previousKey);
  }
});
