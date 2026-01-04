/**
 * Query Key Factory
 * 
 * Centralized query key management for TanStack Query.
 * Using a factory pattern ensures:
 * - Consistent key structure across the app
 * - Type-safe key generation
 * - Easy cache invalidation
 * - No typos in query keys
 * 
 * Usage:
 *   import { queryKeys } from '@/lib/queryKeys';
 *   
 *   // In a query
 *   useQuery({ queryKey: queryKeys.companion.detail(userId), ... })
 *   
 *   // Invalidating
 *   queryClient.invalidateQueries({ queryKey: queryKeys.companion.all })
 */

export const queryKeys = {
  // ============================================
  // COMPANION & EVOLUTION
  // ============================================
  companion: {
    all: ['companion'] as const,
    detail: (userId: string) => ['companion', userId] as const,
    health: (userId: string) => ['companion-health', userId] as const,
    mood: (userId: string) => ['companion-mood', userId] as const,
    postcards: (userId: string) => ['companion-postcards', userId] as const,
    story: (companionId: string, stage: number) => ['companion-story', companionId, stage] as const,
    storiesAll: (companionId: string) => ['companion-stories-all', companionId] as const,
    attributes: (companionId: string) => ['companion-attributes', companionId] as const,
  },
  
  evolution: {
    all: ['evolution'] as const,
    thresholds: () => ['evolution-thresholds'] as const,
    cards: (companionId?: string) => companionId 
      ? ['evolution-cards', companionId] as const 
      : ['evolution-cards'] as const,
  },

  // ============================================
  // USER & PROFILE
  // ============================================
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => ['profile', userId] as const,
  },
  
  subscription: {
    all: ['subscription'] as const,
    detail: (userId: string) => ['subscription', userId] as const,
  },

  referrals: {
    all: ['referrals'] as const,
    stats: (userId: string) => ['referral-stats', userId] as const,
    unlockedSkins: (userId: string) => ['unlocked-skins', userId] as const,
    availableSkins: () => ['available-skins'] as const,
  },

  // ============================================
  // QUESTS & HABITS
  // ============================================
  dailyTasks: {
    all: ['daily-tasks'] as const,
    byDate: (userId: string, date: string) => ['daily-tasks', userId, date] as const,
    calendar: (userId: string, startDate: string, endDate: string, view: string) => 
      ['calendar-tasks', userId, startDate, endDate, view] as const,
  },

  dailyMissions: {
    all: ['daily-missions'] as const,
    byDate: (date: string, userId: string) => ['daily-missions', date, userId] as const,
  },

  habits: {
    all: ['habits'] as const,
    byUser: (userId: string) => ['habits', userId] as const,
    completions: (userId: string) => ['habit-completions', userId] as const,
  },

  // ============================================
  // EPICS & GUILDS
  // ============================================
  epics: {
    all: ['epics'] as const,
    byUser: (userId: string) => ['epics', userId] as const,
    templates: () => ['epic-templates'] as const,
    welcomeImage: (userId?: string) => ['welcome-image', userId] as const,
  },

  guild: {
    all: ['guild'] as const,
    stories: (epicId: string) => ['guild-stories', epicId] as const,
    unreadStories: (userId: string) => ['unread-guild-stories', userId] as const,
    activity: (epicId: string) => ['guild-activity', epicId] as const,
    shouts: (epicId: string) => ['guild-shouts', epicId] as const,
    rivalry: (epicId: string, userId?: string) => userId 
      ? ['guild-rivalry', epicId, userId] as const
      : ['guild-rivalry', epicId] as const,
    mutedUsers: (userId: string, epicId: string) => ['muted-users', userId, epicId] as const,
  },

  // ============================================
  // MENTOR & CONTENT
  // ============================================
  mentor: {
    all: ['mentor'] as const,
    personality: (mentorId: string) => ['mentor-personality', mentorId] as const,
    pepTalks: (userId: string) => ['achievement-pep-talks', userId] as const,
  },

  // ============================================
  // ACTIVITY & ANALYTICS
  // ============================================
  activityFeed: {
    all: ['activity-feed'] as const,
    byUser: (userId: string) => ['activity-feed', userId] as const,
  },

  analytics: {
    habits: (userId: string) => ['analytics-habits', userId] as const,
    moods: (userId: string) => ['analytics-moods', userId] as const,
    streaks: (userId: string) => ['analytics-streaks', userId] as const,
    checkins: (userId: string) => ['analytics-checkins', userId] as const,
  },

  // ============================================
  // STREAKS

  // ============================================
  // STREAKS
  // ============================================
  streaks: {
    freezes: (userId: string) => ['streak-freezes', userId] as const,
  },
} as const;

// Type helpers for query key inference
export type QueryKeys = typeof queryKeys;

/**
 * Helper to create a query key with optional filters
 * Useful for more complex query scenarios
 */
export function createQueryKey<T extends readonly unknown[]>(
  base: T,
  filters?: Record<string, unknown>
): readonly unknown[] {
  if (!filters || Object.keys(filters).length === 0) {
    return base;
  }
  return [...base, filters];
}
