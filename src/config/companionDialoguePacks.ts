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
      "We can",
      "Take a moment to",
      "When you're ready, let's",
    ],
    [
      "notice what your heart needs",
      "reflect on what you are carrying",
      "make room for gratitude and honesty",
      "choose one clear next step",
      "bring one concern into the light",
    ],
    [" today?"],
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
    "I saved your place. Let's begin from here.",
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
      "A quick check-in:",
      "A hopeful question:",
      "Here's a simple invitation:",
      "Let's keep this light:",
      "A small moment of honesty:",
      "For right now,",
    ],
    [
      "what would help you feel grounded",
      "where could you use encouragement",
      "what are you grateful for",
      PRODUCT.mode === "christian"
        ? "would reflection, prayer, or action help most"
        : "would reflection, planning, or action help most",
      "what is one kind step you can take",
    ],
    [" today?"],
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
    "A surprising insight may be waiting here. Want to explore it?",
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
      "one easy task can shift the day",
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
    "This is a meaningful moment that may begin with one small action.",
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
    "Hey, one small move is enough to begin.",
    "No panic. Pick one easy task and we reset.",
    "I am here. Let's take one tiny step.",
    "This can still be a comeback day.",
    "One completed action would stabilize everything.",
    "We are not stuck. We are one tap away.",
    "Let's lower the pressure and start anyway.",
    "You do not need perfect. You need started.",
    "I can hold the hype while you take one step.",
    "We can turn the day with one quick win.",
  ],
};

