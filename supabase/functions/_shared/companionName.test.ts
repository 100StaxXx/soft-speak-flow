import {
  NOTIFICATION_COMPANION_FALLBACK_NAME,
  getNotificationSafeCompanionName,
  isAssignedCompanionName,
  resolveStoredCompanionDisplayName,
} from "./companionName.ts";

Deno.test("resolveStoredCompanionDisplayName keeps a valid cached proper name", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-1",
    current_stage: 3,
    cached_creature_name: "Nova",
    spirit_animal: "Phoenix",
  }, []);

  if (resolution.displayName !== "Nova") {
    throw new Error(`Expected Nova, got ${resolution.displayName}`);
  }

  if (resolution.source !== "cache") {
    throw new Error(`Expected cache source, got ${resolution.source}`);
  }
});

Deno.test("resolveStoredCompanionDisplayName recovers the current-stage evolution card name when cache is just the species", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-2",
    current_stage: 4,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
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
    current_stage: 5,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
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

Deno.test("resolveStoredCompanionDisplayName returns the generic fallback when no valid proper name exists", () => {
  const resolution = resolveStoredCompanionDisplayName({
    id: "comp-4",
    current_stage: 2,
    cached_creature_name: "Phoenix",
    spirit_animal: "Phoenix",
  }, [
    { companion_id: "comp-4", evolution_stage: 1, creature_name: "Phoenix" },
    { companion_id: "comp-4", evolution_stage: 2, creature_name: "Companion" },
  ]);

  if (resolution.displayName !== NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected fallback name, got ${resolution.displayName}`);
  }

  if (resolution.source !== "fallback") {
    throw new Error(`Expected fallback source, got ${resolution.source}`);
  }
});

Deno.test("notification-safe companion helpers reject species labels as proper names", () => {
  if (isAssignedCompanionName("Phoenix", "Phoenix")) {
    throw new Error("Expected species labels to be rejected as assigned names");
  }

  const safeName = getNotificationSafeCompanionName("Phoenix", "Phoenix");
  if (safeName !== NOTIFICATION_COMPANION_FALLBACK_NAME) {
    throw new Error(`Expected generic fallback, got ${safeName}`);
  }
});
