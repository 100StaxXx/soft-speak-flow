export const ATTRIBUTE_DESCRIPTIONS = {
  mind: {
    icon: "🧠",
    name: "Mind",
    whatItMeans: "Anything that strengthens clarity, mental discipline, or focus. The foundation of wisdom and unlocking hidden potential.",
    boostedBy: [
      "Reading",
      "Journaling",
      "Meditation",
      "Learning a new skill",
      "No-phone blocks",
      "Planning your day",
      "Affirmations",
      "Dopamine detox actions",
      "Studying",
      "Therapy-style reflection prompts"
    ],
    whenGrows: "You unlock insight, clarity, and wisdom. Your mind sharpens and you discover hidden potential within yourself. Your companion becomes more intelligent and perceptive."
  },
  body: {
    icon: "💪",
    name: "Body",
    whatItMeans: "Anything that improves your physical life, health, strength, and environment. The engine of transformation.",
    boostedBy: [
      "Hitting the gym",
      "Stretching",
      "Walking / tracking steps",
      "Hydration goals",
      "Diet and nutrition goals",
      "Cleaning your room",
      "Sleep goals",
      "Cold showers",
      "10-minute workouts",
      "Healthy routine stacking"
    ],
    whenGrows: "You build strength, endurance, and undergo physical transformation. Your environment becomes cleaner and healthier. Your companion evolves with raw power and vitality."
  },
  soul: {
    icon: "🔥",
    name: "Soul",
    whatItMeans: "The most unique category — the one that gives your life HEART. Anything that improves your emotion, relationships, purpose, connection, identity, creativity, and character.",
    boostedBy: [
      "Show love to someone",
      "Call a family member",
      "Spend quality time with your partner",
      "Do something kind",
      "Create something meaningful",
      "Take a walk outside",
      "Express gratitude",
      "Prayer or spiritual practice",
      "Deep breath moments",
      "Watch the sunset",
      "Do one thing that grounds you"
    ],
    whenGrows: "You feel deeply connected to what matters. Your relationships deepen, your purpose clarifies, and your character strengthens. Your companion radiates warmth, wisdom, and profound meaning."
  }
} as const;

export type AttributeType = keyof typeof ATTRIBUTE_DESCRIPTIONS;
