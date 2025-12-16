/**
 * Comprehensive Mission Templates System
 * Supports auto-detection, difficulty scaling, chains, and personalization
 * 
 * Mission Categories:
 * - Connection = Small & instantly doable (5-10 XP, easy)
 * - Quick Win = 1-5 minutes (5-10 XP, easy/medium)
 * - Identity = Can be bigger or full-day missions (10-15 XP, medium/hard)
 * - Wellness = Self-care, mindfulness, body awareness (5-10 XP, easy)
 * - Gratitude = Appreciation, journaling, reflection (5-10 XP, easy)
 * - Growth = Learning, challenging comfort zone (10-15 XP, medium/hard)
 */

export type MissionCategory = 'connection' | 'quick_win' | 'identity' | 'wellness' | 'gratitude' | 'growth';

export interface MissionTemplate {
  type: string;
  text: string;
  xp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: MissionCategory;
  autoComplete: boolean;
  progressTarget?: number;
  chainMissions?: string[]; // Mission types that unlock as bonuses
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // === CONNECTION CATEGORY (5-10 XP, easy) ===
  { 
    type: "connection_text_friend", 
    text: "Text someone you appreciate and let them know why", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'connection',
    autoComplete: false
  },
  { 
    type: "connection_check_in", 
    text: "Send a simple check-in message to a friend or family member", 
    xp: 7, 
    difficulty: 'easy', 
    category: 'connection',
    autoComplete: false
  },
  { 
    type: "connection_compliment", 
    text: "Give someone a small compliment today", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'connection',
    autoComplete: false
  },
  { 
    type: "connection_gratitude", 
    text: "Express gratitude to someone who helped you recently", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'connection',
    autoComplete: false
  },
  { 
    type: "connection_listen", 
    text: "Really listen to someone today without thinking about your response", 
    xp: 7, 
    difficulty: 'easy', 
    category: 'connection',
    autoComplete: false
  },

  // === QUICK WIN CATEGORY (5-10 XP, easy/medium) ===
  { 
    type: "quick_win_avoided_task", 
    text: "Do one tiny task you've been avoiding", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'quick_win',
    autoComplete: false
  },
  { 
    type: "quick_win_organize", 
    text: "Organize one small area for two minutes", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'quick_win',
    autoComplete: false
  },
  { 
    type: "quick_win_make_bed", 
    text: "Make your bed to start the day with a win", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'quick_win',
    autoComplete: false
  },
  { 
    type: "quick_win_declutter", 
    text: "Throw away or delete one thing you no longer need", 
    xp: 7, 
    difficulty: 'easy', 
    category: 'quick_win',
    autoComplete: false
  },
  { 
    type: "quick_win_five_minutes", 
    text: "Take care of something that will take less than five minutes", 
    xp: 8, 
    difficulty: 'medium', 
    category: 'quick_win',
    autoComplete: false
  },
  { 
    type: "quick_win_reply", 
    text: "Reply to one message you've been putting off", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'quick_win',
    autoComplete: false
  },

  // === IDENTITY CATEGORY (10-15 XP, medium/hard) ===
  { 
    type: "identity_complete_all_quests", 
    text: "Complete all your quests today", 
    xp: 15, 
    difficulty: 'hard', 
    category: 'identity',
    autoComplete: true
  },
  { 
    type: "identity_complete_all_habits", 
    text: "Complete all your habits today", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: true
  },
  { 
    type: "identity_plan_tomorrow", 
    text: "Plan tomorrow before you go to bed", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: false
  },
  { 
    type: "identity_schedule", 
    text: "Schedule something you've been putting off", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: false
  },
  { 
    type: "identity_future_self", 
    text: "Take one action your future self would thank you for", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: false
  },
  { 
    type: "identity_discipline_burst", 
    text: "Act for two minutes as the most disciplined version of yourself", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: false
  },

  // === WELLNESS CATEGORY (5-10 XP, easy) ===
  { 
    type: "wellness_deep_breaths", 
    text: "Take 3 deep breaths and notice how you feel", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_water", 
    text: "Drink a full glass of water mindfully", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_stretch", 
    text: "Stretch your body for 60 seconds", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_walk", 
    text: "Take a short walk, even just around your space", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_posture", 
    text: "Check and correct your posture right now", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_screen_break", 
    text: "Take a 5-minute break from all screens", 
    xp: 7, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },
  { 
    type: "wellness_body_scan", 
    text: "Do a quick body scan - where are you holding tension?", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: false
  },

