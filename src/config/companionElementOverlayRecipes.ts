import { getCompanionElement, type CompanionElementId } from "./companionCatalog";
import type {
  CompanionMotionEvent,
  CompanionMotionEventType,
} from "./companionMotion";

export type OverlayPlane = "backdrop" | "foreground";
export type CompanionMotionOverlayVariant = "companion" | "evolution";
export type ParticleStyleKind = "ember" | "crystal" | "spark" | "leaf" | "star" | "halo";

type AmbientVisualId =
  | "haze"
  | "veil"
  | "orbit"
  | "core"
  | "edgeGlow"
  | "crown"
  | "geometry"
  | "constellation"
  | "eggAura"
  | "particles";

type EventVisualId = "ring" | "secondaryRing" | "rays" | "swirl" | "beam";

interface OverlayColorSet {
  primary: string;
  secondary: string;
  accent: string;
}

interface EventBurstProfile {
  ringInset: string;
  secondaryInset: string;
  rays: boolean;
  swirl: boolean;
  beam: boolean;
}

interface CompanionElementOverlayRecipeDefinition {
  id: CompanionElementId;
  particleStyle: ParticleStyleKind;
  safeFrameInset: Record<CompanionMotionOverlayVariant, string>;
  stageUnlocks: {
    guardianCrown: number;
    mythicGeometry: number;
    ascendedConstellation: number;
  };
  ambientPlanes: Record<AmbientVisualId, OverlayPlane>;
  eventPlanes: Record<EventVisualId, OverlayPlane>;
  buildGradients: (colors: OverlayColorSet) => {
    haze: string;
    veil: string;
    orbit: string;
    core: string;
    edgeGlow: string;
    crown: string;
    beam: string;
  };
}

export interface CompanionElementOverlayRecipe {
  id: CompanionElementId;
  plane: OverlayPlane;
  variant: CompanionMotionOverlayVariant;
  particleStyle: ParticleStyleKind;
  colors: OverlayColorSet;
  safeFrameInset: string;
  stageUnlocks: CompanionElementOverlayRecipeDefinition["stageUnlocks"];
  gradients: ReturnType<CompanionElementOverlayRecipeDefinition["buildGradients"]>;
  visuals: Record<AmbientVisualId, boolean>;
  eventBurst: EventBurstProfile & {
    type: CompanionMotionEventType | null;
    visuals: Record<EventVisualId, boolean>;
  };
}

const DEFAULT_STAGE_UNLOCKS: CompanionElementOverlayRecipeDefinition["stageUnlocks"] = {
  guardianCrown: 21,
  mythicGeometry: 56,
  ascendedConstellation: 81,
};

const DEFAULT_EVENT_BURSTS: Record<CompanionMotionEventType, EventBurstProfile> = {
  idle: { ringInset: "18%", secondaryInset: "24%", rays: false, swirl: false, beam: false },
  xp_gain: { ringInset: "18%", secondaryInset: "26%", rays: false, swirl: false, beam: false },
  quest_complete: { ringInset: "16%", secondaryInset: "22%", rays: false, swirl: true, beam: false },
  streak: { ringInset: "12%", secondaryInset: "18%", rays: true, swirl: true, beam: false },
  wake: { ringInset: "10%", secondaryInset: "16%", rays: true, swirl: false, beam: true },
  evolution_start: { ringInset: "8%", secondaryInset: "14%", rays: false, swirl: true, beam: true },
  evolution_reveal: { ringInset: "4%", secondaryInset: "10%", rays: true, swirl: true, beam: true },
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const isHexColor = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());

const normalizeOverlayColor = (value: string | null | undefined, fallback: string) =>
  isHexColor(value) ? value.trim().toUpperCase() : fallback;

const createDefinition = (
  id: CompanionElementId,
  options: Omit<CompanionElementOverlayRecipeDefinition, "id" | "stageUnlocks"> & {
    stageUnlocks?: CompanionElementOverlayRecipeDefinition["stageUnlocks"];
  },
): CompanionElementOverlayRecipeDefinition => ({
  id,
  stageUnlocks: options.stageUnlocks ?? DEFAULT_STAGE_UNLOCKS,
  ...options,
});

