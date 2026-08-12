import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const {
  buildSystemPrompt,
  enforceDailyTurnCap,
  hasVerifiedPremiumAccess,
} = await import("./index.ts");

Deno.test("buildSystemPrompt enforces Graceward's Christian reflection voice over legacy templates", () => {
  const prompt = buildSystemPrompt({
    companion: {
      current_stage: 1,
      current_mood: "steady",
      bond_level: 1,
    },
    learning: null,
    memories: [],
    voiceTemplate: {
      voice_style: "Gritty chaos sidekick with savage roasts and streetwise slang.",
      personality_traits: ["irreverent", "fast-talking"],
    },
    enrichedContext: null,
    surface: "companion",
  });

  assertStringIncludes(prompt, "Warm, natural Christian reflection companion");
  assertStringIncludes(prompt, "never use forced slang");
  assertStringIncludes(prompt, "Offer a short prayer only when the user asks");
  assertStringIncludes(prompt, "Never imply that productivity earns worth");
  assertEquals(prompt.includes("savage roasts"), false);
  assertEquals(prompt.includes("streetwise slang"), false);
});

Deno.test("buildSystemPrompt connects recent Guide, practice, Companion, and mood context without scoring", () => {
  const prompt = buildSystemPrompt({
    companion: null,
    learning: null,
    memories: [],
    voiceTemplate: null,
    enrichedContext: null,
    memoryEnabled: true,
    dailyThreads: [{
      thread_date: "2026-08-10",
      focus_label: "A gentler pace",
      practice_completed_at: null,
      companion_answer_label: "More space",
      evening_reflected_at: null,
    }],
    moodLogs: [{ mood: "calm" }, { mood: "calm" }, { mood: "tired" }],
    surface: "companion",
  });

  assertStringIncludes(prompt, "focus “A gentler pace”");
  assertStringIncludes(prompt, "companion check-in “More space”");
  assertStringIncludes(prompt, "calm (2), tired (1)");
  assertStringIncludes(prompt, "never a debt or failure");
});

Deno.test("buildSystemPrompt excludes durable personal memory when the user turns memory off", () => {
  const prompt = buildSystemPrompt({
    companion: null,
    learning: {
      conversation_profile: { preferences: ["Private preference"] },
      preferred_habit_frequency: "daily",
    },
    memories: [{
      memory_date: "2026-08-09",
      memory_type: "special_moment",
      memory_context: { title: "Private moment" },
    }],
    voiceTemplate: null,
    enrichedContext: null,
    memoryEnabled: false,
    dailyThreads: [],
    moodLogs: [{ mood: "private mood" }],
    surface: "companion",
  });

  assertEquals(prompt.includes("Private preference"), false);
  assertEquals(prompt.includes("Private moment"), false);
  assertEquals(prompt.includes("private mood"), false);
  assertEquals(prompt.includes("Learning hints"), false);
});

function createTurnCapSupabase(count: number) {
  const queries: string[] = [];

  return {
    queries,
    supabase: {
      from(table: string) {
        queries.push(table);
        if (table !== "companion_chats") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select(_selection: string, options: { count?: string; head?: boolean }) {
            assertEquals(options, { count: "exact", head: true });
            return {
              eq(column: string, value: unknown) {
                assertEquals(column, "user_id");
                assertEquals(value, "user-1");
                return {
                  eq(roleColumn: string, role: unknown) {
                    assertEquals(roleColumn, "role");
                    assertEquals(role, "user");
                    return {
                      gte(dateColumn: string, value: unknown) {
                        assertEquals(dateColumn, "created_at");
                        assertEquals(typeof value, "string");
                        return Promise.resolve({ count, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function createPremiumAccessSupabase() {
  return {
    from(table: string) {
      if (table === "account_entitlements") {
        return {
          select: () => ({
            eq: (_column: string, userId: string) => ({
              maybeSingle: async () => ({
                data: {
                  user_id: userId,
                  source: "subscription",
                  status: "active",
                  plan: "yearly",
                  is_active: true,
                  ends_at: "2099-01-01T00:00:00.000Z",
                  trial_ends_at: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

Deno.test("enforceDailyTurnCap bypasses the daily cap for verified premium users", async () => {
  const mock = createTurnCapSupabase(40);

  const allowed = await enforceDailyTurnCap(mock.supabase, "user-1", {
    hasVerifiedPremiumAccess: true,
  });

  assertEquals(allowed, true);
  assertEquals(mock.queries, []);
});

Deno.test("enforceDailyTurnCap blocks non-premium users at the daily cap for DAILY_LIMIT_REACHED", async () => {
  const mock = createTurnCapSupabase(40);

  const allowed = await enforceDailyTurnCap(mock.supabase, "user-1", {
    hasVerifiedPremiumAccess: false,
  });

  assertEquals(allowed, false);
  assertEquals(mock.queries, ["companion_chats"]);
});

Deno.test("hasVerifiedPremiumAccess trusts active backend subscription entitlements", async () => {
  const allowed = await hasVerifiedPremiumAccess(createPremiumAccessSupabase(), "user-1");

  assertEquals(allowed, true);
});
