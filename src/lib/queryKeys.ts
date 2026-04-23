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
    detail: (userId: string | undefined) => ['companion', userId] as const,
    healthAll: ['companion-health'] as const,
    health: (userId: string | undefined) => ['companion-health', userId] as const,
    careSignalsAll: ['companion-care-signals'] as const,
    careSignals: (userId: string | undefined) => ['companion-care-signals', userId] as const,
    mood: (userId: string) => ['companion-mood', userId] as const,
    postcards: (userId: string | undefined) => ['companion-postcards', userId] as const,
    postcardEpicsAll: ['postcards-epics'] as const,
    postcardEpics: (epicIdsKey: string) => ['postcards-epics', epicIdsKey] as const,
    chatHistoryAll: ['companion-chat-history'] as const,
    chatHistory: (userId: string | undefined, companionId: string | undefined) =>
      ['companion-chat-history', userId, companionId] as const,
    storyAll: ['companion-story'] as const,
    story: (companionId: string | undefined, stage: number | undefined) =>
      ['companion-story', companionId, stage] as const,
    storyImageAll: ['companion-story-image'] as const,
    storyImage: (companionId: string | undefined, stage: number | undefined) =>
      ['companion-story-image', companionId, stage] as const,
    storiesAllRoot: ['companion-stories-all'] as const,
    storiesAll: (companionId: string | undefined) => ['companion-stories-all', companionId] as const,
    attributesAll: ['companion-attributes'] as const,
    attributes: (companionId: string | undefined) => ['companion-attributes', companionId] as const,
    memoriesAll: ['companion-memories'] as const,
    memories: (companionId: string | undefined) => ['companion-memories', companionId] as const,
    bondAll: ['companion-bond'] as const,
    bond: (companionId: string | undefined) => ['companion-bond', companionId] as const,
    evolutionImageAll: ['companion-evolution-image'] as const,
    evolutionImage: (companionId: string | undefined) => ['companion-evolution-image', companionId] as const,
    currentEvolutionCardAll: ['current-evolution-card'] as const,
    currentEvolutionCard: (companionId: string | undefined, stage?: number) =>
      typeof stage === "number"
        ? ['current-evolution-card', companionId, stage] as const
        : ['current-evolution-card', companionId] as const,
  },

  companionPlanner: {
    memoryAll: ['companion-planner-memory'] as const,
    memory: (userId: string | undefined) => ['companion-planner-memory', userId] as const,
    contactsAll: ['companion-planner-contacts'] as const,
    contacts: (userId: string | undefined, thresholdDays: number) =>
      ['companion-planner-contacts', userId, thresholdDays] as const,
    statSignalsAll: ['companion-planner-stat-signals'] as const,
    statSignals: (userId: string | undefined, date: string) =>
      ['companion-planner-stat-signals', userId, date] as const,
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

  access: {
    all: ['access-state'] as const,
    detail: (userId: string) => ['access-state', userId] as const,
  },
  
  subscription: {
    all: ['subscription'] as const,
    detail: (userId: string) => ['subscription', userId] as const,
  },

  referrals: {
    all: ['referrals'] as const,
    statsAll: ['referral-stats'] as const,
    stats: (userId: string | undefined) => ['referral-stats', userId] as const,
    appliedCodeStateAll: ['applied-referral-code-state'] as const,
    appliedCodeState: (userId: string | undefined) => ['applied-referral-code-state', userId] as const,
    unlockedSkinsAll: ['unlocked-skins'] as const,
    unlockedSkins: (userId: string | undefined) => ['unlocked-skins', userId] as const,
    availableSkins: () => ['available-skins'] as const,
  },

  legacyTraits: {
    currentAll: ['legacy-traits'] as const,
    current: (userId: string | undefined) => ['legacy-traits', userId] as const,
    inheritableAll: ['inheritable-legacy-traits'] as const,
    inheritable: (userId: string | undefined) => ['inheritable-legacy-traits', userId] as const,
  },

  library: {
    favoritesAll: ['favorites'] as const,
    favorites: (userId: string | undefined) => ['favorites', userId] as const,
    downloadsAll: ['downloads'] as const,
    downloads: (userId: string | undefined) => ['downloads', userId] as const,
    favoriteQuotesAll: ['favorite-quotes'] as const,
    favoriteQuotes: (userId: string | undefined, quoteIdsKey: string) =>
      ['favorite-quotes', userId, quoteIdsKey] as const,
    favoritePepTalksAll: ['favorite-pep-talks'] as const,
    favoritePepTalks: (userId: string | undefined, pepTalkIdsKey: string) =>
      ['favorite-pep-talks', userId, pepTalkIdsKey] as const,
  },

  adminReferral: {
    configAll: ['admin-referral-config'] as const,
    config: () => ['admin-referral-config'] as const,
    codesAll: ['admin-referral-codes'] as const,
    codes: () => ['admin-referral-codes'] as const,
    payoutsAll: ['admin-referral-payouts'] as const,
    payouts: () => ['admin-referral-payouts'] as const,
    analyticsAll: ['admin-referral-analytics'] as const,
    analytics: () => ['admin-referral-analytics'] as const,
  },

  // ============================================
  // QUESTS & HABITS
  // ============================================
  dailyTasks: {
    all: ['daily-tasks'] as const,
    byDate: (userId: string | undefined, date: string) => ['daily-tasks', userId, date] as const,
    calendarAll: ['calendar-tasks'] as const,
    calendar: (userId: string | undefined, startDate: string, endDate: string, view: string) => 
      ['calendar-tasks', userId, startDate, endDate, view] as const,
  },

  plannerRuntime: {
    tasksAll: ['tasks'] as const,
    subtasksAll: ['subtasks'] as const,
    subtasks: (taskId: string | undefined) => ['subtasks', taskId] as const,
  },

  dailyMissions: {
    all: ['daily-missions'] as const,
    byDate: (date: string, userId: string | undefined) => ['daily-missions', date, userId] as const,
  },

  dailyMissionPulse: {
    all: ['daily-mission-pulse'] as const,
    byDate: (date: string, userId: string | undefined) => ['daily-mission-pulse', date, userId] as const,
  },

  morningBriefing: {
    all: ['morning-briefing'] as const,
    byDate: (date: string, userId: string | undefined) => ['morning-briefing', date, userId] as const,
  },

  checkIns: {
    morningAll: ['morning-check-in'] as const,
    morningByDate: (date: string, userId: string | undefined) => ['morning-check-in', date, userId] as const,
    morningLatestAll: ['morning-check-in-latest'] as const,
    morningLatest: (userId: string | undefined) => ['morning-check-in-latest', userId] as const,
    eveningAll: ['evening-reflection'] as const,
    evening: (userId: string | undefined, date: string) => ['evening-reflection', userId, date] as const,
  },

  journalEntries: {
    all: ['journal-entries'] as const,
    list: (
      userId: string | undefined,
      startDate: string | undefined,
      endDate: string | undefined,
      limit: number | undefined,
      entryTypesKey: string,
      checkInType: string | undefined,
    ) => [
      'journal-entries',
      userId,
      startDate ?? 'all',
      endDate ?? 'all',
      limit ?? 'all',
      entryTypesKey,
      checkInType ?? 'all',
    ] as const,
  },

  weeklyRecaps: {
    currentAll: ['weekly-recap'] as const,
    current: (userId: string | undefined, weekStart: string) => ['weekly-recap', userId, weekStart] as const,
    historyAll: ['weekly-recaps-all'] as const,
    history: (userId: string | undefined) => ['weekly-recaps-all', userId] as const,
  },

  dailyPlanOptimization: {
    all: ['daily-plan-optimization'] as const,
    byUser: (userId: string | undefined) => ['daily-plan-optimization', userId] as const,
  },

  recurringTemplates: {
    all: ['recurring-templates'] as const,
    pending: (userId: string | undefined, date: string) => ['recurring-templates', userId, date] as const,
  },

  astral: {
    encountersAll: ['astral-encounters'] as const,
    encounters: (userId: string | undefined) => ['astral-encounters', userId] as const,
    essencesAll: ['adversary-essences'] as const,
    essences: (userId: string | undefined) => ['adversary-essences', userId] as const,
    codexAll: ['cosmic-codex'] as const,
    codex: (userId: string | undefined) => ['cosmic-codex', userId] as const,
    xpTodayAll: ['astral-encounter-xp-today'] as const,
    xpToday: (userId: string | undefined, startOfTodayIso: string) =>
      ['astral-encounter-xp-today', userId, startOfTodayIso] as const,
  },

  resist: {
    badHabitsAll: ['bad-habits'] as const,
    badHabits: (userId: string | undefined) => ['bad-habits', userId] as const,
    logAll: ['resist-log'] as const,
    log: (userId: string | undefined) => ['resist-log', userId] as const,
  },

  inbox: {
    all: ['inbox'] as const,
    tasksAll: ['inbox-tasks'] as const,
    tasks: (userId: string | undefined) => ['inbox-tasks', userId] as const,
    countAll: ['inbox-count'] as const,
    count: (userId: string | undefined) => ['inbox-count', userId] as const,
  },

  questAutocomplete: {
    taskHistoryAll: ['quest-autocomplete-tasks'] as const,
    taskHistory: (userId: string | undefined) => ['quest-autocomplete-tasks', userId] as const,
    habitsAll: ['quest-autocomplete-habits'] as const,
    habits: (userId: string | undefined) => ['quest-autocomplete-habits', userId] as const,
  },

  habits: {
    all: ['habits'] as const,
    byUser: (userId: string | undefined) => ['habits', userId] as const,
    completionsAll: ['habit-completions'] as const,
    completions: (userId: string | undefined, date?: string) =>
      typeof date === 'string'
        ? ['habit-completions', userId, date] as const
        : ['habit-completions', userId] as const,
  },

  habitSurfacing: {
    all: ['habit-surfacing'] as const,
    byDate: (userId: string | undefined, date: string) =>
      ['habit-surfacing', userId, date] as const,
  },

  // ============================================
  // EPICS & GUILDS
  // ============================================
  epics: {
    all: ['epics'] as const,
    byUser: (userId: string | undefined) => ['epics', userId] as const,
    templates: () => ['epic-templates'] as const,
    welcomeImage: (userId?: string) => ['welcome-image', userId] as const,
    previewAll: ['epic-preview'] as const,
    preview: (inviteCode: string | undefined) => ['epic-preview', inviteCode] as const,
    detailsAll: ['epic-details'] as const,
    details: (epicId: string | undefined) => ['epic-details', epicId] as const,
    habitCompletionsAll: ['epic-habit-completions'] as const,
    habitCompletions: (epicId: string | undefined, userId: string | undefined) =>
      ['epic-habit-completions', epicId, userId] as const,
    lastActivityAll: ['last-epic-activity'] as const,
    lastActivity: (epicId: string | undefined, userId: string | undefined) =>
      ['last-epic-activity', epicId, userId] as const,
  },

  publicEpics: {
    all: ['public-epics'] as const,
  },

  achievements: {
    all: ['achievements'] as const,
    byUser: (userId: string | undefined) => ['achievements', userId] as const,
  },

  milestones: {
    byEpic: (epicId: string | undefined) => ['milestones', epicId] as const,
  },

  calendarMilestones: {
    all: ['calendar-milestones'] as const,
    byRange: (userId: string | undefined, startDate: string, endDate: string) =>
      ['calendar-milestones', userId, startDate, endDate] as const,
  },

  epicRewards: {
    all: ['epic-rewards'] as const,
    userAll: ['user-epic-rewards'] as const,
    user: (userId: string | undefined) => ['user-epic-rewards', userId] as const,
  },

  epicProgress: {
    all: ['epic-progress'] as const,
  },

  userAiContext: {
    all: ['user-ai-context'] as const,
    detail: (userId: string | undefined) => ['user-ai-context', userId] as const,
  },

  guild: {
    all: ['guild'] as const,
    titlesAll: ['guild-titles'] as const,
    titles: () => ['guild-titles'] as const,
    myTitlesAll: ['my-guild-titles'] as const,
    myTitles: (
      userId: string | undefined,
      epicId: string | undefined,
      communityId: string | undefined,
    ) => ['my-guild-titles', userId, epicId, communityId] as const,
    storiesAll: ['guild-stories'] as const,
    stories: (epicId: string | undefined) => ['guild-stories', epicId] as const,
    unreadStoriesAll: ['unread-guild-stories'] as const,
    unreadStories: (userId: string | undefined) => ['unread-guild-stories', userId] as const,
    activityAll: ['guild-activity'] as const,
    activity: (epicId: string | undefined) => ['guild-activity', epicId] as const,
    shoutsAll: ['guild-shouts'] as const,
    shouts: (scopeType: 'epic' | 'community', scopeId: string | undefined) =>
      ['guild-shouts', scopeType, scopeId] as const,
    blessingTypes: ['blessing-types'] as const,
    blessingChargesAll: ['blessing-charges'] as const,
    blessingCharges: (userId: string | undefined) => ['blessing-charges', userId] as const,
    myBlessingsAll: ['my-blessings'] as const,
    myBlessings: (
      userId: string | undefined,
      epicId: string | undefined,
      communityId: string | undefined,
    ) => ['my-blessings', userId, epicId, communityId] as const,
    blessingsFeedAll: ['guild-blessings-feed'] as const,
    blessingsFeed: (epicId: string | undefined, communityId: string | undefined) =>
      ['guild-blessings-feed', epicId, communityId] as const,
    rivalryAll: ['guild-rivalry'] as const,
    rivalry: (
      scopeType: 'epic' | 'community',
      scopeId: string | undefined,
      userId?: string | undefined,
    ) => userId
      ? ['guild-rivalry', scopeType, scopeId, userId] as const
      : ['guild-rivalry', scopeType, scopeId] as const,
    bossAll: ['guild-boss'] as const,
    boss: (epicId: string | undefined, communityId: string | undefined) =>
      ['guild-boss', epicId, communityId] as const,
    legendsAll: ['guild-legends'] as const,
    legends: (epicId: string | undefined, communityId: string | undefined) =>
      ['guild-legends', epicId, communityId] as const,
    bossDamageLogAll: ['boss-damage-log'] as const,
    bossDamageLog: (encounterId: string | undefined) => ['boss-damage-log', encounterId] as const,
    mutedUsers: (userId: string | undefined, epicId: string | undefined) =>
      ['muted-users', userId, epicId] as const,
  },

  communities: {
    all: ['communities'] as const,
    my: (userId: string | undefined) => ['communities', 'my', userId] as const,
    public: () => ['communities', 'public'] as const,
  },

  community: {
    detail: (communityId: string | undefined) => ['community', communityId] as const,
    membersAll: ['community-members'] as const,
    members: (communityId: string | undefined) => ['community-members', communityId] as const,
  },

  // ============================================
  // MENTOR & CONTENT
  // ============================================
  mentor: {
    all: ['mentor'] as const,
    detail: (mentorId: string | undefined) => ['mentor', mentorId] as const,
    activeMentors: () => ['mentors', 'active'] as const,
    pageDataAll: ['mentor-page-data'] as const,
    pageData: (mentorId: string | undefined, pepTalkDate: string | undefined) =>
      ['mentor-page-data', mentorId, pepTalkDate] as const,
    personalityAll: ['mentor-personality'] as const,
    personality: (mentorId: string | undefined) => ['mentor-personality', mentorId] as const,
    selectedAll: ['selected-mentor'] as const,
    selected: (mentorId: string | undefined) => ['selected-mentor', mentorId] as const,
    primaryAll: ['mentor-primary'] as const,
    primary: (mentorId: string | undefined) => ['mentor-primary', mentorId] as const,
    todayPepTalkAll: ['today-pep-talk'] as const,
    todayPepTalk: (mentorId: string | null | undefined, effectiveDate: string | undefined) =>
      ['today-pep-talk', mentorId ?? null, effectiveDate] as const,
    pepTalksAll: ['achievement-pep-talks'] as const,
    pepTalks: (userId: string | undefined) => ['achievement-pep-talks', userId] as const,
  },

  // ============================================
  // ACTIVITY & ANALYTICS
  // ============================================
  activityFeed: {
    all: ['activity-feed'] as const,
    byUser: (userId: string | undefined) => ['activity-feed', userId] as const,
  },

  wallpapers: {
    all: ['wallpapers'] as const,
    live: (pageKey: string, dateKey: string) => ['wallpapers', 'live', pageKey, dateKey] as const,
    manifest: (dateKeys: readonly string[]) => ['wallpapers', 'manifest', ...dateKeys] as const,
    catalog: () => ['wallpapers', 'catalog'] as const,
  },

  narrative: {
    epicAll: ['narrative-epic'] as const,
    epic: (epicId: string | undefined) => ['narrative-epic', epicId] as const,
    storyTypesAll: ['story-types'] as const,
    storyTypes: () => ['story-types'] as const,
    storyCharactersAll: ['story-characters'] as const,
  },

  analytics: {
    habits: (userId: string | undefined) => ['analytics-habits', userId] as const,
    moods: (userId: string | undefined) => ['analytics-moods', userId] as const,
    streaks: (userId: string | undefined) => ['analytics-streaks', userId] as const,
    checkins: (userId: string | undefined) => ['analytics-checkins', userId] as const,
  },

  search: {
    featuredQuotesAll: ['featured-quotes'] as const,
    featuredQuotes: () => ['featured-quotes'] as const,
    featuredPepTalksAll: ['featured-pep-talks'] as const,
    featuredPepTalks: () => ['featured-pep-talks'] as const,
    quotesAll: ['search-quotes'] as const,
    quotes: (query: string) => ['search-quotes', query] as const,
    pepTalksAll: ['search-pep-talks'] as const,
    pepTalks: (query: string) => ['search-pep-talks', query] as const,
    challengesAll: ['search-challenges'] as const,
    challenges: (query: string) => ['search-challenges', query] as const,
    questsAll: ['search-tasks'] as const,
    quests: (query: string, userId: string | undefined) => ['search-tasks', query, userId] as const,
    epicsAll: ['search-epics'] as const,
    epics: (query: string, userId: string | undefined) => ['search-epics', query, userId] as const,
  },

  pepTalks: {
    all: ['pep-talks'] as const,
    filtered: (category: string | null, trigger: string | null) => ['pep-talks', category, trigger] as const,
  },

  challenges: {
    all: ['challenges'] as const,
    userAll: ['user-challenges'] as const,
    user: (userId: string | undefined) => ['user-challenges', userId] as const,
    progressAll: ['challenge-progress'] as const,
    progress: (userId: string | undefined) => ['challenge-progress', userId] as const,
  },

  xp: {
    breakdownAll: ['xp-breakdown'] as const,
    breakdown: (date: string, userId: string | undefined) => ['xp-breakdown', date, userId] as const,
  },

  promotion: {
    opportunitiesAll: ['promotion-opportunities'] as const,
    opportunities: (userId: string | undefined) => ['promotion-opportunities', userId] as const,
  },

  // ============================================
  // STREAKS

  // ============================================
  // STREAKS
  // ============================================
  streaks: {
    freezesAll: ['streak-freezes'] as const,
    freezes: (userId: string | undefined) => ['streak-freezes', userId] as const,
    atRiskAll: ['streak-at-risk'] as const,
    atRisk: (userId: string | undefined) => ['streak-at-risk', userId] as const,
  },

  // ============================================
  // CONTACTS / CRM
  // ============================================
  contacts: {
    all: ['contacts'] as const,
    byUser: (userId: string) => ['contacts', userId] as const,
    detail: (contactId: string) => ['contacts', 'detail', contactId] as const,
  },

  calendar: {
    settingsAll: ['calendar-user-settings'] as const,
    settings: (userId: string | undefined) => ['calendar-user-settings', userId] as const,
    connectionsAll: ['calendar-connections'] as const,
    connections: (userId: string | undefined) => ['calendar-connections', userId] as const,
    questLinksAll: ['quest-calendar-links'] as const,
    questLinks: (userId: string | undefined) => ['quest-calendar-links', userId] as const,
    outlookTaskLinksAll: ['quest-outlook-task-links'] as const,
    outlookTaskLinks: (userId: string | undefined) => ['quest-outlook-task-links', userId] as const,
    externalEventsAll: ['external-calendar-events'] as const,
    externalEvents: (
      userId: string | undefined,
      startDate: string,
      endDate: string,
      horizon: string,
    ) => ['external-calendar-events', userId, startDate, endDate, horizon] as const,
  },

  contactInteractions: {
    all: ['contact-interactions'] as const,
    byContact: (contactId: string) => ['contact-interactions', contactId] as const,
  },

  contactReminders: {
    all: ['contact-reminders'] as const,
    byContact: (contactId: string) => ['contact-reminders', contactId] as const,
    upcoming: () => ['contact-reminders', 'upcoming'] as const,
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
