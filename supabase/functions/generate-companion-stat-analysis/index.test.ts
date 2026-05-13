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
        lt(column: string, value: unknown) {
          operations.push(["lt", column, value]);
          return builder;
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
    hardTaskWins: 1,
    recoveryActions: 1,
    healthActions: 2,
    creativeActions: 1,
    relationshipActions: 1,
    epicLinkedCompletions: 1,
    bounceBackDays: 1,
  },
  statProfile: {
    scores: {
      vitality: 420,
      wisdom: 540,
      discipline: 580,
      resolve: 490,
      creativity: 360,
      alignment: 530,
    },
    dominantStat: "discipline",
    secondaryStat: "alignment",
  },
  statNeeds: {
    vitality: { level: "medium", reasons: ["You've been pushing output harder than recovery."] },
    wisdom: { level: "low", reasons: [] },
    discipline: { level: "low", reasons: [] },
    resolve: { level: "low", reasons: [] },
    creativity: { level: "medium", reasons: ["The week could use a little more originality and play."] },
    alignment: { level: "low", reasons: [] },
  },
  cosmiqTitle: {
    title: "The Oathbound Pathfinder",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "alignment",
    rebalanceStat: "creativity",
    fusion: true,
    rebalancePath: "Strengthen Creativity to evolve toward The Soulforged Creator.",
    titleStability: "new",
  },
  fantasyTitle: {
    title: "The Oathbound Navigator",
    archetype: "Discipline / Alignment",
    explanation: "A Discipline-led adventurer with Alignment close behind, steady enough to guide the party through the ordinary wilds.",
  },
  momentumState: "coasting",
  recentMissInterpretation: "normal_variance",
  narrativeBrief: "You've kept Discipline online, but Vitality wants a little more intentional support.",
  dailyNarrative: "Discipline-heavy day",
  weeklyNarrative: "Discipline is leading lately, with Alignment close behind. Vitality is the clearest rebalance need next.",
  identityBootstrap: "Here's who you've been lately: Discipline has been your clearest trait.",
  strongestRecentDrivers: [],
  statBreakdowns: [],
  summary: "Cached mentor read",
  suggestedAction: "Keep the rhythm steady.",
};

function createFreshAnalysisResponseMap(): Record<string, MockResponse[]> {
  return {
    profiles: [{ data: { selected_mentor_id: "mentor-1", timezone: "America/Los_Angeles" }, error: null }],
    questionnaire_responses: [{ data: null, error: null }],
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
        task_text: "Morning workout",
        task_date: "2026-04-18",
        category: "body",
        difficulty: "hard",
        priority: "high",
        completed: true,
        habit_source_id: null,
        scheduled_time: "09:00:00",
        completed_at: "2026-04-18T09:15:00",
        contact_id: null,
        epic_id: null,
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
          amount_awarded: 6,
          echo_amount: 0,
          created_at: "2026-04-18T12:00:00.000Z",
        },
        {
          attribute: "alignment",
          source_event: "morning_check_in",
          amount_awarded: 4,
          echo_amount: 0,
          created_at: "2026-04-18T12:00:00.000Z",
        },
      ],
      error: null,
    }],
  };
}

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

