export const ATTRIBUTE_DESCRIPTIONS = {
  energy: {
    icon: "⚡",
    name: "Energy",
    whatItMeans: "Your drive, physical momentum, and ability to take action. The \"get up and move\" stat.",
    boostedBy: [
      "Hitting the gym",
      "Morning routine wins",
      "Cleaning your space",
      "Taking a walk",
      "Cold showers",
      "Any task that requires physical or immediate action"
    ],
    whenGrows: "You feel more alive, motivated, and ready to attack the day. Your companion becomes more explosive and energetic."
  },
  resilience: {
    icon: "🛡",
    name: "Resilience",
    whatItMeans: "Your mental toughness, discipline, and ability to push through discomfort. The \"still going even when you don't feel like it\" stat.",
    boostedBy: [
      "No porn / no weed / no junk food",
      "Journaling",
      "Meditation",
      "Sticking to boundaries",
      "Holding promises to yourself",
      "Doing something difficult instead of avoiding it"
    ],
    whenGrows: "You become harder to shake, and your companion becomes more formidable and unbreakable."
  },
  focus: {
    icon: "🎯",
    name: "Focus",
    whatItMeans: "Your attention, clarity, productivity, and ability to make real progress. The \"lock in, get it done\" stat.",
    boostedBy: [
      "Reading",
      "Studying / learning a skill",
      "Work tasks",
      "Business steps",
      "Editing content",
      "Tracking finances",
      "Time blocking"
    ],
    whenGrows: "Your life gets sharper. You move with direction instead of distraction. Your companion becomes sharper, smarter, and more precise."
  },
  balance: {
    icon: "⚖️",
    name: "Balance",
    whatItMeans: "Your emotional grounding, relationships, self-care, and ability to maintain peace. The \"keep your life steady and meaningful\" stat.",
    boostedBy: [
      "Calling family or checking on a friend",
      "Talking to your partner",
      "Self-care moments",
      "Cooking a meal",
      "Taking a mindful walk",
      "Spending time with people who matter",
      "Healthy breaks and recovery"
    ],
    whenGrows: "You feel centered. Life feels smoother, calmer, and more aligned. Your companion becomes serene, wise, and stable."
  }
} as const;

export type AttributeType = keyof typeof ATTRIBUTE_DESCRIPTIONS;
