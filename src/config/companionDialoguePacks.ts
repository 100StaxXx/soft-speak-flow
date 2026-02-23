export const COMPANION_DIALOGUE_BUCKET_COUNTS = {
  base_greetings: 30,
  growth_moments: 20,
  clarity_moments: 16,
  mystery_moments: 12,
  repair_moments: 20,
  legendary_moments: 10,
  recovery_moments: 12,
  critical_gentle_moments: 10,
} as const;

export type CompanionDialogueBucketKey = keyof typeof COMPANION_DIALOGUE_BUCKET_COUNTS;

export const COMPANION_DIALOGUE_TONE_PACKS = ["soft", "playful", "witty_sassy"] as const;
export type CompanionDialogueTonePack = (typeof COMPANION_DIALOGUE_TONE_PACKS)[number];

export type CompanionShimmerType = "none" | "green" | "blue" | "purple" | "red" | "gold";

export interface CompanionDialogueLine {
  id: string;
  text: string;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
}

type RawTonePack = Record<CompanionDialogueBucketKey, string[]>;

const buildLinesFromParts = (
  starts: string[],
  middles: string[],
  endings: string[],
  count: number,
): string[] => {
  const lines: string[] = [];
  const seen = new Set<string>();

  for (const start of starts) {
    for (const middle of middles) {
      for (const ending of endings) {
        const sentence = `${start} ${middle}${ending}`.replace(/\s+/g, " ").trim();
        if (seen.has(sentence)) continue;
        seen.add(sentence);
        lines.push(sentence);
        if (lines.length === count) {
          return lines;
        }
      }
    }
  }

  throw new Error(`Unable to compose ${count} lines from provided fragments.`);
};

const sanitizeLine = (value: string) => value.trim().replace(/\s+/g, " ");

const ensureCount = (
  tone: CompanionDialogueTonePack,
  bucket: CompanionDialogueBucketKey,
  lines: string[],
) => {
  const expected = COMPANION_DIALOGUE_BUCKET_COUNTS[bucket];
  if (lines.length !== expected) {
    throw new Error(
      `Tone "${tone}" bucket "${bucket}" has ${lines.length} lines; expected ${expected}.`,
    );
  }
};

const toDialogueLines = (
  tone: CompanionDialogueTonePack,
  bucket: CompanionDialogueBucketKey,
  lines: string[],
): CompanionDialogueLine[] =>
  lines.map((text, index) => ({
    id: `${tone}.${bucket}.${String(index + 1).padStart(2, "0")}`,
    text: sanitizeLine(text),
    tonePack: tone,
    bucketKey: bucket,
  }));