export const COMPANION_ELEMENT_OVERLAY_DEFINITIONS = {
  fire: createDefinition("fire", {
    particleStyle: "ember",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "backdrop",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "backdrop",
      geometry: "backdrop",
      constellation: "foreground",
      eggAura: "backdrop",
      particles: "foreground",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "foreground",
      rays: "foreground",
      swirl: "backdrop",
      beam: "foreground",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 55%, ${hexToRgba(primary, 0.42)} 0%, ${hexToRgba(accent, 0.22)} 36%, transparent 74%)`,
      veil: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 40%, ${hexToRgba(primary, 0.18)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primary, 0.2)} 72deg, transparent 138deg, ${hexToRgba(accent, 0.18)} 216deg, transparent 300deg, ${hexToRgba(primary, 0.16)} 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.12)} 0%, ${hexToRgba(primary, 0.26)} 34%, transparent 76%)`,
      edgeGlow: `radial-gradient(circle at 50% 52%, transparent 46%, ${hexToRgba(accent, 0.22)} 68%, transparent 92%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 20deg, ${hexToRgba(accent, 0.22)} 20deg 28deg, transparent 28deg 50deg)`,
      beam: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.34)} 0%, transparent 60%)`,
    }),
  }),
  ice: createDefinition("ice", {
    particleStyle: "crystal",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "backdrop",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "backdrop",
      geometry: "backdrop",
      constellation: "foreground",
      eggAura: "backdrop",
      particles: "foreground",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "backdrop",
      rays: "foreground",
      swirl: "foreground",
      beam: "foreground",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 48%, ${hexToRgba(primary, 0.3)} 0%, ${hexToRgba(accent, 0.18)} 42%, transparent 72%)`,
      veil: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)} 0%, transparent 36%, ${hexToRgba(primary, 0.12)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(accent, 0.2)} 52deg, transparent 112deg, ${hexToRgba(primary, 0.18)} 200deg, transparent 272deg, ${hexToRgba(accent, 0.14)} 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.16)} 0%, ${hexToRgba(primary, 0.2)} 34%, transparent 76%)`,
      edgeGlow: `radial-gradient(circle at 50% 48%, transparent 44%, ${hexToRgba(secondary, 0.22)} 68%, transparent 92%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 16deg, ${hexToRgba(secondary, 0.24)} 16deg 20deg, transparent 20deg 42deg)`,
      beam: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.3)} 0%, transparent 62%)`,
    }),
  }),
  storm: createDefinition("storm", {
    particleStyle: "spark",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "foreground",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "backdrop",
      geometry: "foreground",
      constellation: "foreground",
      eggAura: "backdrop",
      particles: "foreground",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "foreground",
      rays: "foreground",
      swirl: "foreground",
      beam: "foreground",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 50%, ${hexToRgba(primary, 0.34)} 0%, ${hexToRgba(accent, 0.16)} 40%, transparent 72%)`,
      veil: `linear-gradient(135deg, ${hexToRgba(primary, 0.12)} 0%, transparent 35%, ${hexToRgba(accent, 0.16)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primary, 0.22)} 34deg, transparent 64deg, ${hexToRgba(accent, 0.2)} 116deg, transparent 168deg, ${hexToRgba(primary, 0.14)} 260deg, transparent 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.08)} 0%, ${hexToRgba(primary, 0.18)} 34%, transparent 76%)`,
      edgeGlow: `linear-gradient(135deg, transparent 10%, ${hexToRgba(accent, 0.18)} 50%, transparent 90%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 14deg, ${hexToRgba(primary, 0.22)} 14deg 18deg, transparent 18deg 36deg)`,
      beam: `linear-gradient(135deg, transparent 0%, ${hexToRgba(accent, 0.3)} 50%, transparent 100%)`,
    }),
  }),
  nature: createDefinition("nature", {
    particleStyle: "leaf",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "backdrop",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "backdrop",
      geometry: "backdrop",
      constellation: "backdrop",
      eggAura: "backdrop",
      particles: "backdrop",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "backdrop",
      rays: "foreground",
      swirl: "foreground",
      beam: "backdrop",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 52%, ${hexToRgba(primary, 0.34)} 0%, ${hexToRgba(accent, 0.18)} 38%, transparent 74%)`,
      veil: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 32%, ${hexToRgba(primary, 0.16)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primary, 0.16)} 68deg, transparent 130deg, ${hexToRgba(accent, 0.2)} 220deg, transparent 288deg, ${hexToRgba(primary, 0.12)} 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.08)} 0%, ${hexToRgba(primary, 0.18)} 34%, transparent 76%)`,
      edgeGlow: `radial-gradient(circle at 50% 56%, transparent 44%, ${hexToRgba(accent, 0.16)} 66%, transparent 92%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 24deg, ${hexToRgba(accent, 0.18)} 24deg 28deg, transparent 28deg 50deg)`,
      beam: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.28)} 0%, transparent 58%)`,
    }),
  }),
  void: createDefinition("void", {
    particleStyle: "star",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "backdrop",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "backdrop",
      geometry: "backdrop",
      constellation: "foreground",
      eggAura: "backdrop",
      particles: "backdrop",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "foreground",
      rays: "backdrop",
      swirl: "foreground",
      beam: "backdrop",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 50%, ${hexToRgba(primary, 0.34)} 0%, ${hexToRgba(accent, 0.18)} 38%, transparent 74%)`,
      veil: `linear-gradient(180deg, ${hexToRgba(accent, 0.12)} 0%, transparent 30%, ${hexToRgba(primary, 0.18)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(primary, 0.2)} 72deg, transparent 148deg, ${hexToRgba(accent, 0.22)} 218deg, transparent 298deg, ${hexToRgba(primary, 0.12)} 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.08)} 0%, ${hexToRgba(primary, 0.2)} 34%, transparent 76%)`,
      edgeGlow: `radial-gradient(circle at 50% 50%, transparent 40%, ${hexToRgba(accent, 0.2)} 68%, transparent 94%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 22deg, ${hexToRgba(accent, 0.18)} 22deg 26deg, transparent 26deg 46deg)`,
      beam: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.3)} 0%, transparent 58%)`,
    }),
  }),
  light: createDefinition("light", {
    particleStyle: "halo",
    safeFrameInset: { companion: "10%", evolution: "6%" },
    ambientPlanes: {
      haze: "backdrop",
      veil: "backdrop",
      orbit: "backdrop",
      core: "backdrop",
      edgeGlow: "foreground",
      crown: "foreground",
      geometry: "backdrop",
      constellation: "foreground",
      eggAura: "backdrop",
      particles: "foreground",
    },
    eventPlanes: {
      ring: "backdrop",
      secondaryRing: "foreground",
      rays: "foreground",
      swirl: "backdrop",
      beam: "foreground",
    },
    buildGradients: ({ primary, secondary, accent }) => ({
      haze: `radial-gradient(circle at 50% 48%, ${hexToRgba(primary, 0.32)} 0%, ${hexToRgba(accent, 0.24)} 34%, transparent 74%)`,
      veil: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)} 0%, transparent 34%, ${hexToRgba(primary, 0.14)} 100%)`,
      orbit: `conic-gradient(from 0deg, transparent 0deg, ${hexToRgba(accent, 0.22)} 88deg, transparent 152deg, ${hexToRgba(primary, 0.16)} 248deg, transparent 320deg, ${hexToRgba(accent, 0.14)} 360deg)`,
      core: `radial-gradient(circle at 50% 50%, ${hexToRgba(secondary, 0.12)} 0%, ${hexToRgba(primary, 0.18)} 34%, transparent 76%)`,
      edgeGlow: `radial-gradient(circle at 50% 50%, transparent 42%, ${hexToRgba(accent, 0.24)} 68%, transparent 92%)`,
      crown: `repeating-conic-gradient(from 0deg, transparent 0deg 18deg, ${hexToRgba(accent, 0.24)} 18deg 24deg, transparent 24deg 48deg)`,
      beam: `radial-gradient(circle at 50% 50%, ${hexToRgba(accent, 0.36)} 0%, transparent 62%)`,
    }),
  }),
} as const satisfies Record<CompanionElementId, CompanionElementOverlayRecipeDefinition>;

export const resolveCompanionElementOverlayRecipe = ({
  elementId,
  plane,
  variant,
  stage,
  event,
  primaryColor,
  secondaryColor,
}: {
  elementId: string | null | undefined;
  plane: OverlayPlane;
  variant: CompanionMotionOverlayVariant;
  stage: number;
  event?: CompanionMotionEvent | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}): CompanionElementOverlayRecipe => {
  const element = getCompanionElement(elementId);
  const definition = COMPANION_ELEMENT_OVERLAY_DEFINITIONS[element.id];
  const colors = {
    primary: normalizeOverlayColor(primaryColor, element.anchorColor),
    secondary: normalizeOverlayColor(secondaryColor, element.accentColor),
    accent: element.accentColor,
  } satisfies OverlayColorSet;
  const burst = event ? DEFAULT_EVENT_BURSTS[event.type] : DEFAULT_EVENT_BURSTS.idle;

  return {
    id: definition.id,
    plane,
    variant,
    particleStyle: definition.particleStyle,
    colors,
    safeFrameInset: definition.safeFrameInset[variant],
    stageUnlocks: definition.stageUnlocks,
    gradients: definition.buildGradients(colors),
    visuals: {
      haze: definition.ambientPlanes.haze === plane,
      veil: definition.ambientPlanes.veil === plane,
      orbit: definition.ambientPlanes.orbit === plane,
      core: definition.ambientPlanes.core === plane,
      edgeGlow: definition.ambientPlanes.edgeGlow === plane,
      crown: stage >= definition.stageUnlocks.guardianCrown && definition.ambientPlanes.crown === plane,
      geometry: stage >= definition.stageUnlocks.mythicGeometry && definition.ambientPlanes.geometry === plane,
      constellation:
        stage >= definition.stageUnlocks.ascendedConstellation
        && definition.ambientPlanes.constellation === plane,
      eggAura: variant === "companion" && stage <= 0 && definition.ambientPlanes.eggAura === plane,
      particles: definition.ambientPlanes.particles === plane,
    },
    eventBurst: {
      type: event?.type ?? null,
      ringInset: burst.ringInset,
      secondaryInset: burst.secondaryInset,
      rays: burst.rays && definition.eventPlanes.rays === plane,
      swirl: burst.swirl && definition.eventPlanes.swirl === plane,
      beam: burst.beam && definition.eventPlanes.beam === plane,
      visuals: {
        ring: definition.eventPlanes.ring === plane,
        secondaryRing: definition.eventPlanes.secondaryRing === plane,
        rays: burst.rays && definition.eventPlanes.rays === plane,
        swirl: burst.swirl && definition.eventPlanes.swirl === plane,
        beam: burst.beam && definition.eventPlanes.beam === plane,
      },
    },
  };
};
