import type { CompanionElementId } from "@/config/companionCatalog";
import { getProgressionTier } from "@/config/progression";

export const COMPANION_HABITATS: Record<CompanionElementId, string> = {
  fire: "/companion-habitats/fire.webp",
  ice: "/companion-habitats/ice.webp",
  storm: "/companion-habitats/storm.webp",
  nature: "/companion-habitats/nature.webp",
  void: "/companion-habitats/void.webp",
  light: "/companion-habitats/light.webp",
};

export function CompanionHabitat({ element, stage }: { element?: string | null; stage: number }) {
  const key = element?.trim().toLowerCase();
  const tier = getProgressionTier(stage);
  const src = key && Object.prototype.hasOwnProperty.call(COMPANION_HABITATS, key)
    ? tier === "hatchling" ? COMPANION_HABITATS[key as CompanionElementId]
      : `/companion-habitats/${key}-${tier}.webp`
    : null;

  // Eggs already have their own scene. Preserve that until the hatch reveal.
  if (!Number.isFinite(stage) || stage < 1 || !src) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="companion-habitat"
      data-element={key}
      data-tier={tier}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-slate-950"
    >
      <img key={src} src={src} alt="" className="h-full w-full object-cover" decoding="async"
        onError={(event) => {
          const fallback = COMPANION_HABITATS[key as CompanionElementId];
          if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback;
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/35" />
      <div className="absolute inset-x-[18%] bottom-[8%] h-[12%] rounded-[100%] bg-black/30 blur-lg" />
    </div>
  );
}