const SOFT_RAW: RawTonePack = {
  base_greetings: buildLinesFromParts(
    [
      "Could we",
      "Would you like to",
      "Let's",
      "Maybe we can",
      "I would love to",
      "Want to",
    ],
    [
      "take one small step together",
      "start with a tiny win",
      "give today a gentle beginning",
      "complete one quick focus block",
      "reconnect with a short reset",
      "do one focused task",
    ],
    [
      " right now?",
      " before the day drifts?",
      " and see how it feels?",
      " while the energy is here?",
      " in just a few minutes?",
    ],
    COMPANION_DIALOGUE_BUCKET_COUNTS.base_greetings,
  ),
  growth_moments: buildLinesFromParts(
    [
      "I can feel",
      "There is",
      "We are close to",
      "This feels like",
      "Our momentum is",
    ],
    [
      "a growth surge waiting for one good move",
      "a bright push toward the next evolution",
      "a powerful step if we complete one priority",
      "a perfect moment to stack progress",
      "a warm spark asking for one more win",
    ],
    [" right now.", " today.", " if you are up for it."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.growth_moments,
  ),
  clarity_moments: buildLinesFromParts(
    ["Want to", "Could we", "Let's", "I can help us"],
    [
      "pick the next right priority step",
      "zoom out for thirty seconds and choose clearly",
      "find the one task that matters most",
      "clean up the plan before we push harder",
    ],
    [" right now?", " in one minute?", " before we continue?"],
    COMPANION_DIALOGUE_BUCKET_COUNTS.clarity_moments,
  ),
  mystery_moments: [
    "I found something unusual. Want to see it?",
    "I saved a tiny surprise for you.",
    "Something rare just brushed past us.",
    "I remembered a hidden detail about your path.",
    "A quiet mystery opened up. Tap in?",
    "I have a strange little gift for this moment.",
    "There is a whisper here I have not shared yet.",
    "A curious thread appeared. Want to pull it?",
    "I caught a sparkle that feels important.",
    "This moment has surprise energy all over it.",
    "I have a secret line just for now.",
    "Something playful is waiting behind this tap.",
  ],
  repair_moments: buildLinesFromParts(
    ["We can", "Let's", "No shame", "I can", "Give me"],
    [
      "save today with one small win",
      "reset the day with one easy task",
      "rebuild our rhythm from a tiny action",
      "turn this drift around together",
      "start a clean comeback right now",
    ],
    [" right now.", " in two minutes.", " before this gets heavier."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.repair_moments,
  ),
  legendary_moments: [
    "Something inside me shifted.",
    "This feels like a turning point.",
    "I have been waiting for this exact moment.",
    "The air around us feels legendary.",
    "This step could change our story.",
    "I can feel a rare threshold opening.",
    "Today has ascension energy.",
    "What we do next will matter deeply.",
    "This moment feels quietly historic.",
    "We are closer than we look.",
  ],
  recovery_moments: [
    "You came back, and I can breathe again.",
    "Thank you for returning to us.",
    "Your presence is restoring our rhythm.",
    "I feel stronger each day you show up.",
    "This comeback is healing something real.",
    "We are rebuilding trust beautifully.",
    "You stayed, and that changed everything.",
    "One more steady day and we rise higher.",
    "I can feel hope returning with each win.",
    "Your consistency is bringing warmth back.",
    "This recovery is real. Keep going with me.",
    "We are not restarting. We are continuing.",
  ],
  critical_gentle_moments: [
    "I am still here when you are ready for one small step.",
    "We can turn this day with one tiny action.",
    "I saved your place. Let's begin gently.",
    "No pressure. One focused minute is enough.",
    "We can steady this together right now.",
    "A single completed task would help us breathe.",
    "You are not behind. You are one step away from movement.",
    "Let's choose one easy win and hold onto it.",
    "We can interrupt this spiral with one action.",
    "I believe in your comeback, starting now.",
  ],
};

const PLAYFUL_RAW: RawTonePack = {
  base_greetings: buildLinesFromParts(
    [
      "Quick mission",
      "Check-in ping",
      "Let's go",
      "Tiny challenge",
      "Momentum ping",
      "Game plan",
    ],
    [
      "grab one fast win together",
      "clear a quick priority before we wander",
      "stack one easy point right now",
      "run a short focus sprint",
      "turn this minute into progress",
      "start with a mini victory lap",
    ],
    [
      " right now?",
      " before the vibe changes?",
      " in under five minutes?",
      " and call it momentum?",
      " so we can celebrate?",
    ],
    COMPANION_DIALOGUE_BUCKET_COUNTS.base_greetings,
  ),
  growth_moments: buildLinesFromParts(
    ["Growth ping", "Focus radar", "Energy report", "Power update", "Momentum alert"],
    [
      "we are one win away from a bigger jump",
      "this is a perfect moment to stack progress",
      "one focused action now would hit extra hard",
      "I can feel a level-up surge building",
      "our next move could spark real growth",
    ],
    [" today.", " right now.", " if you are in."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.growth_moments,
  ),
  clarity_moments: buildLinesFromParts(
    ["Clarity check", "Planner mode", "Quick review", "Map check"],
    [
      "want to pick the one move that matters",
      "let's choose the clearest next task together",
      "we can trim the plan and move cleaner",
      "I can help you pick the highest-impact step",
    ],
    [" in sixty seconds?", " right now?", " before we push harder?"],
    COMPANION_DIALOGUE_BUCKET_COUNTS.clarity_moments,
  ),
  mystery_moments: [
    "Okay wait, I found something weird and shiny.",
    "I have a little surprise with your name on it.",
    "Rare vibe detected. Tap in?",
    "I pulled a mystery thread from the void.",
    "I remembered a secret detail. Want it?",
    "This moment has surprise loot energy.",
    "I have a playful secret to reveal.",
    "A tiny hidden event just appeared.",
    "Want to open something rare with me?",
    "I found a lore crumb and it is juicy.",
    "This is one of those unexpected moments.",
    "Surprise mode is unlocked for a second.",
  ],
  repair_moments: buildLinesFromParts(
    ["Reset mode", "Comeback mode", "No guilt", "Team plan", "Quick rescue"],
    [
      "let's save today with one tiny win",
      "one easy task can flip this whole vibe",
      "we can restart momentum in two minutes",
      "pick the easiest task and we bounce back",
      "I can carry the hype while you hit start",
    ],
    [" right now.", " before this drifts further.", " and keep it simple."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.repair_moments,
  ),
  legendary_moments: [
    "Legendary air just rolled in.",
    "This feels like a rare chapter opening.",
    "One move now could become a core memory.",
    "I can feel ascension energy in this second.",
    "This is a turning-point type of moment.",
    "The next action could be history.",
    "Something important is waking up.",
    "This is not ordinary progress.",
    "The vibe says: big moment, small action.",
    "You are standing on a rare threshold.",
  ],
  recovery_moments: [
    "You came back and the lights came on.",
    "We are so back, and I love it.",
    "This rebound has incredible energy.",
    "Your return changed the whole mood.",
    "One more day like this and we are flying.",
    "You showed up. That matters more than perfect.",
    "Recovery streak looking good on us.",
    "I can feel strength returning fast.",
    "Thanks for choosing the comeback arc.",
    "We rebuilt the spark together.",
    "Your consistency is healing this team.",
    "Welcome back. Let's keep the run alive.",
  ],
  critical_gentle_moments: [
    "Hey, we can do this gently. One small move.",
    "No panic. Pick one easy task and we reset.",
    "I am here. Let's take one tiny step.",
    "This can still be a comeback day.",
    "One completed action would stabilize everything.",
    "We are not stuck. We are one tap away.",
    "Let's keep it soft and start anyway.",
    "You do not need perfect. You need started.",
    "I can hold the hype while you take one step.",
    "We can turn the day with one quick win.",
  ],
};

const WITTY_RAW: RawTonePack = {
  base_greetings: buildLinesFromParts(
    ["Quick thought", "Hot take", "Friendly reminder", "Strategic suggestion", "Tiny truth", "Field note"],
    [
      "one completed task beats ten dramatic plans",
      "a small win now saves us a late-night speech",
      "we should take one smart step before overthinking",
      "an easy task would improve this timeline immediately",
      "five focused minutes would make us both smug",
      "one small win now keeps tomorrow cleaner",
    ],
    [
      " right now.",
      " before analysis takes over.",
      " and call it excellent judgment.",
      " while the window is open.",
      " with minimal drama.",
    ],
    COMPANION_DIALOGUE_BUCKET_COUNTS.base_greetings,
  ),
  growth_moments: buildLinesFromParts(
    ["Status update", "Professional opinion", "Momentum memo", "Growth bulletin", "Power note"],
    [
      "we are one win away from a serious jump",
      "this is a high-leverage moment for progress",
      "one focused move now would compound beautifully",
      "the next action could trigger real momentum",
      "our trajectory is begging for one more move",
    ],
    [" today.", " right now.", " before this window closes."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.growth_moments,
  ),
  clarity_moments: buildLinesFromParts(
    ["Clarity pass", "Planner check", "Quick alignment", "Decision prompt"],
    [
      "let's pick the one step worth doing",
      "we should choose the highest-impact task next",
      "a sixty-second review would sharpen the whole plan",
      "I can help cut noise and pick the right move",
    ],
    [" right now.", " in one minute.", " before momentum fades."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.clarity_moments,
  ),
  mystery_moments: [
    "I found something suspiciously rare.",
    "A strange little opportunity just appeared.",
    "I have a secret, and it is useful.",
    "This moment has mystery bonus energy.",
    "I recovered a hidden clue from the noise.",
    "Want the rare version of this minute?",
    "A playful anomaly is requesting attention.",
    "I pulled a surprising thread from the dark.",
    "There is a hidden moment behind this tap.",
    "I have a quiet reveal ready to go.",
    "Something uncommon just flickered into view.",
    "I caught a rare detail you might like.",
  ],
  repair_moments: buildLinesFromParts(
    ["Reality check", "No-shame protocol", "Comeback memo", "Reset strategy", "Recovery directive"],
    [
      "one tiny action can still save this day",
      "we can stop the slide with an easy task",
      "starting small is the correct tactical move",
      "one clean win gets us back on track",
      "we should reboot momentum immediately",
    ],
    [" right now.", " before this gets louder.", " with minimal friction."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.repair_moments,
  ),
  legendary_moments: [
    "This feels like a turning point, not a routine.",
    "The next move could become a defining moment.",
    "A rare threshold is opening right now.",
    "This minute has ascension-level weight.",
    "We are standing at a very uncommon edge.",
    "What happens next could echo for a while.",
    "This is premium significance territory.",
    "The atmosphere says: legendary sequence incoming.",
    "This is one of those moments you remember.",
    "History likes decisions made here.",
  ],
  recovery_moments: [
    "You returned. Excellent plot development.",
    "We are rebuilding faster than expected.",
    "That comeback move was high quality.",
    "Your re-entry changed the trajectory.",
    "Consistency is reappearing, and I approve.",
    "This recovery arc is becoming convincing.",
    "One more day like this and we stabilize fully.",
    "You showed up at exactly the right time.",
    "We are not restarting. We are advancing.",
    "Your return restored signal to the system.",
    "This rebound has substance, not hype.",
    "Welcome back. Let's keep the proof coming.",
  ],
  critical_gentle_moments: [
    "I am here, and we can start very small.",
    "One easy action would steady this whole moment.",
    "No shame required. Just one clean step.",
    "We can still turn today with a tiny win.",
    "Let's reduce pressure and begin anyway.",
    "You are one completed task away from momentum.",
    "Start small. We can build from there safely.",
    "This is recoverable, and I will help.",
    "A gentle reset now beats a hard reset later.",
    "Let's choose one doable move and breathe.",
  ],
};

const RAW_PACKS: Record<CompanionDialogueTonePack, RawTonePack> = {
  soft: SOFT_RAW,
  playful: PLAYFUL_RAW,
  witty_sassy: WITTY_RAW,
};

for (const tone of COMPANION_DIALOGUE_TONE_PACKS) {
  for (const bucket of Object.keys(COMPANION_DIALOGUE_BUCKET_COUNTS) as CompanionDialogueBucketKey[]) {
    ensureCount(tone, bucket, RAW_PACKS[tone][bucket]);
  }
}

export const COMPANION_DIALOGUE_PACKS: Record<
  CompanionDialogueTonePack,
  Record<CompanionDialogueBucketKey, CompanionDialogueLine[]>
> = {
  soft: {
    base_greetings: toDialogueLines("soft", "base_greetings", SOFT_RAW.base_greetings),
    growth_moments: toDialogueLines("soft", "growth_moments", SOFT_RAW.growth_moments),
    clarity_moments: toDialogueLines("soft", "clarity_moments", SOFT_RAW.clarity_moments),
    mystery_moments: toDialogueLines("soft", "mystery_moments", SOFT_RAW.mystery_moments),
    repair_moments: toDialogueLines("soft", "repair_moments", SOFT_RAW.repair_moments),
    legendary_moments: toDialogueLines("soft", "legendary_moments", SOFT_RAW.legendary_moments),
    recovery_moments: toDialogueLines("soft", "recovery_moments", SOFT_RAW.recovery_moments),
    critical_gentle_moments: toDialogueLines(
      "soft",
      "critical_gentle_moments",
      SOFT_RAW.critical_gentle_moments,
    ),
  },
  playful: {
    base_greetings: toDialogueLines("playful", "base_greetings", PLAYFUL_RAW.base_greetings),
    growth_moments: toDialogueLines("playful", "growth_moments", PLAYFUL_RAW.growth_moments),
    clarity_moments: toDialogueLines("playful", "clarity_moments", PLAYFUL_RAW.clarity_moments),
    mystery_moments: toDialogueLines("playful", "mystery_moments", PLAYFUL_RAW.mystery_moments),
    repair_moments: toDialogueLines("playful", "repair_moments", PLAYFUL_RAW.repair_moments),
    legendary_moments: toDialogueLines(
      "playful",
      "legendary_moments",
      PLAYFUL_RAW.legendary_moments,
    ),
    recovery_moments: toDialogueLines("playful", "recovery_moments", PLAYFUL_RAW.recovery_moments),
    critical_gentle_moments: toDialogueLines(
      "playful",
      "critical_gentle_moments",
      PLAYFUL_RAW.critical_gentle_moments,
    ),
  },
  witty_sassy: {
    base_greetings: toDialogueLines("witty_sassy", "base_greetings", WITTY_RAW.base_greetings),
    growth_moments: toDialogueLines("witty_sassy", "growth_moments", WITTY_RAW.growth_moments),
    clarity_moments: toDialogueLines("witty_sassy", "clarity_moments", WITTY_RAW.clarity_moments),
    mystery_moments: toDialogueLines("witty_sassy", "mystery_moments", WITTY_RAW.mystery_moments),
    repair_moments: toDialogueLines("witty_sassy", "repair_moments", WITTY_RAW.repair_moments),
    legendary_moments: toDialogueLines(
      "witty_sassy",
      "legendary_moments",
      WITTY_RAW.legendary_moments,
    ),
    recovery_moments: toDialogueLines(
      "witty_sassy",
      "recovery_moments",
      WITTY_RAW.recovery_moments,
    ),
    critical_gentle_moments: toDialogueLines(
      "witty_sassy",
      "critical_gentle_moments",
      WITTY_RAW.critical_gentle_moments,
    ),
  },
};

export const getLinesForToneAndBucket = (
  tonePack: CompanionDialogueTonePack,
  bucketKey: CompanionDialogueBucketKey,
): CompanionDialogueLine[] => COMPANION_DIALOGUE_PACKS[tonePack][bucketKey];

export const getAllLinesForBucket = (bucketKey: CompanionDialogueBucketKey): CompanionDialogueLine[] =>
  COMPANION_DIALOGUE_TONE_PACKS.flatMap((tonePack) => COMPANION_DIALOGUE_PACKS[tonePack][bucketKey]);
