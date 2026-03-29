export const JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE = "1536x1024" as const;
export const JOURNEY_PATH_RENDER_VERSION = 2 as const;

export interface JourneyPathPromptContext {
  worldContext?: {
    worldName?: string;
    worldEra?: string;
    currentLocation?: string;
    nextLocation?: string;
  };
  companionType?: string;
  coreElement?: string;
  themeColor?: string;
  storyType?: string | null;
  image_size?: string;
  render_version?: number;
}

export const normalizeJourneyPathPromptContext = (value: unknown): JourneyPathPromptContext | null => (
  typeof value === "object" && value !== null
    ? value as JourneyPathPromptContext
    : null
);

export const needsJourneyPathLandscapeRefresh = (value: unknown) => {
  const promptContext = normalizeJourneyPathPromptContext(value);

  return !promptContext
    || promptContext.image_size !== JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE
    || promptContext.render_version !== JOURNEY_PATH_RENDER_VERSION;
};