  // === GRATITUDE CATEGORY (5-10 XP, easy) ===
  { 
    type: "gratitude_write_one", 
    text: "Write down one thing you're grateful for today", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },
  { 
    type: "gratitude_notice_beauty", 
    text: "Notice one beautiful thing around you right now", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },
  { 
    type: "gratitude_body_thanks", 
    text: "Thank your body for something it does well", 
    xp: 6, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },
  { 
    type: "gratitude_simple_pleasure", 
    text: "Appreciate one simple pleasure in your day", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },
  { 
    type: "gratitude_past_self", 
    text: "Thank your past self for one decision they made", 
    xp: 7, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },
  { 
    type: "gratitude_challenge", 
    text: "Find something to be grateful for in a recent challenge", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'gratitude',
    autoComplete: false
  },

  // === GROWTH CATEGORY (10-15 XP, medium/hard) ===
  { 
    type: "growth_learn_word", 
    text: "Learn one new word or fact today", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_comfort_zone", 
    text: "Try something small outside your comfort zone", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_curious_question", 
    text: "Ask one question you've been curious about", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_read_article", 
    text: "Read one article or chapter about something new", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_skill_practice", 
    text: "Practice a skill you want to improve for 5 minutes", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_different_perspective", 
    text: "Consider a topic from a perspective different than your own", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: false
  },
  { 
    type: "growth_teach_something", 
    text: "Teach someone one thing you know", 
    xp: 15, 
    difficulty: 'hard', 
    category: 'growth',
    autoComplete: false
  },
];

// Theme Days Configuration - each day has a unique category mix
export interface ThemeDay {
  name: string;
  emoji: string;
  categories: MissionCategory[];
}

export const THEME_DAYS: Record<number, ThemeDay> = {
  0: { // Sunday
    name: "Reset Sunday",
    emoji: "🌅",
    categories: ['identity', 'wellness', 'growth']
  },
  1: { // Monday
    name: "Momentum Monday",
    emoji: "🚀",
    categories: ['quick_win', 'growth', 'identity']
  },
  2: { // Tuesday
    name: "Connection Tuesday",
    emoji: "💜",
    categories: ['connection', 'gratitude', 'wellness']
  },
  3: { // Wednesday
    name: "Wellness Wednesday",
    emoji: "🧘",
    categories: ['wellness', 'gratitude', 'quick_win']
  },
  4: { // Thursday
    name: "Gratitude Thursday",
    emoji: "✨",
    categories: ['gratitude', 'connection', 'identity']
  },
  5: { // Friday
    name: "Future Friday",
    emoji: "🔮",
    categories: ['identity', 'growth', 'quick_win']
  },
  6: { // Saturday
    name: "Soul Saturday",
    emoji: "🌟",
    categories: ['wellness', 'gratitude', 'connection']
  },
};

