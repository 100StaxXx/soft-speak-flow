import {
  isAssignedCompanionName as isAssignedCompanionNameShared,
  normalizeCompanionName,
  synthesizeAssignedCompanionName,
  type CompanionIdentityLike,
} from "../../../src/lib/companionNameIdentity.ts";

export const NOTIFICATION_COMPANION_FALLBACK_NAME = "Your companion";

export interface NotificationCompanionNameContext {
  displayName?: string | null;
  customName?: string | null;
  cachedCreatureName?: string | null;
  spiritAnimal?: string | null;
  presetId?: string | null;
}

export interface CompanionNameSourceRow {
  id: string;
  user_id: string;
  preset_id?: string | null;
  current_stage: number | null;
  companion_name?: string | null;
  cached_creature_name: string | null;
  spirit_animal: string | null;
  core_element?: string | null;
  current_mood?: string | null;
  inactive_days?: number | null;
  created_at?: string | null;
}

export interface CompanionEvolutionCardNameRow {
  companion_id: string;
  evolution_stage: number | null;
  creature_name: string | null;
}

export interface CompanionNameResolution {
  displayName: string;
  recoveredName: string | null;
  source: "custom" | "cache" | "current_stage_card" | "earliest_card" | "synthesized";
}

export interface ResolvedCompanionNotificationContext extends NotificationCompanionNameContext {
  currentMood?: string | null;
  inactiveDays?: number | null;
}

function buildCompanionIdentity(
  companion: {
    spirit_animal?: string | null;
    preset_id?: string | null;
    spiritAnimal?: string | null;
    presetId?: string | null;
  } | null | undefined,
): CompanionIdentityLike {
  return {
    spiritAnimal: companion?.spirit_animal ?? companion?.spiritAnimal,
    presetId: companion?.preset_id ?? companion?.presetId,
  };
}

export function isAssignedCompanionName(
  value: string | null | undefined,
  identity?: CompanionIdentityLike,
): boolean {
  return isAssignedCompanionNameShared(value, identity);
}

export function getNotificationSafeCompanionName(
  value: string | null | undefined,
  identity?: CompanionIdentityLike,
): string {
  return isAssignedCompanionName(value, identity)
    ? normalizeCompanionName(value) ?? NOTIFICATION_COMPANION_FALLBACK_NAME
    : NOTIFICATION_COMPANION_FALLBACK_NAME;
}

export function resolveStoredCompanionDisplayName(
  companion: Pick<
    CompanionNameSourceRow,
    "id" | "user_id" | "preset_id" | "current_stage" | "companion_name" | "cached_creature_name" | "spirit_animal" | "core_element"
  >,
  evolutionCards: CompanionEvolutionCardNameRow[],
): CompanionNameResolution {
  const customName = normalizeCompanionName(companion.companion_name);
  if (customName) {
    return {
      displayName: customName,
      recoveredName: null,
      source: "custom",
    };
  }

  const companionIdentity = buildCompanionIdentity(companion);

  if (isAssignedCompanionName(companion.cached_creature_name, companionIdentity)) {
    return {
      displayName: normalizeCompanionName(companion.cached_creature_name) ?? NOTIFICATION_COMPANION_FALLBACK_NAME,
      recoveredName: null,
      source: "cache",
    };
  }

  const currentStage = typeof companion.current_stage === "number" ? companion.current_stage : null;
  if (currentStage !== null) {
    const currentStageCard = evolutionCards.find((card) =>
      card.companion_id === companion.id &&
      card.evolution_stage === currentStage &&
      isAssignedCompanionName(card.creature_name, companionIdentity)
    );

    if (currentStageCard?.creature_name) {
      return {
        displayName: currentStageCard.creature_name.trim(),
        recoveredName: currentStageCard.creature_name.trim(),
        source: "current_stage_card",
      };
    }
  }

  const earliestValidCard = evolutionCards.find((card) =>
    card.companion_id === companion.id &&
    isAssignedCompanionName(card.creature_name, companionIdentity)
  );

  if (earliestValidCard?.creature_name) {
    return {
      displayName: earliestValidCard.creature_name.trim(),
      recoveredName: earliestValidCard.creature_name.trim(),
      source: "earliest_card",
    };
  }

  const synthesizedName = synthesizeAssignedCompanionName(
    `${companion.id}:${companion.user_id}:${companion.current_stage ?? 0}`,
    companion.core_element,
    companionIdentity,
  );

  return {
    displayName: synthesizedName,
    recoveredName: synthesizedName,
    source: "synthesized",
  };
}

function compareCompanionFreshness(
  left: Pick<CompanionNameSourceRow, "id" | "created_at">,
  right: Pick<CompanionNameSourceRow, "id" | "created_at">,
): number {
  const leftCreatedAt = left.created_at ?? "";
  const rightCreatedAt = right.created_at ?? "";

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return left.id.localeCompare(right.id);
}

function selectLatestCompanions(rows: CompanionNameSourceRow[] | null | undefined): CompanionNameSourceRow[] {
  const latestByUser = new Map<string, CompanionNameSourceRow>();

  for (const row of rows ?? []) {
    const existing = latestByUser.get(row.user_id);
    if (!existing || compareCompanionFreshness(existing, row) < 0) {
      latestByUser.set(row.user_id, row);
    }
  }

  return [...latestByUser.values()];
}

