import { getProgressionTier } from "../config/progression.ts";

export const COMPANION_HABITATS = {
  fire: "/companion-habitats/fire.webp",
  ice: "/companion-habitats/ice.webp",
  storm: "/companion-habitats/storm.webp",
  nature: "/companion-habitats/nature.webp",
  void: "/companion-habitats/void.webp",
  light: "/companion-habitats/light.webp",
} as const;

/** Shared by the on-screen portrait and the server's video input compositor. */
export function getCompanionHabitatPath(element: string | null | undefined, stage: number): string | null {
  const key = element?.trim().toLowerCase();
  if (!Number.isFinite(stage) || stage < 1 || !key || !Object.hasOwn(COMPANION_HABITATS, key)) return null;
  const tier = getProgressionTier(stage);
  return tier === "hatchling"
    ? COMPANION_HABITATS[key as keyof typeof COMPANION_HABITATS]
    : `/companion-habitats/${key}-${tier}.webp`;
}
