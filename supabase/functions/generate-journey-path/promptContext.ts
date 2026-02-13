export interface WorldContext {
  worldName: string;
  worldEra: string;
  currentLocation: string;
  nextLocation: string;
}

export interface MilestoneVisualTokens {
  timeOfDay: string;
  weatherMood: string;
  pathComplexity: string;
  chapterAtmosphere: string;
}

const TIME_OF_DAY = [
  "pre-dawn glow",
  "golden sunrise",
  "crisp midday light",
  "amber sunset",
  "moonlit twilight",
  "starry midnight",
] as const;

const WEATHER_MOODS = [
  "clear skies with drifting stardust",
  "gentle mist and cool air",
  "light rain with reflective puddles",
  "electrical storm clouds in the distance",
  "snow-kissed breeze and shimmering frost",
  "aurora-lit heavens",
] as const;

const PATH_COMPLEXITY = [
  "wide welcoming trail with gentle curves",
  "branching path with subtle forked routes",
  "elevated ridges and layered switchbacks",
  "ancient stoneway with mysterious side passages",
  "narrow floating bridges over cosmic terrain",
  "labyrinthine ascent with ornate wayfinding markers",
] as const;

const CHAPTER_ATMOSPHERES = [
  "hopeful beginning energy",
  "rising confidence and momentum",
  "adventurous tension and discovery",
  "intense challenge and determination",
  "reflective calm after growth",
  "legendary culmination with triumphant wonder",
] as const;

const pickDeterministic = <T extends readonly string[]>(values: T, milestoneIndex: number): T[number] => {
  const safeIndex = Number.isFinite(milestoneIndex) ? Math.max(0, Math.floor(milestoneIndex)) : 0;
  return values[safeIndex % values.length];
};

export const deriveMilestoneVisualTokens = (milestoneIndex: number): MilestoneVisualTokens => ({
  timeOfDay: pickDeterministic(TIME_OF_DAY, milestoneIndex),
  weatherMood: pickDeterministic(WEATHER_MOODS, milestoneIndex),
  pathComplexity: pickDeterministic(PATH_COMPLEXITY, milestoneIndex),
  chapterAtmosphere: pickDeterministic(CHAPTER_ATMOSPHERES, milestoneIndex),
});

interface BuildJourneyPathPromptParams {
  worldContext: WorldContext;
  visualTheme: string;
  companionType: string;
  coreElement: string;
  themeColor: string;
  milestoneIndex: number;
}

export const buildJourneyPathPrompt = ({
  worldContext,
  visualTheme,
  companionType,
  coreElement,
  themeColor,
  milestoneIndex,
}: BuildJourneyPathPromptParams): { prompt: string; visualTokens: MilestoneVisualTokens } => {
  const visualTokens = deriveMilestoneVisualTokens(milestoneIndex);

  const prompt = `A breathtaking panoramic path through ${worldContext.worldName} in ${worldContext.worldEra}.
The journey moves from ${worldContext.currentLocation} toward ${worldContext.nextLocation}, preserving continuity with prior chapters.
Visual theme: ${visualTheme}. Time of day: ${visualTokens.timeOfDay}. Weather: ${visualTokens.weatherMood}.
Path design: ${visualTokens.pathComplexity}. Chapter mood: ${visualTokens.chapterAtmosphere}.
Style it as a route suitable for a ${companionType} companion with ${coreElement} energy.
Color palette: rich ${themeColor} tones with cosmic highlights and atmospheric depth.
Style directives: ethereal fantasy illustration, dreamy cinematic atmosphere, horizontal landscape, magical lighting, no text, no visible characters.
Ultra high resolution.`;

  return { prompt, visualTokens };
};
