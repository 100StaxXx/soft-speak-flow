import {
  NOTIFICATION_COMPANION_FALLBACK_NAME,
  getNotificationSafeCompanionName,
  isAssignedCompanionName,
  resolveNotificationCompanionContext,
  resolveStoredCompanionDisplayName,
} from "./companionName.ts";

function createCompanionNameSupabaseMock(params: {
  evolutionCards?: Array<{ companion_id: string; evolution_stage: number | null; creature_name: string | null }>;
  updateError?: { message: string } | null;
}) {
  const updateCalls: Array<{ table: string; payload: Record<string, unknown>; id: string | null }> = [];

  return {
    updateCalls,
    client: {
      from(table: string) {
        if (table === "companion_evolution_cards") {
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return Promise.resolve({
                        data: params.evolutionCards ?? [],
                        error: null,
                      });
                    },
                  };
                },
              };
            },
          };
        }

        if (table === "user_companion") {
          return {
            update(payload: Record<string, unknown>) {
              return {
                eq(_column: string, id: string) {
                  updateCalls.push({ table, payload, id });
                  return Promise.resolve({
                    error: params.updateError ?? null,
                  });
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

Deno.test("resolveStoredCompanionDisplayName keeps a valid cached proper name", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-1",
    user_id: "user-1",
    companion_name: null,
    preset_id: "phoenix",
    current_stage: 3,
    cached_creature_name: "Nova",
    spirit_animal: "Phoenix",
    core_element: "fire",
  }, []);

  if (resolution.displayName !== "Nova") {
    throw new Error(`Expected Nova, got ${resolution.displayName}`);
  }

  if (resolution.source !== "cache") {
    throw new Error(`Expected cache source, got ${resolution.source}`);
  }
});

Deno.test("resolveStoredCompanionDisplayName prefers a user-owned custom name", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-1a",
    user_id: "user-1a",
    companion_name: "Aster",
    preset_id: "phoenix",
    current_stage: 0,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
    core_element: "fire",
  }, []);

  if (resolution.displayName !== "Aster") {
    throw new Error(`Expected Aster, got ${resolution.displayName}`);
  }

  if (resolution.source !== "custom") {
    throw new Error(`Expected custom source, got ${resolution.source}`);
  }
});

Deno.test("resolveStoredCompanionDisplayName recovers the current-stage evolution card name when cache is just the species", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-2",
    user_id: "user-2",
    preset_id: "phoenix",
    current_stage: 4,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
    core_element: "fire",
  }, [
    { companion_id: "comp-2", evolution_stage: 1, creature_name: "Emberling" },
    { companion_id: "comp-2", evolution_stage: 4, creature_name: "Astra" },
  ]);

  if (resolution.displayName !== "Astra") {
    throw new Error(`Expected Astra, got ${resolution.displayName}`);
  }

  if (resolution.recoveredName !== "Astra") {
    throw new Error(`Expected recoveredName Astra, got ${resolution.recoveredName}`);
  }

  if (resolution.source !== "current_stage_card") {
    throw new Error(`Expected current_stage_card source, got ${resolution.source}`);
  }
});

Deno.test("resolveStoredCompanionDisplayName falls back to the earliest valid card name", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-3",
    user_id: "user-3",
    preset_id: "phoenix",
    current_stage: 5,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
    core_element: "fire",
  }, [
    { companion_id: "comp-3", evolution_stage: 1, creature_name: "Solis" },
    { companion_id: "comp-3", evolution_stage: 5, creature_name: "Phoenix" },
  ]);

  if (resolution.displayName !== "Solis") {
    throw new Error(`Expected Solis, got ${resolution.displayName}`);
  }

  if (resolution.source !== "earliest_card") {
    throw new Error(`Expected earliest_card source, got ${resolution.source}`);
  }
});

