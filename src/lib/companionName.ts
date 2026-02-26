import { supabase } from "@/integrations/supabase/client";

export interface CompanionNameSource {
  id: string;
  current_stage: number;
  cached_creature_name?: string | null;
  spirit_animal?: string | null;
}

export type CompanionNameFallbackPolicy = "empty" | "companion" | "species";

interface ResolveCompanionNameOptions {
  companion?: CompanionNameSource | null;
  overrideName?: string | null;
  fallback?: CompanionNameFallbackPolicy;
}

const capitalizeWords = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeName = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveFallbackName = (
  fallback: CompanionNameFallbackPolicy,
  spiritAnimal?: string | null,
) => {
  switch (fallback) {
    case "species": {
      const species = normalizeName(spiritAnimal);
      return species ? capitalizeWords(species) : "Companion";
    }
    case "companion":
      return "Companion";
    case "empty":
    default:
      return "";
  }
};

const cacheCompanionName = (companionId: string, name: string) => {
  void supabase
    .from("user_companion")
    .update({ cached_creature_name: name })
    .eq("id", companionId);
};

const fetchNameForStage = async (companionId: string, stage: number) => {
  const { data } = await supabase
    .from("companion_evolution_cards")
    .select("creature_name")
    .eq("companion_id", companionId)
    .eq("evolution_stage", stage)
    .maybeSingle();

  return normalizeName(data?.creature_name);
};

const fetchEarliestName = async (companionId: string) => {
  const { data } = await supabase
    .from("companion_evolution_cards")
    .select("creature_name")
    .eq("companion_id", companionId)
    .order("evolution_stage", { ascending: true })
    .limit(1)
    .maybeSingle();

  return normalizeName(data?.creature_name);
};

export const resolveCompanionName = async ({
  companion,
  overrideName,
  fallback = "empty",
}: ResolveCompanionNameOptions): Promise<string> => {
  if (overrideName !== undefined) {
    return normalizeName(overrideName) ?? resolveFallbackName(fallback, companion?.spirit_animal);
  }

  if (!companion) {
    return resolveFallbackName(fallback);
  }

  const cachedName = normalizeName(companion.cached_creature_name);
  if (cachedName) {
    return cachedName;
  }

  try {
    const stageName = await fetchNameForStage(companion.id, companion.current_stage);
    if (stageName) {
      cacheCompanionName(companion.id, stageName);
      return stageName;
    }

    const earliestName = await fetchEarliestName(companion.id);
    if (earliestName) {
      cacheCompanionName(companion.id, earliestName);
      return earliestName;
    }
  } catch (error) {
    console.error("Failed to resolve companion name:", error);
  }

  return resolveFallbackName(fallback, companion.spirit_animal);
};
