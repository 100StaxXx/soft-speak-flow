export const NOTIFICATION_COMPANION_FALLBACK_NAME = "Your companion";

export interface NotificationCompanionNameContext {
  displayName?: string | null;
  cachedCreatureName?: string | null;
  spiritAnimal?: string | null;
}

export interface CompanionNameSourceRow {
  id: string;
  user_id: string;
  current_stage: number | null;
  cached_creature_name: string | null;
  spirit_animal: string | null;
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
  source: "cache" | "current_stage_card" | "earliest_card" | "fallback";
}

export interface ResolvedCompanionNotificationContext extends NotificationCompanionNameContext {
  currentMood?: string | null;
  inactiveDays?: number | null;
}

function normalizeCompanionName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeComparable(value: string | null | undefined): string | null {
  return normalizeCompanionName(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? null;
}

const RESERVED_COMPANION_NAMES = new Set([
  "companion",
  "your companion",
  "unknown",
]);

export function isAssignedCompanionName(
  value: string | null | undefined,
  spiritAnimal?: string | null,
): boolean {
  const normalized = normalizeComparable(value);
  if (!normalized) return false;
  if (RESERVED_COMPANION_NAMES.has(normalized)) return false;

  const normalizedSpiritAnimal = normalizeComparable(spiritAnimal);
  if (normalizedSpiritAnimal && normalized === normalizedSpiritAnimal) {
    return false;
  }

  return true;
}

export function getNotificationSafeCompanionName(
  value: string | null | undefined,
  spiritAnimal?: string | null,
): string {
  return isAssignedCompanionName(value, spiritAnimal)
    ? normalizeCompanionName(value) ?? NOTIFICATION_COMPANION_FALLBACK_NAME
    : NOTIFICATION_COMPANION_FALLBACK_NAME;
}

export function resolveStoredCompanionDisplayName(
  companion: Pick<CompanionNameSourceRow, "id" | "current_stage" | "cached_creature_name" | "spirit_animal">,
  evolutionCards: CompanionEvolutionCardNameRow[],
): CompanionNameResolution {
  if (isAssignedCompanionName(companion.cached_creature_name, companion.spirit_animal)) {
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
      isAssignedCompanionName(card.creature_name, companion.spirit_animal)
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
    isAssignedCompanionName(card.creature_name, companion.spirit_animal)
  );

  if (earliestValidCard?.creature_name) {
    return {
      displayName: earliestValidCard.creature_name.trim(),
      recoveredName: earliestValidCard.creature_name.trim(),
      source: "earliest_card",
    };
  }

  return {
    displayName: NOTIFICATION_COMPANION_FALLBACK_NAME,
    recoveredName: null,
    source: "fallback",
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
    .filter((row) => !isAssignedCompanionName(row.cached_creature_name, row.spirit_animal))
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

    if (resolution.source === "fallback") {
      console.warn(`${logPrefix} no valid proper companion name found`, {
        companionId: companion.id,
        userId: companion.user_id,
        currentStage: companion.current_stage,
        cachedCreatureName: companion.cached_creature_name,
        spiritAnimal: companion.spirit_animal,
      });
    }

    contextMap.set(companion.user_id, {
      displayName: resolution.displayName,
      cachedCreatureName: resolution.recoveredName ?? companion.cached_creature_name,
      spiritAnimal: companion.spirit_animal,
      currentMood: companion.current_mood ?? null,
      inactiveDays: companion.inactive_days ?? null,
    });
  }

  await persistRecoveredCompanionNames(supabase, cacheUpdates, logPrefix);

  return contextMap;
}
