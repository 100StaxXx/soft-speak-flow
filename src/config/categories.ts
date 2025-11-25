// Topic Categories for R-Evolution
export const TOPIC_CATEGORIES = [
  { label: "Discipline", value: "discipline" },
  { label: "Confidence", value: "confidence" },
  { label: "Physique", value: "physique" },
  { label: "Focus", value: "focus" },
  { label: "Mindset", value: "mindset" },
  { label: "Business", value: "business" },
] as const;

// Emotional Triggers
export const EMOTIONAL_TRIGGERS = [
  "Exhausted",
  "Avoiding Action",
  "Anxious & Overthinking",
  "Self-Doubt",
  "Feeling Stuck",
  "Frustrated",
  "Heavy or Low",
  "Emotionally Hurt",
  "Unmotivated",
  "In Transition",
  "Needing Discipline",
  "Motivated & Ready",
] as const;

// Default mentor mapping for emotional triggers (for AI hints)
export const TRIGGER_MENTOR_MAPPING: Record<string, string[]> = {
  "Exhausted": ["nova", "atlas"],
  "Avoiding Action": ["darius", "kai"],
  "Anxious & Overthinking": ["nova", "solace", "atlas"],
  "Self-Doubt": ["eli", "lumi"],
  "Feeling Stuck": ["atlas", "darius"],
  "Frustrated": ["stryker", "kai"],
  "Heavy or Low": ["sienna", "lumi"],
  "Emotionally Hurt": ["sienna", "lumi", "solace"],
  "Unmotivated": ["stryker", "darius", "eli"],
  "In Transition": ["atlas", "nova", "solace"],
  "Needing Discipline": ["darius", "kai", "stryker"],
  "Motivated & Ready": ["stryker", "eli"],
};
