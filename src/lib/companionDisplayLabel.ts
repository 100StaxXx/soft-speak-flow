import { normalizeCompanionName } from "@/lib/companionNameIdentity";
import { formatDisplayLabel } from "@/lib/utils";

export interface CompanionDisplayLabelSource {
  companion_name?: string | null;
  cached_creature_name?: string | null;
  spirit_animal?: string | null;
}

export const resolveCompanionDisplayLabel = (
  companion: CompanionDisplayLabelSource | null | undefined,
  fallback = "Companion",
): string => {
  const customName = normalizeCompanionName(companion?.companion_name);
  if (customName) return customName;

  const cachedName = normalizeCompanionName(companion?.cached_creature_name);
  if (cachedName) return cachedName;

  const spiritAnimal = normalizeCompanionName(companion?.spirit_animal);
  if (spiritAnimal) return formatDisplayLabel(spiritAnimal);

  return fallback;
};

export const toPossessiveCompanionLabel = (label: string): string =>
  label.endsWith("s") ? `${label}'` : `${label}'s`;
