export const ATTRIBUTE_DESCRIPTIONS = {
  body: {
    icon: "💪",
    name: "Body",
    whatItMeans: "Your physical energy, movement, and ability to take action. The fuel for real-world execution.",
    boostedBy: [
      "Working out / hitting the gym",
      "Morning routines",
      "Cleaning your space",
      "Taking walks",
      "Cold showers",
      "Any physical activity or immediate action"
    ],
    whenGrows: "You feel more alive, energized, and ready to move. Your companion becomes more powerful and dynamic."
  },
  mind: {
    icon: "🧠",
    name: "Mind",
    whatItMeans: "Your mental focus, clarity, and intellectual productivity. The power to learn, think, and create.",
    boostedBy: [
      "Reading books",
      "Studying / learning new skills",
      "Deep work sessions",
      "Business planning",
      "Problem-solving",
      "Creative projects",
      "Time blocking / planning"
    ],
    whenGrows: "Your thoughts become sharper and more focused. You unlock clarity and direction. Your companion becomes wiser and more strategic."
  },
  soul: {
    icon: "✨",
    name: "Soul",
    whatItMeans: "Your inner peace, emotional resilience, and connection to what matters. The foundation of a meaningful life.",
    boostedBy: [
      "Meditation / reflection",
      "Journaling",
      "Quality time with loved ones",
      "Acts of kindness",
      "Self-care practices",
      "Setting healthy boundaries",
      "Gratitude practices"
    ],
    whenGrows: "You feel centered, grounded, and at peace. Life becomes more meaningful. Your companion radiates calm strength and wisdom."
  }
} as const;

export type AttributeType = keyof typeof ATTRIBUTE_DESCRIPTIONS;
