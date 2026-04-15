export interface CompanionIdentityContext {
  spiritAnimal?: string | null;
  presetId?: string | null;
}

export type CompanionIdentityLike = string | CompanionIdentityContext | null | undefined;

const RESERVED_COMPANION_NAMES = new Set([
  "companion",
  "your companion",
  "unknown",
]);

const NAME_PREFIXES: Record<string, readonly string[]> = {
  fire: ["sol", "pyra", "igni", "kae", "ember"],
  storm: ["vol", "zira", "tesa", "arca", "rael"],
  void: ["vora", "noxa", "zael", "xyra", "khae"],
  nature: ["gaia", "verd", "syl", "mora", "bryn"],
  water: ["aqua", "mar", "thal", "nera", "sere"],
  earth: ["gaia", "bryn", "terra", "mora", "verd"],
  air: ["aero", "zeph", "lyra", "cael", "syl"],
  light: ["luma", "heli", "auri", "cira", "sera"],
  shadow: ["nyx", "umbra", "vela", "mora", "shade"],
  electric: ["vol", "zira", "tesa", "arca", "rael"],
  cosmic: ["nova", "astra", "oria", "cela", "vexa"],
  default: ["kae", "lyra", "sera", "nova", "aeri"],
};

const NAME_MIDDLES = ["l", "r", "v", "th", "n", "s"];
const NAME_SUFFIXES = ["a", "is", "or", "en", "yn", "el", "ia", "eth"];

// Keep this lightweight and environment-safe so both app code and Deno functions
// can share the same canonical-name validation rules without importing the full
// companion catalog module.
const PRESET_DISPLAY_NAMES: Record<string, string> = {
  dragon: "Dragon",
  wolf: "Wolf",
  fox: "Kitsune",
  owl: "Owl",
  lion: "Lion",
  phoenix: "Phoenix",
  pegasus: "Pegasus",
  griffin: "Griffin",
  sphinx: "Sphinx",
  leviathan: "Leviathan",
  mechanicaldragon: "Mechanical Dragon",
  tanuki: "Tanuki",
  raven: "Raven",
  buttercat: "Buttercat",
};

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeCompanionName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeComparable(value: string | null | undefined): string | null {
  return normalizeCompanionName(value)
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? null;
}

function resolveIdentityContext(identity: CompanionIdentityLike): CompanionIdentityContext {
  if (typeof identity === "string") {
    return { spiritAnimal: identity };
  }

  return identity ?? {};
}

export function getCompanionIdentityLabels(identity: CompanionIdentityLike): Set<string> {
  const { spiritAnimal, presetId } = resolveIdentityContext(identity);
  const labels = new Set<string>();

  const normalizedSpiritAnimal = normalizeComparable(spiritAnimal);
  if (normalizedSpiritAnimal) {
    labels.add(normalizedSpiritAnimal);
  }

  const normalizedPresetId = normalizeComparable(presetId);
  if (normalizedPresetId) {
    labels.add(normalizedPresetId);
  }

  const normalizedPresetDisplayName = normalizeComparable(
    presetId ? PRESET_DISPLAY_NAMES[presetId] ?? null : null,
  );
  if (normalizedPresetDisplayName) {
    labels.add(normalizedPresetDisplayName);
  }

  return labels;
}

export function isAssignedCompanionName(
  value: string | null | undefined,
  identity: CompanionIdentityLike,
): boolean {
  const normalized = normalizeComparable(value);
  if (!normalized) return false;
  if (RESERVED_COMPANION_NAMES.has(normalized)) return false;

  return !getCompanionIdentityLabels(identity).has(normalized);
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function synthesizeAssignedCompanionName(
  seedInput: string,
  element: string | null | undefined,
  identity: CompanionIdentityLike,
): string {
  const normalizedElement = normalizeComparable(element) ?? "default";
  const prefixPool = NAME_PREFIXES[normalizedElement] ?? NAME_PREFIXES.default;
  const seed = hashSeed(
    `${seedInput}:${normalizedElement}:${[...getCompanionIdentityLabels(identity)].sort().join("|")}`,
  );

  const prefix = prefixPool[seed % prefixPool.length] ?? NAME_PREFIXES.default[0];
  const middle = NAME_MIDDLES[Math.floor(seed / 7) % NAME_MIDDLES.length] ?? "";
  const suffix = NAME_SUFFIXES[Math.floor(seed / 17) % NAME_SUFFIXES.length] ?? "a";
  const combined = `${prefix}${middle}${suffix}`
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[^a-z]/gi, "");

  return capitalizeWords(combined);
}
