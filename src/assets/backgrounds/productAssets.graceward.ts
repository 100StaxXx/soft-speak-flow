import gracewardTodayFallback from "./graceward-today-fallback.webp";
import gracewardCompanionFallback from "./graceward-companion-fallback.webp";
import gracewardGuideFallback from "./graceward-guide-fallback.webp";

const asset = (src: string) => ({ src, src2x: src });

const today = asset(gracewardTodayFallback);
const companion = asset(gracewardCompanionFallback);
const guide = asset(gracewardGuideFallback);

export const productBackgroundAssets = {
  product: "graceward" as const,
  // Preserve the legacy export surface while keeping every fallback inside
  // Graceward's own visual family.
  welcome: companion,
  galaxyPortal: guide,
  path1: today,
  path2: companion,
  signin: guide,
  questsSeed: today,
  campaignsSeed: guide,
  starPathPlaceholders: [today, guide, companion],
  cinematicFallbacks: {
    guide,
    quests: today,
    campaigns: undefined,
    companion,
    profile: undefined,
  },
  legacy: [today, guide, companion],
};
