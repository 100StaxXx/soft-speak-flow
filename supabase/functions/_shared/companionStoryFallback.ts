export interface CompanionStoryFallbackInput {
  stage: number;
  userName: string;
  species: string;
  element: string;
  chapterTitle: string;
  chapterTheme: string;
  worldScale: string;
  isCosmiqCompanion: boolean;
}

export interface CompanionStoryFallback {
  chapter_title: string;
  intro_line: string;
  main_story: string;
  bond_moment: string;
  life_lesson: string;
  lore_expansion: string[];
  next_hook: string;
}

const safeText = (value: unknown, fallback: string, maxLength = 120): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

export const buildCompanionStoryFallback = (
  input: CompanionStoryFallbackInput,
): CompanionStoryFallback => {
  const stage = Number.isFinite(input.stage) ? Math.max(0, Math.floor(input.stage)) : 0;
  const userName = safeText(input.userName, "Hero", 80);
  const species = safeText(input.species, "companion", 80);
  const element = safeText(input.element, "warm", 60).toLowerCase();
  const chapterTitle = safeText(input.chapterTitle, stage === 0 ? "Prologue" : "A New Chapter", 100);
  const chapterTheme = safeText(input.chapterTheme, "a faithful next step", 180);
  const worldScale = safeText(input.worldScale, "the path immediately ahead", 180);
  const isMechanicalDragon = species.toLowerCase() === "mechanical dragon";

  if (stage === 0) {
    const mechanicalDetail = isMechanicalDragon
      ? " Across its surface, a metallic-scale pattern surrounds tiny articulated-joint diagrams, a clockwork seal, and the steady mark of an energy core—promises held safely inside rather than a creature already revealed."
      : " Fine lines of light gather across the shell like a map that has not decided where its first road will lead.";

    return {
      chapter_title: "The First Answer",
      intro_line: `A quiet pulse of ${element} light moves beneath the egg's shell, answering ${userName}'s nearness.`,
      main_story: `${userName} finds the egg resting where the familiar world gives way to ${worldScale}. It does not hatch, and no formed creature can yet be seen. Instead, warmth gathers beneath the shell in a slow rhythm, pausing whenever ${userName} steps back and returning when they draw close.${mechanicalDetail} A small obstacle blocks the safest way home, so ${userName} chooses patience over force and makes room for the egg to respond. The shell tilts once toward that gentler path. By the time the light settles, the beginning feels less like an object discovered and more like a promise shared: ${chapterTheme}.`,
      bond_moment: `${userName} rests a hand beside the egg, and its inner light matches the quiet pace of their breathing.`,
      life_lesson: input.isCosmiqCompanion
        ? "A beginning does not need to be rushed to become real; attention is already a form of courage."
        : "A faithful beginning does not need to be rushed; patient attention can be its own act of courage.",
      lore_expansion: [
        "World Truth: Living eggs answer steady presence before they answer words.",
        `Historical Reference: Old pathkeepers called the first ${element} glow a companion's earliest hello.`,
        "Foreshadowing Seed: A faint line of light now points toward a sheltered place beyond the next rise.",
      ],
      next_hook: "Before the path goes dark, the egg gives one more deliberate pulse—and something farther ahead answers.",
    };
  }

  const mechanicalDetail = isMechanicalDragon
    ? ` Metallic scales catch the ${element} light while articulated joints adjust with care; quiet gears turn around a steady energy core.`
    : ` A trace of ${element} light follows the ${species}'s movement without changing its natural form.`;

  return {
    chapter_title: chapterTitle === "A New Chapter" ? "The Returning Path" : `${chapterTitle}: The Returning Path`,
    intro_line: `${species} notices the opening in the path before ${userName} does, then waits for them to choose it together.`,
    main_story: `${userName} and the ${species} reach a place shaped by ${chapterTheme}. The way forward is not sealed, but it asks for more attention than speed. The companion shifts closer, studies the obstacle, and looks back instead of charging ahead.${mechanicalDetail} ${userName} tests one careful step, then another, until a hidden crossing appears within ${worldScale}. Nothing about the choice is flashy; its strength comes from noticing what force would have missed. The ${species} responds with an unmistakable gesture of trust and takes the crossing at ${userName}'s side. Behind them, the path remains open—a small proof that returning with care can change what becomes possible next.`,
    bond_moment: `The ${species} pauses shoulder-to-shoulder with ${userName}, holding the moment until both are ready to move.`,
    life_lesson: input.isCosmiqCompanion
      ? "Progress can begin with the choice to notice, adjust, and try the next honest step together."
      : "Grace leaves room to notice, adjust, and take the next faithful step without pretending the path is easy.",
    lore_expansion: [
      "World Truth: Paths remember travelers who cross them with care.",
      "Historical Reference: Early wayfinders marked safe crossings with a single open circle.",
      `Foreshadowing Seed: A distant ${element} signal repeats the companion's new rhythm from beyond the ridge.`,
    ],
    next_hook: `The ${species} turns toward the answering signal, already listening for what the next horizon will ask of them both.`,
  };
};
