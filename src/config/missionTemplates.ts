/**
 * Comprehensive Mission Templates System
 * Supports auto-detection, difficulty scaling, chains, and personalization
 */

export interface MissionTemplate {
  type: string;
  text: string;
  xp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'habits' | 'wellness' | 'learning' | 'social' | 'growth';
  autoComplete: boolean;
  progressTarget?: number;
  chainMissions?: string[]; // Mission types that unlock as bonuses
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // === HABITS CATEGORY ===
  { 
    type: "habit_complete_1", 
    text: "Complete 1 habit today", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'habits',
    autoComplete: true,
    progressTarget: 1
  },
  { 
    type: "habit_complete_3", 
    text: "Complete 3 habits today", 
    xp: 15, 
    difficulty: 'medium', 
    category: 'habits',
    autoComplete: true,
    progressTarget: 3,
    chainMissions: ['bonus_habit_streak']
  },
  { 
    type: "habit_complete_5", 
    text: "Complete 5 habits today", 
    xp: 25, 
    difficulty: 'hard', 
    category: 'habits',
    autoComplete: true,
    progressTarget: 5
  },
  { 
    type: "all_habits", 
    text: "Complete all your habits", 
    xp: 30, 
    difficulty: 'hard', 
    category: 'habits',
    autoComplete: true,
    chainMissions: ['bonus_perfect_day']
  },
  { 
    type: "habit_early_bird", 
    text: "Complete a habit before 9 AM", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'habits',
    autoComplete: true
  },
  { 
    type: "habit_night_owl", 
    text: "Complete a habit after 8 PM", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'habits',
    autoComplete: true
  },

  // === WELLNESS CATEGORY ===
  { 
    type: "check_in_morning", 
    text: "Complete your morning check-in", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: true
  },
  { 
    type: "mood_log", 
    text: "Log your mood 3 times today", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'wellness',
    autoComplete: true,
    progressTarget: 3
  },
  { 
    type: "reflection_write", 
    text: "Write a reflection note", 
    xp: 10, 
    difficulty: 'easy', 
    category: 'wellness',
    autoComplete: true
  },
  { 
    type: "reflection_detailed", 
    text: "Write a detailed reflection (100+ words)", 
    xp: 20, 
    difficulty: 'hard', 
    category: 'wellness',
    autoComplete: true
  },

  // === LEARNING CATEGORY ===
  { 
    type: "pep_talk_listen", 
    text: "Listen to today's pep talk", 
    xp: 8, 
    difficulty: 'easy', 
    category: 'learning',
    autoComplete: true
  },
  { 
    type: "pep_talk_full", 
    text: "Listen to full pep talk (100%)", 
    xp: 15, 
    difficulty: 'medium', 
    category: 'learning',
    autoComplete: true
  },
  { 
    type: "mentor_chat_start", 
    text: "Start a conversation with your mentor", 
    xp: 10, 
    difficulty: 'easy', 
    category: 'learning',
    autoComplete: true
  },
  { 
    type: "mentor_chat_deep", 
    text: "Have an extended chat with your mentor (5+ messages)", 
    xp: 25, 
    difficulty: 'hard', 
    category: 'learning',
    autoComplete: true,
    progressTarget: 5
  },
  { 
    type: "library_explore", 
    text: "Browse the library", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'learning',
    autoComplete: true
  },

  // === SOCIAL CATEGORY ===
  { 
    type: "quote_favorite", 
    text: "Save a quote to favorites", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'social',
    autoComplete: true
  },
  { 
    type: "quote_share", 
    text: "Share an inspiring quote", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'social',
    autoComplete: true
  },
  { 
    type: "pep_talk_share", 
    text: "Share a pep talk", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'social',
    autoComplete: true
  },

  // === GROWTH CATEGORY ===
  { 
    type: "companion_visit", 
    text: "Visit your companion", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'growth',
    autoComplete: true
  },
  { 
    type: "companion_interact", 
    text: "Interact with your companion 3 times", 
    xp: 15, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: true,
    progressTarget: 3
  },
  { 
    type: "challenge_join", 
    text: "Start or continue a weekly challenge", 
    xp: 15, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: true
  },
  { 
    type: "challenge_complete_day", 
    text: "Complete today's challenge task", 
    xp: 20, 
    difficulty: 'hard', 
    category: 'growth',
    autoComplete: true
  },
  { 
    type: "streak_maintain", 
    text: "Maintain your habit streak", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'growth',
    autoComplete: true
  },
  { 
    type: "profile_update", 
    text: "Update your profile or preferences", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'growth',
    autoComplete: false // Manual
  },

  // === BONUS MISSIONS (Unlocked by chains) ===
  { 
    type: "bonus_habit_streak", 
    text: "BONUS: Keep your streak alive today", 
    xp: 25, 
    difficulty: 'medium', 
    category: 'habits',
    autoComplete: true
  },
  { 
    type: "bonus_perfect_day", 
    text: "BONUS: Achieve a perfect day", 
    xp: 50, 
    difficulty: 'hard', 
    category: 'growth',
    autoComplete: true
  },
  { 
    type: "bonus_triple_threat", 
    text: "BONUS: Complete 3 different categories today", 
    xp: 35, 
    difficulty: 'hard', 
    category: 'growth',
    autoComplete: true
  },
];

// Mission type to activity type mapping for auto-completion
export const MISSION_ACTIVITY_MAP: Record<string, {
  activityType: string | string[];
  validator?: (activityData: any, progressCurrent: number, progressTarget: number) => boolean;
}> = {
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
