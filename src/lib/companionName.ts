import { supabase } from "@/integrations/supabase/client";

export interface CompanionNameSource {
  id: string;
  current_stage: number;
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

const capitalizeWords = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeName = (value: string | null | undefined) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeComparable = (value: string | null | undefined) =>
  normalizeName(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? null;

const RESERVED_COMPANION_NAMES = new Set([
  "companion",
  "your companion",
  "unknown",
]);

const NAME_PREFIXES: Record<string, readonly string[]> = {
  fire: ["sol", "pyra", "igni", "kae", "ember"],
  water: ["aqua", "mar", "thal", "nera", "sere"],
  earth: ["gaia", "bryn", "terra", "mora", "verd"],
  air: ["aero", "zeph", "lyra", "cael", "syl"],
  light: ["luma", "heli", "auri", "cira", "sera"],
  shadow: ["nyx", "umbra", "vela", "mora", "shade"],
  void: ["vora", "noxa", "zael", "xyra", "khae"],
  electric: ["vol", "zira", "tesa", "arca", "rael"],
  cosmic: ["nova", "astra", "oria", "cela", "vexa"],
  default: ["kae", "lyra", "sera", "nova", "aeri"],
};

const NAME_MIDDLES = ["l", "r", "v", "th", "n", "s"];
const NAME_SUFFIXES = ["a", "is", "or", "en", "yn", "el", "ia", "eth"];

const hashSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

export const isAssignedCompanionName = (
  value: string | null | undefined,
  spiritAnimal?: string | null,
) => {
  const normalized = normalizeComparable(value);
  if (!normalized) return false;
  if (RESERVED_COMPANION_NAMES.has(normalized)) return false;

  const normalizedSpiritAnimal = normalizeComparable(spiritAnimal);
  if (normalizedSpiritAnimal && normalized === normalizedSpiritAnimal) {
    return false;
  }

  return true;
};

const synthesizeAssignedCompanionName = (companion: CompanionNameSource) => {
  const normalizedElement = normalizeComparable(companion.core_element) ?? "default";
  const prefixPool = NAME_PREFIXES[normalizedElement] ?? NAME_PREFIXES.default;
  const seed = hashSeed(
    `${companion.id}:${normalizedElement}:${normalizeComparable(companion.spirit_animal) ?? ""}`,
  );

  const prefix = prefixPool[seed % prefixPool.length] ?? NAME_PREFIXES.default[0];
  const middle = NAME_MIDDLES[Math.floor(seed / 7) % NAME_MIDDLES.length] ?? "";
  const suffix = NAME_SUFFIXES[Math.floor(seed / 17) % NAME_SUFFIXES.length] ?? "a";
  const combined = `${prefix}${middle}${suffix}`
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z]/gi, "");

  return capitalizeWords(combined);
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
  if (isAssignedCompanionName(cachedName, companion.spirit_animal)) {
    return cachedName;
  }

  try {
    const stageName = await fetchNameForStage(companion.id, companion.current_stage);
    if (isAssignedCompanionName(stageName, companion.spirit_animal)) {
      cacheCompanionName(companion.id, stageName);
      return stageName;
    }

    const earliestName = await fetchEarliestName(companion.id);
    if (isAssignedCompanionName(earliestName, companion.spirit_animal)) {
      cacheCompanionName(companion.id, earliestName);
      return earliestName;
    }
  } catch (error) {
    console.error("Failed to resolve companion name:", error);
  }

  const synthesizedName = synthesizeAssignedCompanionName(companion);
  cacheCompanionName(companion.id, synthesizedName);
  return synthesizedName || resolveFallbackName(fallback, companion.spirit_animal);
};
