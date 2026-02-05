export const ATTRIBUTE_DESCRIPTIONS = {
  vitality: {
    icon: "💪",
    name: "Vitality",
    color: "text-red-400",
    progressColor: "bg-red-400",
    whatItMeans: "Your life force, energy, and physical health. The engine of transformation.",
    boostedBy: [
      "Fitness quests (gym, running, yoga)",
      "Sleep rituals and rest goals",
      "Nutrition and hydration habits",
      "Cold showers and morning routines",
      "Walking and step tracking"
    ],
    whenGrows: "You build raw power and endurance. Your body becomes a vessel of strength and vitality."
  },
  power: {
    icon: "⚡",
    name: "Power",
    color: "text-amber-400",
    progressColor: "bg-amber-400",
    whatItMeans: "Your ability to make things happen in the world. Work output and execution.",
    boostedBy: [
      "Career and work quests",
      "Deep work sessions (Pomodoro)",
      "Business and side project progress",
      "Shipping work and completing projects",
      "Financial goal progress"
    ],
    whenGrows: "You execute and produce results. Your ability to shape the world around you strengthens."
  },
  wisdom: {
    icon: "📚",
    name: "Wisdom",
    color: "text-blue-400",
    progressColor: "bg-blue-400",
    whatItMeans: "Pattern recognition, learning, and clarity. The foundation of insight.",
    boostedBy: [
      "Reading books and articles",
      "Studying and taking courses",
      "Learning new skills",
      "Mentor interactions and guidance",
      "Reflection and journaling"
    ],
    whenGrows: "You gain insight and understanding. Your mind sharpens and hidden patterns become clear."
  },
  discipline: {
    icon: "🎯",
    name: "Discipline",
    color: "text-green-400",
    progressColor: "bg-green-400",
    whatItMeans: "Reliability of action and consistency. The backbone of transformation.",
    boostedBy: [
      "Completing daily rituals",
      "Maintaining streaks",
      "Showing up on hard days",
      "Following through on plans",
      "Time-blocking and scheduling"
    ],
    whenGrows: "You become someone who follows through. Your word to yourself becomes unbreakable."
  },
  resolve: {
    icon: "🛡️",
    name: "Resolve",
    color: "text-purple-400",
    progressColor: "bg-purple-400",
    whatItMeans: "Your ability to withstand pressure and resist urges. Inner fortitude.",
    boostedBy: [
      "Resist victories",
      "Astral Encounter wins",
      "Comebacks after lapses",
      "Staying strong during temptation",
      "Overcoming setbacks"
    ],
    whenGrows: "You become unshakeable. Pressure forges you into something stronger."
  },
  connection: {
    icon: "💜",
    name: "Connection",
    color: "text-pink-400",
    progressColor: "bg-pink-400",
    whatItMeans: "Ability to bond and maintain relationships. The heart of human experience.",
    boostedBy: [
      "Relationship-focused quests",
      "Check-ins with loved ones",
      "Gratitude practices",
      "Acts of kindness",
      "Quality time with others"
    ],
    whenGrows: "Your relationships deepen. You feel connected to what truly matters."
  },
  alignment: {
    icon: "✨",
    name: "Alignment",
    color: "text-celestial-blue",
    progressColor: "bg-celestial-blue",
    whatItMeans: "How aligned your actions are with who you want to be. Purpose and identity.",
    boostedBy: [
      "Long-term campaign progress",
      "Identity-based quests",
      "Weekly reflections",
      "Purpose journaling",
      "Living by your values"
    ],
    whenGrows: "You live with intention and meaning. Your actions reflect your truest self."
  }
} as const;

export type AttributeType = keyof typeof ATTRIBUTE_DESCRIPTIONS;

// Echo gains map - when a stat is boosted, related stats get small passive gains
export const ECHO_MAP: Record<AttributeType, AttributeType[]> = {
  vitality: ['discipline', 'alignment'],
  power: ['discipline'],
  wisdom: ['alignment'],
  discipline: ['resolve'],
  resolve: ['discipline', 'alignment'],
  connection: ['alignment'],
  alignment: ['resolve'],
};
