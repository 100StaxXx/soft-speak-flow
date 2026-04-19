function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

type MockResponse = { data: unknown; error: unknown };

function createMockSupabase(
  responseMap: Record<string, MockResponse[]>,
) {
  const queues = new Map(
    Object.entries(responseMap).map(([table, responses]) => [table, [...responses]]),
  );
  const calls: Array<{ table: string; operations: Array<[string, ...unknown[]]> }> = [];
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> = [];

  const nextResponse = (table: string): MockResponse => {
    const queue = queues.get(table) ?? [];
    const response = queue.shift();
    queues.set(table, queue);
    return response ?? { data: null, error: null };
  };

  return {
    calls,
    upserts,
    from(table: string) {
      const operations: Array<[string, ...unknown[]]> = [];

      const builder = {
        select(columns: string) {
          operations.push(["select", columns]);
          return builder;
        },
        eq(column: string, value: unknown) {
          operations.push(["eq", column, value]);
          return builder;
        },
        gte(column: string, value: unknown) {
          operations.push(["gte", column, value]);
          return builder;
        },
        lte(column: string, value: unknown) {
          operations.push(["lte", column, value]);
          calls.push({ table, operations: [...operations] });
          return Promise.resolve(nextResponse(table));
        },
        order(column: string, options: unknown) {
          operations.push(["order", column, options]);
          return builder;
        },
        limit(value: number) {
          operations.push(["limit", value]);
          return builder;
        },
        maybeSingle() {
          calls.push({ table, operations: [...operations] });
          return Promise.resolve(nextResponse(table));
        },
        upsert(payload: unknown, options: unknown) {
          upserts.push({ table, payload, options });
          return Promise.resolve({ error: null });
        },
      };

      return builder;
    },
  };
}

const baseAnalysis = {
  analysisDate: "2026-04-18",
  timezone: "America/Los_Angeles",
  generatedAt: "2026-04-18T18:30:00.000Z",
  mentor: {
    id: "mentor-1",
    name: "Eli",
    tone: "Supportive and specific",
    avatarUrl: null,
    primaryColor: "#ff7a59",
  },
  companion: {
    id: "companion-1",
    currentStage: 3,
    currentXp: 240,
  },
  activitySnapshot: {
    activityStartDate: "2026-04-12",
    activityEndDate: "2026-04-18",
    provenanceStartDate: "2026-03-20",
    provenanceEndDate: "2026-04-18",
    morningCheckIns: 4,
    eveningReflections: 3,
    habitCompletions: 5,
    onTimeTasks: 2,
    trackedAttributeEvents: 6,
    streakMilestones: 1,
  },
  statBreakdowns: [],
  summary: "Cached mentor read",
  suggestedAction: "Keep the rhythm steady.",
};

Deno.test("generate-companion-stat-analysis returns same-day cached analysis", async () => {
  const supabase = createMockSupabase({
    profiles: [{ data: { selected_mentor_id: "mentor-1", timezone: "America/Los_Angeles" }, error: null }],
    companion_stat_analyses: [{ data: { payload: baseAnalysis }, error: null }],
  });

  const response = await module.handleGenerateCompanionStatAnalysis(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async () => {
        throw new Error("fetchImpl should not be called for cached responses");
      },
      now: () => new Date("2026-04-19T06:30:00.000Z"),
    },
  );

  assertEquals(response.status, 200, "Cached response should succeed");

  const payload = await response.json();
  assertEquals(payload.cached, true, "Cached flag should be true");
  assertEquals(payload.analysis.summary, "Cached mentor read", "Cached payload should be returned");
  assertEquals(supabase.upserts.length, 0, "Cached path should not upsert");

  const cacheLookup = supabase.calls.find((call) => call.table === "companion_stat_analyses");
  assert(Boolean(cacheLookup), "Cache lookup should be recorded");
  assert(
    cacheLookup!.operations.some(
      ([operation, column, value]) => operation === "eq" && column === "analysis_date" && value === "2026-04-18",
    ),
    "Cache lookup should use the user's local analysis date",
  );
});

