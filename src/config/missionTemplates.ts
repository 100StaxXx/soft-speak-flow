/**
 * Comprehensive Mission Templates System
 * Supports auto-detection, difficulty scaling, chains, and personalization
 * 
 * Mission Philosophy:
 * - Connection = Small & instantly doable (5-10 XP, easy)
 * - Quick Win = 1-5 minutes (5-10 XP, easy/medium)
 * - Identity = Can be bigger or full-day missions (10-15 XP, medium/hard)
 */

export interface MissionTemplate {
  type: string;
  text: string;
  xp: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'connection' | 'quick_win' | 'identity';
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

  // === IDENTITY CATEGORY (10-15 XP, medium/hard) ===
  { 
    type: "identity_complete_all_quests", 
    text: "Complete all your quests today", 
    xp: 15, 
    difficulty: 'hard', 
    category: 'identity',
    autoComplete: true // Auto-completes when all quests done
  },
  { 
    type: "identity_complete_all_habits", 
    text: "Complete all your habits today", 
    xp: 12, 
    difficulty: 'medium', 
    category: 'identity',
    autoComplete: true // Auto-completes when all habits done
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
export const CATEGORY_XP_RANGES: Record<string, { min: number; max: number; difficulties: ('easy' | 'medium' | 'hard')[] }> = {
  connection: { min: 5, max: 10, difficulties: ['easy'] },
  quick_win: { min: 5, max: 10, difficulties: ['easy', 'medium'] },
  identity: { min: 10, max: 15, difficulties: ['medium', 'hard'] },
};
