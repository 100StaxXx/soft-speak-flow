const TAG_ALIASES: Record<string, string> = {
  discipline: "discipline",
  performance: "discipline",
  execution: "discipline",
  grind: "discipline",
  habits: "discipline",
  tough_love: "discipline",
  direct: "discipline",
  intense: "discipline",
  elite: "discipline",
  focus: "discipline",
  resilience: "discipline",
  strong: "discipline",

  calm: "calm",
  clarity: "calm",
  mindfulness: "calm",
  presence: "calm",
  grounded: "calm",
  neutral: "calm",
  stoic: "calm",
  inner_peace: "calm",
  anxiety_relief: "calm",

  healing: "healing",
  recovery: "healing",
  relationships: "healing",
  heartbreak: "healing",
  self_worth: "healing",
  self_compassion: "healing",
  soft: "healing",

  supportive: "supportive",
  warm: "supportive",
  gentle: "supportive",
  encouraging: "supportive",
  accessible: "supportive",
  feminine: "supportive",
  compassionate: "supportive",
  empathy: "supportive",

  confidence: "confidence",
  self_belief: "confidence",
  uplifting: "confidence",

  momentum: "momentum",
  drive: "momentum",
  high_energy: "momentum",
  energetic: "momentum",
  action: "momentum",

  spiritual: "spiritual",
  intuition: "spiritual",
  higher_self: "spiritual",
};

export const CANONICAL_TRAITS = [
  "discipline",
  "calm",
  "healing",
  "confidence",
  "momentum",
  "supportive",
  "spiritual",
] as const;

export type CanonicalTrait = (typeof CANONICAL_TRAITS)[number];

export const getCanonicalTag = (tag?: string | null): CanonicalTrait | null => {
  if (!tag) return null;
  const normalized = tag.toLowerCase().trim();
  return (TAG_ALIASES[normalized] as CanonicalTrait | undefined) ?? null;
};

export const canonicalizeTags = (tags: Array<string | null | undefined>): CanonicalTrait[] => {
  const canonicalSet = new Set<CanonicalTrait>();
  tags.forEach((tag) => {
    const canonical = getCanonicalTag(tag);
    if (canonical) {
      canonicalSet.add(canonical);
    }
  });
  return Array.from(canonicalSet);
};

export const MENTOR_FALLBACK_TAGS: Record<string, CanonicalTrait[]> = {
  // HIGH INTENSITY (discipline-focused)
  atlas: ["discipline", "calm"],           // Stoic discipline + inner calm
  darius: ["discipline", "confidence"],    // Leadership discipline + confidence
  kai: ["discipline", "momentum"],         // Gritty discipline + action-oriented
  stryker: ["momentum", "discipline"],     // High-energy momentum first

  // BALANCED (confidence/supportive)
  eli: ["confidence", "supportive"],       // Uplifting confidence + warmth

  // SOFT/HEALING
  lumi: ["healing", "supportive"],         // Relationship healing + support
  sienna: ["healing", "calm"],             // Deep healing + gentle calm

  // SPIRITUAL/CALM
  nova: ["calm", "spiritual"],             // Mindfulness + light spirituality
  solace: ["spiritual", "healing"],        // Deep spiritual + healing
};