// Bonus Mission Triggers
export interface BonusMissionTrigger {
  condition: string;
  missionText: string;
  xp: number;
  category: MissionCategory;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const BONUS_MISSION_TRIGGERS: BonusMissionTrigger[] = [
  {
    condition: 'streak_3',
    missionText: "Keep your momentum going - share your progress with someone",
    xp: 10,
    category: 'connection',
    difficulty: 'easy'
  },
  {
    condition: 'streak_7',
    missionText: "Streak Master: Reflect on what's helped you stay consistent",
    xp: 12,
    category: 'growth',
    difficulty: 'medium'
  },
  {
    condition: 'streak_14',
    missionText: "Two weeks strong! Do something kind for yourself today",
    xp: 12,
    category: 'wellness',
    difficulty: 'easy'
  },
  {
    condition: 'streak_30',
    missionText: "30-day legend! Write a note to your future self",
    xp: 15,
    category: 'identity',
    difficulty: 'medium'
  },
];

// Mission type to activity type mapping for auto-completion
export const MISSION_ACTIVITY_MAP: Record<string, {
  activityType: string | string[];
  validator?: (activityData: any, progressCurrent: number, progressTarget: number) => boolean;
}> = {
  // Identity missions that auto-complete
  identity_complete_all_quests: {
    activityType: 'all_quests_completed'
  },
  identity_complete_all_habits: {
    activityType: 'all_habits_completed'
  },
  
  // Legacy mappings for backward compatibility
  habit_complete_1: {
    activityType: 'habit_completed',
    validator: (_, current, target) => current >= target
  },
  habit_complete_3: {
    activityType: 'habit_completed',
    validator: (_, current, target) => current >= target
  },
  habit_complete_5: {
    activityType: 'habit_completed',
    validator: (_, current, target) => current >= target
  },
  all_habits: {
    activityType: 'all_habits_completed'
  },
  habit_early_bird: {
    activityType: 'habit_completed',
    validator: (data) => {
      const hour = new Date(data.completedAt || data.timestamp).getHours();
      return hour < 9;
    }
  },
  habit_night_owl: {
    activityType: 'habit_completed',
    validator: (data) => {
      const hour = new Date(data.completedAt || data.timestamp).getHours();
      return hour >= 20;
    }
  },
  check_in_morning: {
    activityType: 'check_in_completed'
  },
  mood_log: {
    activityType: 'mood_logged',
    validator: (_, current, target) => current >= target
  },
  reflection_write: {
    activityType: 'reflection_created'
  },
  reflection_detailed: {
    activityType: 'reflection_created',
    validator: (data) => {
      const wordCount = (data.note || '').split(/\s+/).length;
      return wordCount >= 100;
    }
  },
  pep_talk_listen: {
    activityType: 'pep_talk_listened'
  },
  pep_talk_full: {
    activityType: 'pep_talk_listened',
    validator: (data) => (data.completion || 0) >= 100
  },
  mentor_chat_start: {
    activityType: 'mentor_message_sent'
  },
  mentor_chat_deep: {
    activityType: 'mentor_message_sent',
    validator: (_, current, target) => current >= target
  },
  library_explore: {
    activityType: 'library_visited'
  },
  quote_favorite: {
    activityType: 'quote_favorited'
  },
  quote_share: {
    activityType: 'quote_shared'
  },
  pep_talk_share: {
    activityType: 'pep_talk_shared'
  },
  companion_visit: {
    activityType: 'companion_visited'
  },
  companion_interact: {
    activityType: ['companion_visited', 'companion_evolved'],
    validator: (_, current, target) => current >= target
  },
  challenge_join: {
    activityType: 'challenge_started'
  },
  challenge_complete_day: {
    activityType: 'challenge_day_completed'
  },
  streak_maintain: {
    activityType: 'habit_completed',
    validator: (data) => (data.currentStreak || 0) > 0
  },
  bonus_habit_streak: {
    activityType: 'habit_completed',
    validator: (data) => (data.currentStreak || 0) >= 3
  },
  bonus_perfect_day: {
    activityType: 'all_habits_completed'
  },
  bonus_triple_threat: {
    activityType: 'mission_completed',
    validator: (data) => {
      const categories = new Set(data.completedCategories || []);
      return categories.size >= 3;
    }
  }
};

// Category-specific XP ranges for validation
export const CATEGORY_XP_RANGES: Record<MissionCategory, { min: number; max: number; difficulties: ('easy' | 'medium' | 'hard')[] }> = {
  connection: { min: 5, max: 10, difficulties: ['easy'] },
  quick_win: { min: 5, max: 10, difficulties: ['easy', 'medium'] },
  identity: { min: 10, max: 15, difficulties: ['medium', 'hard'] },
  wellness: { min: 5, max: 10, difficulties: ['easy'] },
  gratitude: { min: 5, max: 10, difficulties: ['easy'] },
  growth: { min: 10, max: 15, difficulties: ['medium', 'hard'] },
};

// Helper to get today's theme
export const getTodaysTheme = (): ThemeDay => {
  const dayOfWeek = new Date().getDay();
  return THEME_DAYS[dayOfWeek];
};

// Helper to get applicable bonus missions based on streak
export const getApplicableBonusMissions = (streak: number): BonusMissionTrigger[] => {
  const bonuses: BonusMissionTrigger[] = [];
  
  if (streak >= 30) {
    bonuses.push(BONUS_MISSION_TRIGGERS.find(b => b.condition === 'streak_30')!);
  } else if (streak >= 14) {
    bonuses.push(BONUS_MISSION_TRIGGERS.find(b => b.condition === 'streak_14')!);
  } else if (streak >= 7) {
    bonuses.push(BONUS_MISSION_TRIGGERS.find(b => b.condition === 'streak_7')!);
  } else if (streak >= 3) {
    bonuses.push(BONUS_MISSION_TRIGGERS.find(b => b.condition === 'streak_3')!);
  }
  
  return bonuses;
};
