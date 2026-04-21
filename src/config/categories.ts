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

// Default guide mapping for emotional triggers (for AI hints)
export const TRIGGER_MENTOR_MAPPING: Record<string, string[]> = {
  "Exhausted": ["princess", "sage"],
  "Avoiding Action": ["operator", "charles"],
  "Anxious & Overthinking": ["sage", "princess"],
  "Self-Doubt": ["icon", "princess"],
  "Feeling Stuck": ["operator", "sage", "charles"],
  "Frustrated": ["rival", "operator"],
  "Heavy or Low": ["princess", "sage"],
  "Emotionally Hurt": ["princess", "sage", "icon"],
  "Unmotivated": ["charles", "rival", "operator"],
  "In Transition": ["sage", "icon", "princess"],
  "Needing Discipline": ["operator", "rival", "charles"],
  "Motivated & Ready": ["operator", "rival"],
};