Deno.test("resolveStoredCompanionDisplayName synthesizes a canonical proper name when no valid card name exists", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-4",
    user_id: "user-4",
    preset_id: "phoenix",
    current_stage: 2,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
    core_element: "fire",
  }, [
    { companion_id: "comp-4", evolution_stage: 1, creature_name: "Phoenix" },
    { companion_id: "comp-4", evolution_stage: 2, creature_name: "Companion" },
  ]);

  if (resolution.displayName === NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected synthesized proper name, got fallback ${resolution.displayName}`);
  }

  if (resolution.displayName === "Phoenix") {
    throw new Error(`Expected synthesized name to reject species labels, got ${resolution.displayName}`);
  }

  if (resolution.source !== "synthesized") {
    throw new Error(`Expected synthesized source, got ${resolution.source}`);
  }

  if (resolution.recoveredName !== resolution.displayName) {
    throw new Error("Expected synthesized name to be persisted");
  }
});

Deno.test("notification-safe companion helpers reject species labels as proper names", () => {
  if (isAssignedCompanionName("Phoenix", { spiritAnimal: "Phoenix", presetId: "phoenix" })) {
    throw new Error("Expected species labels to be rejected as assigned names");
  }

  if (isAssignedCompanionName("Kitsune", { spiritAnimal: "Fox", presetId: "fox" })) {
    throw new Error("Expected preset display labels to be rejected as assigned names");
  }

  const safeName = getNotificationSafeCompanionName("Phoenix", { spiritAnimal: "Phoenix", presetId: "phoenix" });
  if (safeName !== NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected generic fallback, got ${safeName}`);
  }
});

Deno.test("resolveNotificationCompanionContext recovers a proper name and persists it when cache only stores species", async () => {
  const supabase = createCompanionNameSupabaseMock({
    evolutionCards: [
      { companion_id: "comp-5", evolution_stage: 1, creature_name: "Phoenix" },
      { companion_id: "comp-5", evolution_stage: 3, creature_name: "Nova" },
    ],
  });

  const context = await resolveNotificationCompanionContext({
    supabase: supabase.client,
    companion: {
      id: "comp-5",
      user_id: "user-5",
      preset_id: "phoenix",
      current_stage: 3,
      cached_creature_name: "Phoenix",
      spirit_animal: "Phoenix",
      core_element: "fire",
      current_mood: "calm",
      inactive_days: 2,
    },
    logPrefix: "[test]",
  });

  if (context?.displayName !== "Nova") {
    throw new Error(`Expected recovered name Nova, got ${context?.displayName ?? null}`);
  }

  if (context?.cachedCreatureName !== "Nova") {
    throw new Error(`Expected cached creature name to be updated to Nova, got ${context?.cachedCreatureName ?? null}`);
  }

  if (supabase.updateCalls.length !== 1) {
    throw new Error(`Expected one cache update, got ${supabase.updateCalls.length}`);
  }
});

Deno.test("resolveNotificationCompanionContext synthesizes and persists a canonical name when no valid card name exists", async () => {
  const supabase = createCompanionNameSupabaseMock({
    evolutionCards: [
      { companion_id: "comp-6", evolution_stage: 1, creature_name: "Kitsune" },
    ],
  });

  const context = await resolveNotificationCompanionContext({
    supabase: supabase.client,
    companion: {
      id: "comp-6",
      user_id: "user-6",
      preset_id: "fox",
      current_stage: 1,
      cached_creature_name: "Fox",
      spirit_animal: "Fox",
      core_element: "storm",
      current_mood: null,
      inactive_days: 6,
    },
    logPrefix: "[test]",
  });

  if (!context?.displayName || context.displayName === NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected synthesized proper name, got ${context?.displayName ?? null}`);
  }

  if (context.displayName === "Fox" || context.displayName === "Kitsune") {
    throw new Error(`Expected synthesized name to reject species aliases, got ${context.displayName}`);
  }

  if (supabase.updateCalls.length !== 1) {
    throw new Error(`Expected one cache update for synthesized name, got ${supabase.updateCalls.length}`);
  }
});