Deno.test("generate-companion-stat-analysis refreshes cached title-card state without regenerating analysis", async () => {
  const cachedGeneratingAnalysis = {
    ...baseAnalysis,
    cosmiqTitleCard: {
      profileKey: "v1-the-oathbound-pathfinder",
      imageUrl: null,
      status: "generating",
      cached: false,
      promptVersion: 1,
    },
  };
  const supabase = createMockSupabase({
    profiles: [{ data: { selected_mentor_id: "mentor-1", timezone: "America/Los_Angeles" }, error: null }],
    questionnaire_responses: [{ data: { answer_tags: ["visual_persona_female"] }, error: null }],
    companion_stat_analyses: [{ data: { payload: cachedGeneratingAnalysis }, error: null }],
  });
  let resolvedVisualPersona = "";

  const response = await module.handleGenerateCompanionStatAnalysis(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async () => {
        throw new Error("fetchImpl should not be called for cached responses");
      },
      now: () => new Date("2026-04-19T06:30:00.000Z"),
      getCosmiqTitleCardCacheState: async ({ visualPersona }) => {
        resolvedVisualPersona = visualPersona ?? "";
        return {
          profileKey: "v1-the-oathbound-pathfinder",
          imageUrl: "https://cdn.example.com/ready.png",
          status: "ready",
          cached: true,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Cached response should succeed");

  const payload = await response.json();
  assertEquals(payload.cached, true, "Cached flag should stay true");
  assertEquals(payload.analysis.cosmiqTitleCard.status, "ready", "Cached response should surface ready card state");
  assertEquals(payload.analysis.cosmiqTitleCard.imageUrl, "https://cdn.example.com/ready.png", "Cached response should refresh image URL");
  assertEquals(resolvedVisualPersona, "female", "Cached title-card state should use onboarding visual persona");
  assertEquals(supabase.upserts.length, 0, "Cached title-card refresh should not rewrite analysis");
});

Deno.test("generate-companion-stat-analysis regenerates malformed same-day cached analysis rows", async () => {
  const supabase = createMockSupabase({
    companion_stat_analyses: [{
      data: {
        payload: {
          ...baseAnalysis,
          summary: "",
        },
      },
      error: null,
    }],
    ...createFreshAnalysisResponseMap(),
  });

  const response = await module.handleGenerateCompanionStatAnalysis(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      now: () => new Date("2026-04-18T18:30:00.000Z"),
    },
  );

  assertEquals(response.status, 200, "Malformed cached payload should fall through to regeneration");

  const payload = await response.json();
  assertEquals(payload.cached, false, "Malformed cached payload should not be returned as cached");
  assertEquals(payload.analysis.analysisDate, "2026-04-18", "Regenerated payload should target the current analysis date");
  assertEquals(supabase.upserts.length, 1, "Regenerated analysis should repair the cached row");
  assert(
    typeof payload.analysis.summary === "string" && payload.analysis.summary.length > 0,
    "Regenerated payload should include a non-empty summary",
  );
});

Deno.test("generate-companion-stat-analysis force refresh regenerates and overwrites the daily record", async () => {
  const supabase = createMockSupabase({
    companion_stat_analyses: [{ data: { payload: baseAnalysis }, error: null }],
    ...createFreshAnalysisResponseMap(),
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
  const upsertPayload = upsert.payload as {
    analysis_date: string;
    payload: {
      cosmiqTitle: { title: string; rarity: string; rebalancePath: string };
      fantasyTitle: { title: string; archetype: string; explanation: string };
      suggestedAction: string;
    };
  };
  assertEquals(upsert.table, "companion_stat_analyses", "Fresh analysis should be persisted");
  assertEquals(upsertPayload.analysis_date, "2026-04-18", "Upsert should target the local analysis date");
  assert(
    typeof upsertPayload.payload.cosmiqTitle.title === "string" && upsertPayload.payload.cosmiqTitle.title.length > 0,
    "Upserted payload should include a Cosmiq title",
  );
  assert(
    typeof upsertPayload.payload.cosmiqTitle.rebalancePath === "string" && upsertPayload.payload.cosmiqTitle.rebalancePath.length > 0,
    "Upserted payload should include a Cosmiq rebalance path",
  );
  assert(
    typeof upsertPayload.payload.fantasyTitle.title === "string" && upsertPayload.payload.fantasyTitle.title.length > 0,
    "Upserted payload should include a fantasy title",
  );
  assert(
    typeof upsertPayload.payload.fantasyTitle.explanation === "string" && upsertPayload.payload.fantasyTitle.explanation.length > 0,
    "Upserted payload should explain the fantasy title",
  );
  assert(
    typeof upsertPayload.payload.suggestedAction === "string" && upsertPayload.payload.suggestedAction.length > 0,
    "Upserted payload should include mentor guidance",
  );
});

Deno.test("generate-companion-stat-analysis attaches title-card cache state without blocking on image generation", async () => {
  const supabase = createMockSupabase({
    companion_stat_analyses: [{ data: null, error: null }, { data: null, error: null }],
    ...createFreshAnalysisResponseMap(),
  });
  let titleCardLookupCount = 0;
  let resolvedVisualPersona = "";

  const response = await module.handleGenerateCompanionStatAnalysis(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      now: () => new Date("2026-04-18T18:30:00.000Z"),
      getCosmiqTitleCardCacheState: async ({ visualPersona }) => {
        titleCardLookupCount += 1;
        resolvedVisualPersona = visualPersona ?? "";
        return {
          profileKey: "v1-the-oathbound-pathfinder",
          imageUrl: null,
          status: "generating",
          cached: false,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Fresh response should succeed");

  const payload = await response.json();
  assertEquals(payload.cached, false, "Fresh response should not be cached");
  assertEquals(payload.analysis.cosmiqTitleCard.status, "generating", "Fresh response should include nonblocking card state");
  assertEquals(titleCardLookupCount, 1, "Fresh response should only perform a cache-state lookup");
  assertEquals(resolvedVisualPersona, "neutral", "Fresh title-card lookup should default missing visual persona to neutral");
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
      task_text: "Morning workout",
      task_date: "2026-04-18",
      category: "body",
      difficulty: "hard",
      priority: "high",
      completed: true,
      habit_source_id: null,
      scheduled_time: "09:00:00",
      completed_at: "2026-04-18T09:15:00",
      contact_id: null,
      epic_id: null,
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
        amount_awarded: 6,
        echo_amount: 0,
        created_at: "2026-04-18T12:00:00.000Z",
      },
      {
        attribute: "alignment",
        source_event: "morning_check_in",
        amount_awarded: 4,
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
  const resolve = analysis.statBreakdowns.find((breakdown: { attribute: string }) => breakdown.attribute === "resolve");

  assert(Boolean(discipline), "Discipline breakdown should exist");
  assert(Boolean(wisdom), "Wisdom breakdown should exist");
  assert(Boolean(vitality), "Vitality breakdown should exist");
  assert(Boolean(resolve), "Resolve breakdown should exist");

  assertEquals(discipline!.recentDrivers[0].key, "discipline:habit_complete", "Discipline should map habit provenance");
  assertEquals(wisdom!.recentDrivers[0].key, "wisdom:habit_complete_learning", "Wisdom should map learning provenance");
  assertEquals(analysis.activitySnapshot.onTimeTasks, 1, "On-time tasks should reuse the shared discipline timing logic");
  assertEquals(analysis.activitySnapshot.healthActions, 1, "Health actions should be counted from completed body tasks");
  assertEquals(analysis.statProfile.dominantStat, "wisdom", "Recent expression should surface the dominant stat");
  assert(
    vitality!.recentDrivers.some((driver: { key: string }) => driver.key === "vitality:activity"),
    "Vitality should reflect recent body activity even when direct vitality events are sparse",
  );
  assert(
    resolve!.recentDrivers.some((driver: { key: string }) => driver.key === "resolve:echo" || driver.key === "resolve:activity"),
    "Resolve should include echo or hard-task context instead of staying empty",
  );
});