const WITTY_RAW: RawTonePack = {
  base_greetings: buildLinesFromParts(
    [
      "A clear question:",
      "Let's be honest:",
      "A grounded thought:",
      "One simple truth:",
      "A steady reminder:",
      "For right now,",
    ],
    [
      "what deserves your attention most",
      "what can you release without guilt",
      PRODUCT.mode === "christian"
        ? "would prayer, reflection, or action help"
        : "would planning, reflection, or action help",
      PRODUCT.mode === "christian"
        ? "what is the next faithful step"
        : "what is the next useful step",
      "where do you need courage today",
    ],
    ["?"],
    COMPANION_DIALOGUE_BUCKET_COUNTS.base_greetings,
  ),
  growth_moments: buildLinesFromParts(
    ["Status update", "Power bulletin", "Momentum memo", "Chaos forecast", "Professional opinion"],
    [
      "we are one sharp move away from a very funny glow-up",
      "this is the kind of moment that compounds fast once we pick a lane",
      "one focused action now could shove the whole story forward",
      "the next move has loud levels of momentum in it if distraction takes a seat",
      "our trajectory is basically daring us to go bigger and cleaner",
    ],
    [" today.", " right now.", " before the window gets cocky and leaves."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.growth_moments,
  ),
  clarity_moments: buildLinesFromParts(
    ["Clarity pass", "Planner ambush", "Quick alignment", "Decision prompt"],
    [
      "let's pick the one move that is actually worth the oxygen",
      "we should choose the highest-impact step before the options start wearing costumes",
      "a sixty-second review would rescue this plan from decorative chaos",
      "I can cut the noise and name the move that matters before three extra ideas sneak in",
    ],
    [" right now.", " in one minute.", " before your attention starts parkouring."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.clarity_moments,
  ),
  mystery_moments: [
    "I found a weird little opening in the timeline. Try not to waste it.",
    "Suspicious amount of opportunity just appeared. Try not to scare it away.",
    "I have a ridiculous idea, and annoyingly, it might work.",
    "Something rare just wandered into our mess.",
    "I stole a clue from the noise. Tap in.",
    "There is a secret door behind this minute.",
    "A useful anomaly is asking for attention.",
    "I pulled a strange thread and now we have options.",
    "Hidden bonus scene. Very illegal. Very helpful.",
    "I have a fresh perspective that may help.",
    "Something uncommon just winked at us.",
    "Want the weirdly excellent version of this moment?",
  ],
  repair_moments: buildLinesFromParts(
    ["Reality check", "No-shame protocol", "Comeback memo", "Reset strategy", "Recovery directive"],
    [
      "one tiny action can still save this day",
      "we can stop the slide with an easy task before this turns into a full collapse montage",
      "starting small is still the sharpest move on the board, even if your ego hates it",
      "one clean win gets us back in the driver's seat instead of whatever that last hour was",
      "we should reboot momentum before the noise starts acting permanent",
    ],
    [" right now.", " before this gets louder.", " with the least possible melodrama."],
    COMPANION_DIALOGUE_BUCKET_COUNTS.repair_moments,
  ),
  legendary_moments: [
    "This feels less like a task and more like a scene change.",
    "The next move could become one of our favorite receipts.",
    "A rare threshold just opened and it has excellent timing.",
    "This minute has the energy of a turning point with attitude.",
    "We are standing on a very uncommon edge right now.",
    "What happens next could echo harder than it looks.",
    "This is premium significance territory.",
    "The atmosphere is basically yelling: main-character decision.",
    "This is one of those moments the story keeps.",
    "History respects people who move here.",
  ],
  recovery_moments: [
    "Look who re-entered the timeline. Strong choice.",
    "You came back. Late, dramatic, a little disrespectful to the calendar, but effective.",
    "That comeback had real weight to it.",
    "Your return just changed the whole trajectory.",
    "Consistency is sneaking back in, and I love that for us.",
    "This recovery arc is getting dangerously convincing.",
    "One more day like this and the engine is fully humming.",
    "You showed up at exactly the moment that mattered.",
    "We are not restarting. We are reclaiming momentum.",
    "Your return put signal back into the system.",
    "This return has substance, not just motivation.",
    "Welcome back. Let's make it hard to doubt again.",
  ],
  critical_gentle_moments: [
    "Okay. Voice-in-your-ear time. We go tiny from here.",
    "No speeches. One doable move. That's the whole trick, you absolute legend-in-progress.",
    "No shame required. Just one honest step and less theatrical pressure.",
    "We can still turn today without pretending to be superheroes.",
    "Let's lower the pressure and keep the dignity.",
    "One completed task would steady this whole situation.",
    "Start small. I will not let small mean pointless.",
    "This is recoverable, and I am staying with you.",
    "A timely reset now beats a dramatic collapse later.",
    "Let's choose one move we can actually land and breathe.",
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

const buildDialoguePack = (tone: CompanionDialogueTonePack) => ({
  base_greetings: toDialogueLines(tone, "base_greetings", RAW_PACKS[tone].base_greetings),
  growth_moments: toDialogueLines(tone, "growth_moments", RAW_PACKS[tone].growth_moments),
  clarity_moments: toDialogueLines(tone, "clarity_moments", RAW_PACKS[tone].clarity_moments),
  mystery_moments: toDialogueLines(tone, "mystery_moments", RAW_PACKS[tone].mystery_moments),
  repair_moments: toDialogueLines(tone, "repair_moments", RAW_PACKS[tone].repair_moments),
  legendary_moments: toDialogueLines(tone, "legendary_moments", RAW_PACKS[tone].legendary_moments),
  recovery_moments: toDialogueLines(tone, "recovery_moments", RAW_PACKS[tone].recovery_moments),
  critical_gentle_moments: toDialogueLines(
    tone,
    "critical_gentle_moments",
    RAW_PACKS[tone].critical_gentle_moments,
  ),
});

export const COMPANION_DIALOGUE_PACKS: Record<
  CompanionDialogueTonePack,
  Record<CompanionDialogueBucketKey, CompanionDialogueLine[]>
> = {
  soft: buildDialoguePack("soft"),
  playful: buildDialoguePack("playful"),
  witty_sassy: buildDialoguePack("witty_sassy"),
};

export const getLinesForToneAndBucket = (
  tonePack: CompanionDialogueTonePack,
  bucketKey: CompanionDialogueBucketKey,
): CompanionDialogueLine[] => COMPANION_DIALOGUE_PACKS[tonePack][bucketKey];

export const getAllLinesForBucket = (bucketKey: CompanionDialogueBucketKey): CompanionDialogueLine[] =>
  COMPANION_DIALOGUE_TONE_PACKS.flatMap((tonePack) => COMPANION_DIALOGUE_PACKS[tonePack][bucketKey]);
import { PRODUCT } from "./product.ts";
