export const COMPANION_CHAT_OPENING_LINES = [
  "I'm here. What's on your heart today?",
  "How are you really doing today?",
  "What are you carrying today?",
  "Would it help to reflect, pray, or take one small step?",
  "Where could you use a little grace today?",
  "What's been weighing on you lately?",
  "What are you grateful for today?",
  "Is today calling for encouragement, clarity, or rest?",
  "What would help you feel more grounded today?",
  "Where are you feeling stretched right now?",
  "What's one thing you'd like to work through together?",
  "What feels most important to talk about today?",
  "Would you like encouragement, a short prayer, or a practical next step?",
  "How is your heart today—hopeful, weary, grateful, or somewhere in between?",
  "What would make today feel a little lighter?",
  "Where do you need patience or courage today?",
  "What has been giving you hope lately?",
  "Is there anything you'd like to bring into prayer?",
  "What would a faithful next step look like today?",
  "What do you need most right now: space to reflect or help moving forward?",
  "How can I support your reflection today?",
  "What's one small thing you want to do with intention today?",
  "Would you like to talk through your day for a minute?",
  "Where have you noticed grace recently?",
  "What's helping you stay steady today?",
  "What are you hoping for today?",
  "Is something making it hard to be present right now?",
  "What deserves your attention—and what can wait?",
  "Would a quiet check-in help right now?",
  "Tell me what today has felt like so far.",
] as const;

export type CompanionChatOpeningLine =
  (typeof COMPANION_CHAT_OPENING_LINES)[number];

export const getRandomCompanionChatOpeningLine = (
  random: () => number = Math.random,
): CompanionChatOpeningLine => {
  const rawValue = random();
  const clampedValue = Number.isFinite(rawValue)
    ? Math.max(0, Math.min(rawValue, 0.999999999999))
    : 0;
  const index = Math.floor(clampedValue * COMPANION_CHAT_OPENING_LINES.length);

  return COMPANION_CHAT_OPENING_LINES[index] ??
    COMPANION_CHAT_OPENING_LINES[0];
};