async function persistRecoveredCompanionNames(
  supabase: { from: (table: string) => any },
  cacheUpdates: Array<{ companionId: string; recoveredName: string }>,
  logPrefix: string,
): Promise<void> {
  if (cacheUpdates.length === 0) return;

  const results = await Promise.allSettled(
    cacheUpdates.map(async ({ companionId, recoveredName }) => {
      const { error } = await supabase
        .from("user_companion")
        .update({ cached_creature_name: recoveredName })
        .eq("id", companionId);

      if (error) {
        throw new Error(error.message);
      }
    }),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const failedUpdate = cacheUpdates[index];
      console.warn(`${logPrefix} failed to persist recovered companion name`, {
        companionId: failedUpdate?.companionId ?? null,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });
}

export async function resolveNotificationCompanionContext(params: {
  supabase: { from: (table: string) => any };
  companion: CompanionNameSourceRow | null;
  logPrefix?: string;
}): Promise<ResolvedCompanionNotificationContext | null> {
  const { supabase, companion, logPrefix = "[companion-name]" } = params;

  if (!companion) {
    return null;
  }

  let evolutionCards: CompanionEvolutionCardNameRow[] = [];
  if (
    !normalizeCompanionName(companion.companion_name)
    && !isAssignedCompanionName(companion.cached_creature_name, buildCompanionIdentity(companion))
  ) {
    const { data, error } = await supabase
      .from("companion_evolution_cards")
      .select("companion_id, evolution_stage, creature_name")
      .eq("companion_id", companion.id)
      .order("evolution_stage", { ascending: true });

    if (error) {
      throw error;
    }

    evolutionCards = (data as CompanionEvolutionCardNameRow[] | null) ?? [];
  }

  const resolution = resolveStoredCompanionDisplayName(companion, evolutionCards);
  if (resolution.recoveredName && resolution.recoveredName !== companion.cached_creature_name) {
    await persistRecoveredCompanionNames(
      supabase,
      [{ companionId: companion.id, recoveredName: resolution.recoveredName }],
      logPrefix,
    );
  }

  return {
    displayName: resolution.displayName,
    customName: normalizeCompanionName(companion.companion_name),
    cachedCreatureName: resolution.recoveredName ?? companion.cached_creature_name,
    spiritAnimal: companion.spirit_animal,
    presetId: companion.preset_id ?? null,
    currentMood: companion.current_mood ?? null,
    inactiveDays: companion.inactive_days ?? null,
  };
}

export async function resolveNotificationCompanionContextMap(params: {
  supabase: { from: (table: string) => any };
  companions: CompanionNameSourceRow[] | null;
  logPrefix?: string;
}): Promise<Map<string, ResolvedCompanionNotificationContext>> {
  const { supabase, companions, logPrefix = "[companion-name]" } = params;
  const latestCompanions = selectLatestCompanions(companions);
  const contextMap = new Map<string, ResolvedCompanionNotificationContext>();

  if (latestCompanions.length === 0) {
    return contextMap;
  }

  const unresolvedCompanionIds = latestCompanions
    .filter((row) =>
      !normalizeCompanionName(row.companion_name)
      && !isAssignedCompanionName(row.cached_creature_name, buildCompanionIdentity(row)))
    .map((row) => row.id);

  let evolutionCards: CompanionEvolutionCardNameRow[] = [];
  if (unresolvedCompanionIds.length > 0) {
    const { data, error } = await supabase
      .from("companion_evolution_cards")
      .select("companion_id, evolution_stage, creature_name")
      .in("companion_id", unresolvedCompanionIds)
      .order("evolution_stage", { ascending: true });

    if (error) {
      throw error;
    }

    evolutionCards = (data as CompanionEvolutionCardNameRow[] | null) ?? [];
  }

  const cacheUpdates: Array<{ companionId: string; recoveredName: string }> = [];

  for (const companion of latestCompanions) {
    const resolution = resolveStoredCompanionDisplayName(companion, evolutionCards);

    if (resolution.recoveredName && resolution.recoveredName !== companion.cached_creature_name) {
      cacheUpdates.push({
        companionId: companion.id,
        recoveredName: resolution.recoveredName,
      });
    }

    if (resolution.source === "synthesized") {
      console.warn(`${logPrefix} synthesized canonical companion name`, {
        companionId: companion.id,
        userId: companion.user_id,
        currentStage: companion.current_stage,
        cachedCreatureName: companion.cached_creature_name,
        spiritAnimal: companion.spirit_animal,
        presetId: companion.preset_id ?? null,
      });
    }

    contextMap.set(companion.user_id, {
      displayName: resolution.displayName,
      customName: normalizeCompanionName(companion.companion_name),
      cachedCreatureName: resolution.recoveredName ?? companion.cached_creature_name,
      spiritAnimal: companion.spirit_animal,
      presetId: companion.preset_id ?? null,
      currentMood: companion.current_mood ?? null,
      inactiveDays: companion.inactive_days ?? null,
    });
  }

  await persistRecoveredCompanionNames(supabase, cacheUpdates, logPrefix);

  return contextMap;
}
