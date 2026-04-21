export type CompanionAgentRolloutSurface = "companion" | "journeys";

const normalizeFlag = (value: string | undefined, fallback = true) => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
};

const COMPANION_SURFACE_FLAG = normalizeFlag(
  import.meta.env.VITE_COMPANION_AGENT_COMPANION_SURFACE_ENABLED,
  true,
);

const JOURNEYS_SURFACE_FLAG = normalizeFlag(
  import.meta.env.VITE_COMPANION_AGENT_JOURNEYS_SURFACE_ENABLED,
  true,
);

export const isCompanionAgentSurfaceEnabled = (
  surface: CompanionAgentRolloutSurface,
) => surface === "companion"
  ? COMPANION_SURFACE_FLAG
  : JOURNEYS_SURFACE_FLAG;
