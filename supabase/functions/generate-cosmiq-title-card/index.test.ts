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

const baseAnalysis = {
  analysisDate: "2026-04-30",
  timezone: "America/Los_Angeles",
  generatedAt: "2026-04-30T18:30:00.000Z",
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
    activityStartDate: "2026-04-24",
    activityEndDate: "2026-04-30",
    provenanceStartDate: "2026-04-01",
    provenanceEndDate: "2026-04-30",
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
    vitality: { level: "medium", reasons: ["Recovery could use support."] },
    wisdom: { level: "low", reasons: [] },
    discipline: { level: "low", reasons: [] },
    resolve: { level: "low", reasons: [] },
    creativity: { level: "medium", reasons: ["Creativity has been quiet."] },
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
    title: "The Oathbound Pathfinder",
    archetype: "Discipline / Alignment",
    explanation:
      "A sworn navigator who binds ritual to purpose, guiding the party along the truest road even when the map goes quiet.",
  },
  momentumState: "coasting",
  recentMissInterpretation: "normal_variance",
  narrativeBrief: "You've kept Discipline online, but Vitality wants support.",
  dailyNarrative: "Discipline-heavy day",
  weeklyNarrative: "Discipline is leading lately, with Alignment close behind.",
  identityBootstrap: "Here's who you've been lately: Discipline has been your clearest trait.",
  strongestRecentDrivers: [],
  statBreakdowns: [
    {
      attribute: "vitality",
      score: 420,
      band: "Building",
      status: "Building",
      primaryReasons: ["Vitality is building."],
      recentDrivers: [],
    },
    {
      attribute: "wisdom",
      score: 540,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Wisdom is strong."],
      recentDrivers: [],
    },
    {
      attribute: "discipline",
      score: 580,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Discipline is strong."],
      recentDrivers: [],
    },
    {
      attribute: "resolve",
      score: 490,
      band: "Building",
      status: "Building",
      primaryReasons: ["Resolve is building."],
      recentDrivers: [],
    },
    {
      attribute: "creativity",
      score: 360,
      band: "Building",
      status: "Building",
      primaryReasons: ["Creativity is building."],
      recentDrivers: [],
    },
    {
      attribute: "alignment",
      score: 530,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Alignment is strong."],
      recentDrivers: [],
    },
  ],
  summary: "Eli sees consistent momentum in your daily rhythm.",
  suggestedAction: "Pair one morning check-in with one on-time task today.",
};

function createMockSupabase(
  analysisRow: unknown,
  visualPersonaRow: unknown = null,
) {
  const operations: Array<[string, ...unknown[]]> = [];

  return {
    operations,
    from(table: string) {
      assert(
        table === "companion_stat_analyses" || table === "questionnaire_responses",
        `Unexpected table lookup: ${table}`,
      );
      const builder = {
        select(columns: string) {
          operations.push(["select", columns]);
          return builder;
        },
        eq(column: string, value: unknown) {
          operations.push(["eq", column, value]);
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
          operations.push(["maybeSingle"]);
          return Promise.resolve({
            data: table === "companion_stat_analyses" ? analysisRow : visualPersonaRow,
            error: null,
          });
        },
      };
      return builder;
    },
  };
}

Deno.test("generate-cosmiq-title-card ignores client-supplied analysis and requires a saved user analysis", async () => {
  const supabase = createMockSupabase(null);
  let resolverCalled = false;

  const response = await module.handleGenerateCosmiqTitleCard(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ analysisDate: "2026-04-30", analysis: baseAnalysis }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async () => {
        resolverCalled = true;
        throw new Error("resolver should not be called without a saved analysis");
      },
    },
  );

  assertEquals(response.status, 404, "Missing saved analysis should be rejected");
  assertEquals(resolverCalled, false, "Client-supplied analysis should not reach resolver");
});

Deno.test("generate-cosmiq-title-card loads the authenticated user's saved analysis", async () => {
  const supabase = createMockSupabase(
    { payload: baseAnalysis, analysis_date: "2026-04-30" },
    { answer_tags: ["visual_persona_female"] },
  );
  let resolvedAnalysisTitle = "";
  let resolvedVisualPersona = "";

  const response = await module.handleGenerateCosmiqTitleCard(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ analysisDate: "2026-04-30" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async ({ analysis, visualPersona }) => {
        resolvedAnalysisTitle = analysis.cosmiqTitle.title;
        resolvedVisualPersona = visualPersona ?? "";
        return {
          profileKey: "v1-the-oathbound-pathfinder",
          imageUrl: "https://cdn.example.com/card.png",
          status: "ready",
          cached: true,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Saved analysis should generate a card response");
  const payload = await response.json();
  assertEquals(payload.card.status, "ready", "Expected resolver card payload");
  assertEquals(resolvedAnalysisTitle, "The Oathbound Pathfinder", "Expected saved analysis to reach resolver");
  assertEquals(resolvedVisualPersona, "female", "Expected visual persona to reach resolver");
  assert(
    supabase.operations.some(([operation, column, value]) =>
      operation === "eq" && column === "user_id" && value === "user-1"
    ),
    "Expected query to scope by authenticated user",
  );
  assert(
    supabase.operations.some(([operation, column, value]) =>
      operation === "eq" && column === "analysis_date" && value === "2026-04-30"
    ),
    "Expected query to scope by requested analysis date",
  );
});

Deno.test("generate-cosmiq-title-card passes forced refresh through to the resolver", async () => {
  const supabase = createMockSupabase({ payload: baseAnalysis, analysis_date: "2026-04-30" });
  let resolvedForceRefresh = false;

  const response = await module.handleGenerateCosmiqTitleCard(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ analysisDate: "2026-04-30", forceRefresh: true }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async ({ forceRefresh }) => {
        resolvedForceRefresh = forceRefresh === true;
        return {
          profileKey: "v1-the-oathbound-pathfinder-neutral",
          imageUrl: "https://cdn.example.com/card.png",
          status: "ready",
          cached: false,
          promptVersion: 1,
        };
      },
    },
  );

  assertEquals(response.status, 200, "Forced refresh should still return a card response");
  assertEquals(resolvedForceRefresh, true, "Expected forced refresh to reach resolver");
});

Deno.test("generate-cosmiq-title-card rejects malformed analysis dates", async () => {
  const supabase = createMockSupabase({ payload: baseAnalysis, analysis_date: "2026-04-30" });

  const response = await module.handleGenerateCosmiqTitleCard(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ analysisDate: "not-a-date" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      resolveCosmiqTitleCard: async () => {
        throw new Error("resolver should not be called for bad dates");
      },
    },
  );

  assertEquals(response.status, 400, "Malformed dates should be rejected");
  assertEquals(supabase.operations.length, 0, "Bad input should not query the database");
});