Deno.test("generate-companion-stat-analysis force refresh regenerates and overwrites the daily record", async () => {
  const supabase = createMockSupabase({
    profiles: [{ data: { selected_mentor_id: "mentor-1", timezone: "America/Los_Angeles" }, error: null }],
    companion_stat_analyses: [{ data: { payload: baseAnalysis }, error: null }],
    user_companion: [{
      data: {
        id: "companion-1",
        current_stage: 3,
        current_xp: 240,
        vitality: 420,
        wisdom: 540,
        discipline: 580,
        resolve: 490,
        creativity: 360,
        alignment: 530,
      },
      error: null,
    }],
    mentors: [{
      data: {
        id: "mentor-1",
        name: "Eli",
        tone_description: "Supportive and specific",
        avatar_url: null,
        primary_color: "#ff7a59",
      },
      error: null,
    }],
    daily_check_ins: [{ data: [{ check_in_date: "2026-04-18", mood: "good", intention: "Focus" }], error: null }],
    evening_reflections: [{ data: [{ reflection_date: "2026-04-18", mood: "grateful" }], error: null }],
    habit_completions: [{ data: [{ date: "2026-04-18", habit_id: "habit-1" }], error: null }],
    daily_tasks: [{
      data: [{
        id: "task-1",
        task_date: "2026-04-18",
        habit_source_id: null,
        scheduled_time: "09:00:00",
        completed_at: "2026-04-18T09:15:00",
      }],
      error: null,
    }],
    companion_attribute_events: [{
      data: [
        {
          attribute: "discipline",
          source_event: "habit_complete",
          amount_awarded: 4,
          echo_amount: 1,
          created_at: "2026-04-18T12:00:00.000Z",
        },
        {
          attribute: "wisdom",
          source_event: "habit_complete_learning",
          amount_awarded: 8,
          echo_amount: 0,
          created_at: "2026-04-18T12:00:00.000Z",
        },
        {
          attribute: "alignment",
          source_event: "morning_check_in",
          amount_awarded: 6,
          echo_amount: 0,
          created_at: "2026-04-18T12:00:00.000Z",
        },
      ],
      error: null,
    }],
  });

  const response = await module.handleGenerateCompanionStatAnalysis(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({ forceRefresh: true }) }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      now: () => new Date("2026-04-18T18:30:00.000Z"),
    },
  );

  assertEquals(response.status, 200, "Force refresh should succeed");

  const payload = await response.json();
  assertEquals(payload.cached, false, "Force refresh should return a fresh payload");
  assertEquals(payload.analysis.analysisDate, "2026-04-18", "Fresh payload should use the analysis date");
  assertEquals(supabase.upserts.length, 1, "Force refresh should upsert the daily analysis row");

  const [upsert] = supabase.upserts;
  const upsertPayload = upsert.payload as { analysis_date: string; payload: { suggestedAction: string } };
  assertEquals(upsert.table, "companion_stat_analyses", "Fresh analysis should be persisted");
  assertEquals(upsertPayload.analysis_date, "2026-04-18", "Upsert should target the local analysis date");
  assert(
    typeof upsertPayload.payload.suggestedAction === "string" && upsertPayload.payload.suggestedAction.length > 0,
    "Upserted payload should include mentor guidance",
  );
});

Deno.test("buildCompanionStatAnalysisPayload maps drivers deterministically and stays honest for sparse stats", () => {
  const analysis = module.buildCompanionStatAnalysisPayload({
    analysisDate: "2026-04-18",
    timezone: "America/Los_Angeles",
    generatedAt: "2026-04-18T18:30:00.000Z",
    mentor: {
      id: "mentor-1",
      name: "Eli",
      tone: "Supportive and specific",
      avatarUrl: null,
      primaryColor: "#ff7a59",
    },
    companion: {
      id: "companion-1",
      current_stage: 3,
      current_xp: 240,
      vitality: 420,
      wisdom: 540,
      discipline: 580,
      resolve: 490,
      creativity: 360,
      alignment: 530,
    },
    checkIns: [{ check_in_date: "2026-04-18", mood: "good", intention: "Focus" }],
    reflections: [{ reflection_date: "2026-04-18", mood: "grateful" }],
    habitCompletions: [{ date: "2026-04-18", habit_id: "habit-1" }],
    completedTasks: [{
      id: "task-1",
      task_date: "2026-04-18",
      habit_source_id: null,
      scheduled_time: "09:00:00",
      completed_at: "2026-04-18T09:15:00",
    }],
    attributeEvents: [
      {
        attribute: "discipline",
        source_event: "habit_complete",
        amount_awarded: 4,
        echo_amount: 1,
        created_at: "2026-04-18T12:00:00.000Z",
      },
      {
        attribute: "wisdom",
        source_event: "habit_complete_learning",
        amount_awarded: 8,
        echo_amount: 0,
        created_at: "2026-04-18T12:00:00.000Z",
      },
      {
        attribute: "alignment",
        source_event: "morning_check_in",
        amount_awarded: 6,
        echo_amount: 0,
        created_at: "2026-04-18T12:00:00.000Z",
      },
    ],
    activityStartDate: "2026-04-12",
    provenanceStartDate: "2026-03-20",
  });

  const discipline = analysis.statBreakdowns.find((breakdown: { attribute: string }) => breakdown.attribute === "discipline");
  const wisdom = analysis.statBreakdowns.find((breakdown: { attribute: string }) => breakdown.attribute === "wisdom");
  const vitality = analysis.statBreakdowns.find((breakdown: { attribute: string }) => breakdown.attribute === "vitality");
  const creativity = analysis.statBreakdowns.find((breakdown: { attribute: string }) => breakdown.attribute === "creativity");

  assert(Boolean(discipline), "Discipline breakdown should exist");
  assert(Boolean(wisdom), "Wisdom breakdown should exist");
  assert(Boolean(vitality), "Vitality breakdown should exist");
  assert(Boolean(creativity), "Creativity breakdown should exist");

  assertEquals(discipline!.recentDrivers[0].key, "discipline:habit_complete", "Discipline should map habit provenance");
  assertEquals(wisdom!.recentDrivers[0].key, "wisdom:habit_complete_learning", "Wisdom should map learning provenance");
  assertEquals(analysis.activitySnapshot.onTimeTasks, 1, "On-time tasks should reuse the shared discipline timing logic");
  assert(
    vitality!.primaryReasons[0].includes("No recent tracked boosts"),
    "Sparse vitality data should stay honest about missing tracked evidence",
  );
  assert(
    creativity!.status.includes("no recent tracked boosts yet"),
    "Sparse creativity data should not invent recent drivers",
  );
});
