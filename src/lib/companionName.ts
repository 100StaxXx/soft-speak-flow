import { supabase } from "@/integrations/supabase/client";
import {
  isAssignedCompanionName,
  normalizeCompanionName,
  synthesizeAssignedCompanionName,
} from "@/lib/companionNameIdentity";

export interface CompanionNameSource {
  id: string;
  current_stage: number;
  preset_id?: string | null;
  cached_creature_name?: string | null;
  spirit_animal?: string | null;
  core_element?: string | null;
}

export type CompanionNameFallbackPolicy = "empty" | "companion" | "species";

interface ResolveCompanionNameOptions {
  companion?: CompanionNameSource | null;
  overrideName?: string | null;
  fallback?: CompanionNameFallbackPolicy;
}

const resolveFallbackName = (
  fallback: CompanionNameFallbackPolicy,
  spiritAnimal?: string | null,
) => {
  switch (fallback) {
    case "species": {
      const species = normalizeCompanionName(spiritAnimal);
      return species ? species.replace(/\b\w/g, (char) => char.toUpperCase()) : "Companion";
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

  return normalizeCompanionName(data?.creature_name);
};

const fetchEarliestName = async (companionId: string) => {
  const { data } = await supabase
    .from("companion_evolution_cards")
    .select("creature_name")
    .eq("companion_id", companionId)
    .order("evolution_stage", { ascending: true })
    .limit(1)
    .maybeSingle();

  return normalizeCompanionName(data?.creature_name);
};

export { isAssignedCompanionName };

export const resolveCompanionName = async ({
  companion,
  overrideName,
  fallback = "empty",
}: ResolveCompanionNameOptions): Promise<string> => {
  if (overrideName !== undefined) {
    return normalizeCompanionName(overrideName) ?? resolveFallbackName(fallback, companion?.spirit_animal);
  }

  if (!companion) {
    return resolveFallbackName(fallback);
  }

  const companionIdentity = {
    spiritAnimal: companion.spirit_animal,
    presetId: companion.preset_id,
  };

  const cachedName = normalizeCompanionName(companion.cached_creature_name);
  if (isAssignedCompanionName(cachedName, companionIdentity)) {
    return cachedName;
  }

  try {
    const stageName = await fetchNameForStage(companion.id, companion.current_stage);
    if (isAssignedCompanionName(stageName, companionIdentity)) {
      cacheCompanionName(companion.id, stageName);
      return stageName;
    }

    const earliestName = await fetchEarliestName(companion.id);
    if (isAssignedCompanionName(earliestName, companionIdentity)) {
      cacheCompanionName(companion.id, earliestName);
      return earliestName;
    }
  } catch (error) {
    console.error("Failed to resolve companion name:", error);
  }

  const synthesizedName = synthesizeAssignedCompanionName(
    companion.id,
    companion.core_element,
    companionIdentity,
  );
  cacheCompanionName(companion.id, synthesizedName);
  return synthesizedName || resolveFallbackName(fallback, companion.spirit_animal);
};
