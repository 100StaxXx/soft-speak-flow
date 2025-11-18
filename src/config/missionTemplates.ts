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
    type: "all_habits", 
    text: "Complete all your habits today", 
    xp: 10, 
    difficulty: 'medium', 
    category: 'habits',
    autoComplete: true
  },

  // === WELLNESS CATEGORY ===
  { 
    type: "check_in_morning", 
    text: "Complete your morning check-in", 
    xp: 5, 
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

  // === LEARNING CATEGORY ===
  { 
    type: "pep_talk_listen", 
    text: "Listen to today's pep talk", 
    xp: 3, 
    difficulty: 'easy', 
    category: 'learning',
    autoComplete: true
  },
  { 
    type: "mentor_chat_start", 
    text: "Chat with your mentor", 
    xp: 10, 
    difficulty: 'easy', 
    category: 'learning',
    autoComplete: true
  },
  { 
    type: "quote_read", 
    text: "Read today's quote", 
    xp: 3, 
    difficulty: 'easy', 
    category: 'learning',
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
    type: "profile_update", 
    text: "Update your profile", 
    xp: 5, 
    difficulty: 'easy', 
    category: 'growth',
    autoComplete: false // Manual
  },
  { 
    type: "streak_maintain", 
    text: "Maintain your daily streak", 
    xp: 10, 
    difficulty: 'medium', 
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
