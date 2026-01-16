// Topic Categories for Cosmiq
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
// Active mentors: atlas, eli, sienna, stryker, carmen, reign, solace
export const TRIGGER_MENTOR_MAPPING: Record<string, string[]> = {
  "Exhausted": ["sienna", "atlas"],
  "Avoiding Action": ["stryker", "carmen"],
  "Anxious & Overthinking": ["sienna", "solace", "atlas"],
  "Self-Doubt": ["eli", "solace"],
  "Feeling Stuck": ["atlas", "stryker"],
  "Frustrated": ["stryker", "carmen"],
  "Heavy or Low": ["sienna", "solace"],
  "Emotionally Hurt": ["sienna", "solace"],
  "Unmotivated": ["stryker", "reign", "eli"],
  "In Transition": ["atlas", "sienna", "solace"],
  "Needing Discipline": ["carmen", "reign", "stryker"],
  "Motivated & Ready": ["stryker", "reign", "eli"],
};
