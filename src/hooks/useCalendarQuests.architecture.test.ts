import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(__dirname, "..");
const retiredCalendarTasksHookPath = path.resolve(__dirname, "useCalendarTasks.ts");
const internalLegacyCalendarTaskRangeHookPath = path.resolve(
  __dirname,
  "internal",
  "useLegacyCalendarTaskRange.ts",
);
const legacyQuestTypesPath = path.resolve(srcRoot, "types", "quest.ts");
const calendarTaskLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const plannerRuntimeLiteralAllowedFiles: string[] = [];
const dailyTaskLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
  path.resolve(srcRoot, "hooks", "useDailyTasksRealtime.ts"),
].sort();
const inboxLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const questAutocompleteLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const campaignContextLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const referralAccessLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const legacyTraitLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const streakLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const libraryLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const narrativeLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const analyticsLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const adminReferralLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const searchLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const plannerReadLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const plannerMemoryLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const coreReadLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const contentLiteralAllowedFiles: string[] = [];
const epicReadLiteralAllowedFiles: string[] = [];
const mentorLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const companionContextLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const guildSocialLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const guildCombatLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const dailyMissionLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const weeklyRecapLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const recurringTemplateLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const checkInLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
  path.resolve(srcRoot, "utils", "eveningReflectionNavigation.ts"),
].sort();
const calendarIntegrationLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const astralResistLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const publicEpicsLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const epicTemplateLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const epicRewardLiteralAllowedFiles = [
  path.resolve(srcRoot, "lib", "queryKeys.ts"),
].sort();
const allowedEpicResourceOperationFiles = [
  path.resolve(srcRoot, "lib", "epicResourceQueryCache.ts"),
].sort();
const allowedEpicRewardOperationFiles = [
  path.resolve(srcRoot, "lib", "epicRewardQueryCache.ts"),
].sort();
const allowedScopedHabitOperationFiles = [
  path.resolve(srcRoot, "lib", "campaignContextQueryCache.ts"),
].sort();
const allowedContactOperationFiles = [
  path.resolve(srcRoot, "lib", "contactQueryCache.ts"),
].sort();
const allowedMentorContextOperationFiles = [
  path.resolve(srcRoot, "lib", "mentorContextQueryCache.ts"),
].sort();
const allowedProfileQueryOperationFiles = [
  path.resolve(srcRoot, "lib", "profileQueryCache.ts"),
].sort();
const allowedProfileAccessOperationFiles = [
  path.resolve(srcRoot, "lib", "profileAccessQueryCache.ts"),
].sort();
const allowedLegacyTraitOperationFiles = [
  path.resolve(srcRoot, "lib", "legacyTraitQueryCache.ts"),
].sort();
const allowedStreakOperationFiles = [
  path.resolve(srcRoot, "lib", "streakQueryCache.ts"),
].sort();
const allowedLibraryOperationFiles = [
  path.resolve(srcRoot, "lib", "libraryQueryCache.ts"),
].sort();
const allowedCosmicLibraryOperationFiles = [
  path.resolve(srcRoot, "lib", "cosmicLibraryQueryCache.ts"),
].sort();
const allowedAdminReferralOperationFiles = [
  path.resolve(srcRoot, "lib", "adminReferralQueryCache.ts"),
].sort();
const allowedCompanionContextOperationFiles = [
  path.resolve(srcRoot, "lib", "companionContextQueryCache.ts"),
].sort();
const allowedCompanionConversationOperationFiles = [
  path.resolve(srcRoot, "lib", "companionConversationQueryCache.ts"),
].sort();
const allowedGuildOperationFiles = [
  path.resolve(srcRoot, "lib", "guildQueryCache.ts"),
].sort();
const allowedGuildCombatOperationFiles = [
  path.resolve(srcRoot, "lib", "guildCombatQueryCache.ts"),
].sort();
const allowedActivityFeedOperationFiles = [
  path.resolve(srcRoot, "lib", "activityFeedQueryCache.ts"),
].sort();
const allowedCommunityOperationFiles = [
  path.resolve(srcRoot, "lib", "communityQueryCache.ts"),
].sort();
const allowedDailyMissionOperationFiles = [
  path.resolve(srcRoot, "lib", "dailyMissionQueryCache.ts"),
].sort();
const allowedWeeklyRecapOperationFiles = [
  path.resolve(srcRoot, "lib", "weeklyRecapQueryCache.ts"),
].sort();
const allowedRecurringTemplateOperationFiles = [
  path.resolve(srcRoot, "lib", "recurringTemplateQueryCache.ts"),
].sort();
const allowedDailyReflectionOperationFiles = [
  path.resolve(srcRoot, "lib", "dailyReflectionQueryCache.ts"),
  path.resolve(srcRoot, "lib", "journalEntryQueryCache.ts"),
  path.resolve(srcRoot, "lib", "mentorContextQueryCache.ts"),
].sort();
const allowedCalendarIntegrationOperationFiles = [
  path.resolve(srcRoot, "lib", "calendarIntegrationQueryCache.ts"),
].sort();
const allowedQuestAutocompleteOperationFiles = [
  path.resolve(srcRoot, "lib", "questAutocompleteQueryCache.ts"),
].sort();
const allowedAstralResistOperationFiles = [
  path.resolve(srcRoot, "lib", "astralResistQueryCache.ts"),
].sort();
const runtimeBoundaryRoots = [
  path.resolve(srcRoot, "hooks"),
  path.resolve(srcRoot, "components"),
  path.resolve(srcRoot, "pages"),
];
const allowedLegacyCalendarTaskRangeImporters = [
  path.resolve(__dirname, "useCalendarQuests.ts"),
].sort();

const collectRuntimeSourceFiles = (dirPath: string): string[] =>
  fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return collectRuntimeSourceFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith(".d.ts")) {
      return [];
    }

    if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
      return [];
    }

    return [entryPath];
  });

const importsNamedHook = (source: string, modulePathFragment: string, hookName: string) => {
  const hookImportBlocks = source.match(
    new RegExp(`import[\\s\\S]*?from\\s+[\"'][^\"']*${modulePathFragment}[\"'];?`, "gm"),
  ) ?? [];

  return hookImportBlocks.some((importBlock) =>
    new RegExp(`\\b${hookName}\\b`).test(importBlock),
  );
};

describe("useCalendarQuests architecture guardrails", () => {
  it("retires useCalendarTasks as a public hook", () => {
    expect(fs.existsSync(retiredCalendarTasksHookPath)).toBe(false);

    const importers = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => importsNamedHook(fs.readFileSync(filePath, "utf8"), "useCalendarTasks", "useCalendarTasks"))
      .sort();

    expect(importers).toEqual([]);
  });

  it("keeps the internal legacy calendar task range hook isolated to the canonical wrapper", () => {
    expect(fs.existsSync(internalLegacyCalendarTaskRangeHookPath)).toBe(true);

    const importers = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => importsNamedHook(
        fs.readFileSync(filePath, "utf8"),
        "useLegacyCalendarTaskRange",
        "useLegacyCalendarTaskRange",
      ))
      .sort();

    expect(importers).toEqual(allowedLegacyCalendarTaskRangeImporters);
  });

  it("keeps CalendarTask out of runtime hooks, components, and pages", () => {
    const runtimeCalendarTaskMentions = runtimeBoundaryRoots
      .flatMap(collectRuntimeSourceFiles)
      .filter((filePath) => /\bCalendarTask\b/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(runtimeCalendarTaskMentions).toEqual([]);
  });

  it("retires the legacy quest compatibility types bucket", () => {
    expect(fs.existsSync(legacyQuestTypesPath)).toBe(false);

    const legacyQuestTypeImporters = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /from\s+["']@\/types\/quest["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(legacyQuestTypeImporters).toEqual([]);
  });

  it("keeps raw calendar-tasks cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']calendar-tasks["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(calendarTaskLiteralAllowedFiles);
  });

  it("keeps raw planner runtime tasks and subtasks query construction behind helpers", () => {
    const rawLiteralFiles = runtimeBoundaryRoots
      .flatMap(collectRuntimeSourceFiles)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          'queryKey: ["tasks"]',
          "queryKey: ['tasks']",
          'invalidateQueries({ queryKey: ["tasks"]',
          "invalidateQueries({ queryKey: ['tasks']",
          'refetchQueries({ queryKey: ["tasks"]',
          "refetchQueries({ queryKey: ['tasks']",
          'queryKey: ["subtasks",',
          "queryKey: ['subtasks',",
          'invalidateQueries({ queryKey: ["subtasks",',
          "invalidateQueries({ queryKey: ['subtasks',",
          'refetchQueries({ queryKey: ["subtasks",',
          "refetchQueries({ queryKey: ['subtasks',",
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual(plannerRuntimeLiteralAllowedFiles);
  });

  it("keeps raw daily-tasks cache literals isolated to queryKeys and realtime transport", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'`]daily-tasks/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(dailyTaskLiteralAllowedFiles);
  });

  it("keeps raw inbox cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']inbox-(tasks|count)["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(inboxLiteralAllowedFiles);
  });

  it("keeps raw quest autocomplete cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']quest-autocomplete-(tasks|habits)["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(questAutocompleteLiteralAllowedFiles);
  });

  it("keeps direct daily and inbox queryClient cache-family operations behind shared helpers", () => {
    const directTaskCacheOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /queryClient\.(cancelQueries|getQueriesData|setQueriesData|invalidateQueries)\(\{ queryKey: queryKeys\.(dailyTasks|inbox)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directTaskCacheOperationFiles).toEqual([]);
  });

  it("keeps raw campaign-context cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](habit-completions|habit-surfacing|user-ai-context|epic-progress)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(campaignContextLiteralAllowedFiles);
  });

  it("keeps raw referral-access cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](referral-stats|applied-referral-code-state|unlocked-skins|available-skins)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(referralAccessLiteralAllowedFiles);
  });

  it("keeps raw legacy trait cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](legacy-traits|inheritable-legacy-traits)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(legacyTraitLiteralAllowedFiles);
  });

  it("keeps raw streak-at-risk cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](streak-at-risk|streak-freezes)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(streakLiteralAllowedFiles);
  });

  it("keeps raw library cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryKey: ['favorites'",
          'queryKey: ["favorites"',
          "queryKey: ['downloads'",
          'queryKey: ["downloads"',
          "queryKey: ['favorite-quotes'",
          'queryKey: ["favorite-quotes"',
          "queryKey: ['favorite-pep-talks'",
          'queryKey: ["favorite-pep-talks"',
          "queryClient.invalidateQueries({ queryKey: ['favorites']",
          'queryClient.invalidateQueries({ queryKey: ["favorites"]',
          "queryClient.invalidateQueries({ queryKey: ['downloads']",
          'queryClient.invalidateQueries({ queryKey: ["downloads"]',
          "queryClient.invalidateQueries({ queryKey: ['favorite-quotes']",
          'queryClient.invalidateQueries({ queryKey: ["favorite-quotes"]',
          "queryClient.invalidateQueries({ queryKey: ['favorite-pep-talks']",
          'queryClient.invalidateQueries({ queryKey: ["favorite-pep-talks"]',
          "queryClient.refetchQueries({ queryKey: ['favorites']",
          'queryClient.refetchQueries({ queryKey: ["favorites"]',
          "queryClient.refetchQueries({ queryKey: ['downloads']",
          'queryClient.refetchQueries({ queryKey: ["downloads"]',
          "queryClient.refetchQueries({ queryKey: ['favorite-quotes']",
          'queryClient.refetchQueries({ queryKey: ["favorite-quotes"]',
          "queryClient.refetchQueries({ queryKey: ['favorite-pep-talks']",
          'queryClient.refetchQueries({ queryKey: ["favorite-pep-talks"]',
          "setQueryData(['favorites'",
          'setQueryData(["favorites"',
          "setQueryData(['downloads'",
          'setQueryData(["downloads"',
          "setQueryData(['favorite-quotes'",
          'setQueryData(["favorite-quotes"',
          "setQueryData(['favorite-pep-talks'",
          'setQueryData(["favorite-pep-talks"',
          "setQueriesData(['favorites'",
          'setQueriesData(["favorites"',
          "setQueriesData(['downloads'",
          'setQueriesData(["downloads"',
          "setQueriesData(['favorite-quotes'",
          'setQueriesData(["favorite-quotes"',
          "setQueriesData(['favorite-pep-talks'",
          'setQueriesData(["favorite-pep-talks"',
          "['favorites'] as const",
          '["favorites"] as const',
          "['downloads'] as const",
          '["downloads"] as const',
          "['favorite-quotes'] as const",
          '["favorite-quotes"] as const',
          "['favorite-pep-talks'] as const",
          '["favorite-pep-talks"] as const',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual(libraryLiteralAllowedFiles);
  });

  it("keeps raw narrative cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](narrative-epic|story-types|story-characters)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(narrativeLiteralAllowedFiles);
  });

  it("keeps raw analytics cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](analytics-habits|analytics-moods|analytics-streaks|analytics-checkins)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(analyticsLiteralAllowedFiles);
  });

  it("keeps raw admin referral cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](admin-referral-config|admin-referral-codes|admin-referral-payouts|admin-referral-analytics)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(adminReferralLiteralAllowedFiles);
  });

  it("keeps raw search cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](featured-quotes|featured-pep-talks|search-quotes|search-pep-talks|search-challenges|search-tasks|search-epics)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(searchLiteralAllowedFiles);
  });

  it("keeps raw daily plan optimization cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']daily-plan-optimization["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(plannerReadLiteralAllowedFiles);
  });

  it("keeps raw planner memory, contact, and stat-signal cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](companion-planner-memory|companion-planner-contacts|companion-planner-stat-signals)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(plannerMemoryLiteralAllowedFiles);
  });

  it("keeps raw challenges, pep-talk, XP, and promotion cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryKey: ['challenges'",
          'queryKey: ["challenges"',
          "queryKey: ['user-challenges'",
          'queryKey: ["user-challenges"',
          "queryKey: ['challenge-progress'",
          'queryKey: ["challenge-progress"',
          "queryKey: ['pep-talks'",
          'queryKey: ["pep-talks"',
          "queryKey: ['xp-breakdown'",
          'queryKey: ["xp-breakdown"',
          "queryKey: ['promotion-opportunities'",
          'queryKey: ["promotion-opportunities"',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual(contentLiteralAllowedFiles);
  });

  it("keeps raw epic preview, achievement, and calendar/insight read cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryKey: ['epic-preview'",
          'queryKey: ["epic-preview"',
          "queryKey: ['achievements'",
          'queryKey: ["achievements"',
          "queryKey: ['calendar-milestones'",
          'queryKey: ["calendar-milestones"',
          "queryKey: ['epic-details'",
          'queryKey: ["epic-details"',
          "queryKey: ['epic-habit-completions'",
          'queryKey: ["epic-habit-completions"',
          "queryKey: ['last-epic-activity'",
          'queryKey: ["last-epic-activity"',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual(epicReadLiteralAllowedFiles);
  });

  it("keeps raw habits and epics read cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          'queryKey: ["habits"',
          "queryKey: ['habits'",
          'queryKey: ["epics"',
          "queryKey: ['epics'",
          "['habits'] as const",
          '["habits"] as const',
          "['epics'] as const",
          '["epics"] as const',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual(coreReadLiteralAllowedFiles);
  });

  it("keeps raw mentor-content cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](mentor-page-data|mentor-personality|selected-mentor|mentor-primary|today-pep-talk|achievement-pep-talks)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(mentorLiteralAllowedFiles);
  });

  it("keeps active mentor query construction behind queryKeys", () => {
    const rawActiveMentorQueryFiles = runtimeBoundaryRoots
      .flatMap(collectRuntimeSourceFiles)
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes('queryKey: ["mentors", "active"]'))
      .sort();

    expect(rawActiveMentorQueryFiles).toEqual([]);
  });

  it("keeps raw companion-context cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](companion-care-signals|companion-attributes|companion-story|companion-story-image|companion-stories-all|companion-memories|companion-bond|companion-evolution-image|companion-chat-history|companion-postcards|postcards-epics|current-evolution-card|evolution-cards|wallpapers)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(companionContextLiteralAllowedFiles);
  });

  it("keeps raw companion root query construction behind queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          'queryKey: ["companion"]',
          "queryKey: ['companion']",
          'queryKey: ["companion",',
          "queryKey: ['companion',",
          'invalidateQueries({ queryKey: ["companion"]',
          "invalidateQueries({ queryKey: ['companion']",
          'refetchQueries({ queryKey: ["companion"]',
          "refetchQueries({ queryKey: ['companion']",
          'refetchQueries({ queryKey: ["companion",',
          "refetchQueries({ queryKey: ['companion',",
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(rawLiteralFiles).toEqual([]);
  });

  it("keeps raw guild and activity-feed cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](guild-titles|my-guild-titles|guild-stories|unread-guild-stories|guild-activity|guild-shouts|blessing-types|blessing-charges|my-blessings|guild-blessings-feed|muted-users|activity-feed)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(guildSocialLiteralAllowedFiles);
  });

  it("keeps raw guild combat cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](guild-rivalry|guild-boss|guild-legends|boss-damage-log)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(guildCombatLiteralAllowedFiles);
  });

  it("keeps raw community cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /(queryKey:\s*\[(["'])(communities|community|community-members)\2|queryClient\.(invalidateQueries|refetchQueries)\(\{ queryKey: \[(["'])(communities|community|community-members)\5|setQueriesData\(\s*\{\s*queryKey:\s*\[(["'])(communities|community|community-members)\7)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual([]);
  });

  it("keeps raw daily mission cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](daily-missions|daily-mission-pulse|morning-briefing)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(dailyMissionLiteralAllowedFiles);
  });

  it("keeps raw weekly recap cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](weekly-recap|weekly-recaps-all)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(weeklyRecapLiteralAllowedFiles);
  });

  it("keeps raw recurring template cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']recurring-templates["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(recurringTemplateLiteralAllowedFiles);
  });

  it("keeps raw daily reflection cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](morning-check-in|morning-check-in-latest|evening-reflection)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(checkInLiteralAllowedFiles);
  });

  it("keeps raw calendar integration cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](calendar-user-settings|calendar-connections|quest-calendar-links|quest-outlook-task-links|external-calendar-events)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(calendarIntegrationLiteralAllowedFiles);
  });

  it("keeps raw astral and resist cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](astral-encounters|adversary-essences|cosmic-codex|astral-encounter-xp-today|bad-habits|resist-log)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(astralResistLiteralAllowedFiles);
  });

  it("keeps broad campaign-context queryClient cache-family operations behind shared helpers", () => {
    const directCampaignCacheOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /queryClient\.(cancelQueries|getQueriesData|setQueriesData|invalidateQueries)\(\{ queryKey: (queryKeys\.(epics\.all|habits\.all|habits\.completionsAll|habitSurfacing\.all|userAiContext\.all|epicProgress\.all)|["'](epics|habits|habit-completions|habit-surfacing|user-ai-context|epic-progress)["'])/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directCampaignCacheOperationFiles).toEqual([]);
  });

  it("keeps raw public-epics cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']public-epics["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(publicEpicsLiteralAllowedFiles);
  });

  it("keeps raw epic template cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["']epic-templates["']/.test(fs.readFileSync(filePath, "utf8")))
      .sort();

    expect(rawLiteralFiles).toEqual(epicTemplateLiteralAllowedFiles);
  });

  it("keeps raw epic reward cache literals isolated to queryKeys", () => {
    const rawLiteralFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /["'](epic-rewards|user-epic-rewards)["']/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(rawLiteralFiles).toEqual(epicRewardLiteralAllowedFiles);
  });

  it("keeps milestone and public-epics invalidation behind the epic resource helper", () => {
    const directEpicResourceOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.(milestones\.byEpic|publicEpics\.all)|\[(["'])?(milestones|public-epics))/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directEpicResourceOperationFiles).toEqual(allowedEpicResourceOperationFiles);
  });

  it("keeps epic template invalidation behind the epic resource helper", () => {
    const directEpicTemplateOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedEpicResourceOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.epics\.templates\(\)|\[(["'])epic-templates\2)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directEpicTemplateOperationFiles).toEqual([]);
  });

  it("keeps epic reward invalidation behind the epic reward cache helper", () => {
    const directEpicRewardOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedEpicRewardOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.epicRewards\.(all|userAll|user\()|\[(["'])(epic-rewards|user-epic-rewards)\2)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directEpicRewardOperationFiles).toEqual([]);
  });

  it("keeps scoped habit query invalidation behind the campaign context helper", () => {
    const directScopedHabitOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: queryKeys\.habits\.(byUser|completions)\(/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directScopedHabitOperationFiles).toEqual(allowedScopedHabitOperationFiles);
  });

  it("keeps contact cache-family operations behind the contact query helper", () => {
    const directContactOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => /queryClient\.(cancelQueries|invalidateQueries|getQueryData|setQueryData)\([^)]*queryKeys\.(contacts|contactInteractions|contactReminders)\./.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directContactOperationFiles).toEqual(allowedContactOperationFiles);
  });

  it("keeps mentor-context queryClient operations behind the mentor context helper", () => {
    const directMentorContextOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedMentorContextOperationFiles[0])
      .filter((filePath) => /queryClient\.(invalidateQueries|refetchQueries)\(\{ queryKey: (queryKeys\.mentor\.(pageDataAll|personalityAll|all|selectedAll|todayPepTalkAll|todayPepTalk\()|\[(["'])(mentor-page-data|mentor-personality|mentor|selected-mentor|today-pep-talk)\2)\s*\}\)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directMentorContextOperationFiles).toEqual([]);
  });

  it("keeps direct profile queryClient operations behind the profile cache helper", () => {
    const directProfileOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedProfileQueryOperationFiles[0])
      .filter((filePath) => /queryClient\.(invalidateQueries|refetchQueries|setQueryData|getQueryData)\((\{ queryKey: queryKeys\.profile\.(all|detail\()|[^)]*queryKeys\.profile\.detail\()/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directProfileOperationFiles).toEqual([]);
  });

  it("keeps subscription and referral-access invalidation behind the profile access helper", () => {
    const directProfileAccessOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedProfileAccessOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.(subscription\.all|subscription\.detail\(|referrals\.(statsAll|stats\(|appliedCodeStateAll|appliedCodeState\(|unlockedSkinsAll|unlockedSkins\(|availableSkins\())|\[(["'])(subscription|referral-stats|applied-referral-code-state|unlocked-skins|available-skins)\4)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directProfileAccessOperationFiles).toEqual([]);
  });

  it("keeps legacy trait invalidation behind the legacy trait helper", () => {
    const directLegacyTraitOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedLegacyTraitOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.currentAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.current(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.inheritableAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.inheritable(",
          "queryClient.invalidateQueries({ queryKey: ['legacy-traits']",
          'queryClient.invalidateQueries({ queryKey: ["legacy-traits"]',
          "queryClient.invalidateQueries({ queryKey: ['inheritable-legacy-traits']",
          'queryClient.invalidateQueries({ queryKey: ["inheritable-legacy-traits"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directLegacyTraitOperationFiles).toEqual([]);
  });

  it("keeps streak-at-risk invalidation behind the streak helper", () => {
    const directStreakOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedStreakOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.streaks.atRiskAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.streaks.atRisk(",
          "queryClient.invalidateQueries({ queryKey: ['streak-at-risk']",
          'queryClient.invalidateQueries({ queryKey: ["streak-at-risk"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directStreakOperationFiles).toEqual([]);
  });

  it("keeps library cache invalidation behind the library helper", () => {
    const directLibraryOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedLibraryOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritesAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favorites(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.downloadsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.downloads(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favoriteQuotesAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favoriteQuotes(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritePepTalksAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritePepTalks(",
          "queryClient.invalidateQueries({ queryKey: ['favorites']",
          'queryClient.invalidateQueries({ queryKey: ["favorites"]',
          "queryClient.invalidateQueries({ queryKey: ['downloads']",
          'queryClient.invalidateQueries({ queryKey: ["downloads"]',
          "queryClient.invalidateQueries({ queryKey: ['favorite-quotes']",
          'queryClient.invalidateQueries({ queryKey: ["favorite-quotes"]',
          "queryClient.invalidateQueries({ queryKey: ['favorite-pep-talks']",
          'queryClient.invalidateQueries({ queryKey: ["favorite-pep-talks"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directLibraryOperationFiles).toEqual([]);
  });

  it("keeps narrative invalidation behind the cosmic library helper", () => {
    const directCosmicLibraryOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedCosmicLibraryOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.narrative.epicAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.narrative.epic(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.narrative.storyCharactersAll",
          "queryClient.invalidateQueries({ queryKey: ['narrative-epic']",
          'queryClient.invalidateQueries({ queryKey: ["narrative-epic"]',
          "queryClient.invalidateQueries({ queryKey: ['story-characters']",
          'queryClient.invalidateQueries({ queryKey: ["story-characters"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directCosmicLibraryOperationFiles).toEqual([]);
  });

  it("keeps admin referral invalidation behind the admin referral helper", () => {
    const directAdminReferralOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedAdminReferralOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.configAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.codesAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.payoutsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.analyticsAll",
          "queryClient.invalidateQueries({ queryKey: ['admin-referral-config']",
          'queryClient.invalidateQueries({ queryKey: ["admin-referral-config"]',
          "queryClient.invalidateQueries({ queryKey: ['admin-referral-codes']",
          'queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"]',
          "queryClient.invalidateQueries({ queryKey: ['admin-referral-payouts']",
          'queryClient.invalidateQueries({ queryKey: ["admin-referral-payouts"]',
          "queryClient.invalidateQueries({ queryKey: ['admin-referral-analytics']",
          'queryClient.invalidateQueries({ queryKey: ["admin-referral-analytics"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directAdminReferralOperationFiles).toEqual([]);
  });

  it("keeps broad companion-context invalidation behind the companion cache helper", () => {
    const directCompanionContextOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedCompanionContextOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.(companion\.(healthAll|careSignalsAll|attributesAll|storyAll|storiesAllRoot|memoriesAll|bondAll|evolutionImageAll|currentEvolutionCardAll)|evolution\.cards\(\)|wallpapers\.all)|\[(["'])(companion-health|companion-care-signals|companion-attributes|companion-story|companion-stories-all|companion-memories|companion-bond|companion-evolution-image|current-evolution-card|evolution-cards|wallpapers)\2)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directCompanionContextOperationFiles).toEqual([]);
  });

  it("keeps companion root, detail, health, and memories invalidate/refetch calls behind the companion cache helper", () => {
    const directCompanionOperationFiles = runtimeBoundaryRoots
      .flatMap(collectRuntimeSourceFiles)
      .filter((filePath) => /queryClient\.(invalidateQueries|refetchQueries)\(\s*\{\s*queryKey:\s*(queryKeys\.companion\.(all|detail\(|healthAll|health\(|memoriesAll|memories\()|getCompanionQueryKey\()/s.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directCompanionOperationFiles).toEqual([]);
  });

  it("keeps companion conversation and postcard invalidation behind the companion conversation helper", () => {
    const directCompanionConversationOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedCompanionConversationOperationFiles.includes(filePath))
      .filter((filePath) => /queryClient\.(invalidateQueries|refetchQueries)\(\s*\{\s*queryKey:\s*(getCompanionChatThreadsQueryKey\(|queryKeys\.companion\.chatHistory\(|getCompanionPostcardsQueryKey\(|queryKeys\.companion\.postcards\()/s.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directCompanionConversationOperationFiles).toEqual([]);
  });

  it("keeps guild cache-family invalidation behind the guild cache helper", () => {
    const directGuildOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedGuildOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.guild\.(titles(All|\(\))|myTitles(All|\()|activity(All|\()|shouts(All|\()|blessingTypes|blessingCharges(All|\()|myBlessings(All|\()|blessingsFeed(All|\()|mutedUsers\()|\[(["'])(guild-titles|my-guild-titles|guild-activity|guild-shouts|blessing-types|blessing-charges|my-blessings|guild-blessings-feed|muted-users)\6)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directGuildOperationFiles).toEqual([]);
  });

  it("keeps guild combat invalidation behind the guild combat cache helper", () => {
    const directGuildCombatOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedGuildCombatOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.guild\.(rivalry(All|\()|boss(All|\()|legends(All|\()|bossDamageLog(All|\())|\[(["'])(guild-rivalry|guild-boss|guild-legends|boss-damage-log)\5)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directGuildCombatOperationFiles).toEqual([]);
  });

  it("keeps activity-feed invalidation behind the activity-feed cache helper", () => {
    const directActivityFeedOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedActivityFeedOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.activityFeed\.(all|byUser\()|\[(["'])activity-feed\2)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directActivityFeedOperationFiles).toEqual([]);
  });

  it("keeps community invalidation behind the community cache helper", () => {
    const directCommunityOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedCommunityOperationFiles[0])
      .filter((filePath) => /queryClient\.invalidateQueries\(\{ queryKey: (queryKeys\.(communities\.all|community\.(detail\(|membersAll|members\())|\[(["'])(communities|community|community-members)\2)/.test(
        fs.readFileSync(filePath, "utf8"),
      ))
      .sort();

    expect(directCommunityOperationFiles).toEqual([]);
  });

  it("keeps daily mission invalidation behind the daily mission cache helper", () => {
    const directDailyMissionOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedDailyMissionOperationFiles[0])
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissions.all",
          "queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissions.byDate(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissionPulse.all",
          "queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissionPulse.byDate(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.morningBriefing.all",
          "queryClient.invalidateQueries({ queryKey: queryKeys.morningBriefing.byDate(",
          "queryClient.invalidateQueries({ queryKey: ['daily-missions']",
          'queryClient.invalidateQueries({ queryKey: ["daily-missions"]',
          "queryClient.invalidateQueries({ queryKey: ['daily-mission-pulse']",
          'queryClient.invalidateQueries({ queryKey: ["daily-mission-pulse"]',
          "queryClient.invalidateQueries({ queryKey: ['morning-briefing']",
          'queryClient.invalidateQueries({ queryKey: ["morning-briefing"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directDailyMissionOperationFiles).toEqual([]);
  });

  it("keeps weekly recap invalidation behind the weekly recap helper", () => {
    const directWeeklyRecapOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedWeeklyRecapOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.currentAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.current(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.historyAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.history(",
          "queryClient.invalidateQueries({ queryKey: ['weekly-recap']",
          'queryClient.invalidateQueries({ queryKey: ["weekly-recap"]',
          "queryClient.invalidateQueries({ queryKey: ['weekly-recaps-all']",
          'queryClient.invalidateQueries({ queryKey: ["weekly-recaps-all"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directWeeklyRecapOperationFiles).toEqual([]);
  });

  it("keeps recurring template cache operations behind the recurring template helper", () => {
    const directRecurringTemplateOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedRecurringTemplateOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.recurringTemplates.all",
          "queryClient.invalidateQueries({ queryKey: queryKeys.recurringTemplates.pending(",
          "queryClient.setQueryData(queryKeys.recurringTemplates.pending(",
          "queryClient.invalidateQueries({ queryKey: ['recurring-templates']",
          'queryClient.invalidateQueries({ queryKey: ["recurring-templates"]',
          "queryClient.setQueryData(['recurring-templates'",
          'queryClient.setQueryData(["recurring-templates"',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directRecurringTemplateOperationFiles).toEqual([]);
  });

  it("keeps daily reflection invalidation behind the approved cache helpers", () => {
    const directDailyReflectionOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedDailyReflectionOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningByDate(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningLatestAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningLatest(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.eveningAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.evening(",
          "queryClient.invalidateQueries({ queryKey: ['morning-check-in']",
          'queryClient.invalidateQueries({ queryKey: ["morning-check-in"]',
          "queryClient.invalidateQueries({ queryKey: ['morning-check-in-latest']",
          'queryClient.invalidateQueries({ queryKey: ["morning-check-in-latest"]',
          "queryClient.invalidateQueries({ queryKey: ['evening-reflection']",
          'queryClient.invalidateQueries({ queryKey: ["evening-reflection"]',
          "queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_QUERY_KEY",
          "queryClient.refetchQueries({ queryKey: JOURNAL_ENTRIES_QUERY_KEY",
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directDailyReflectionOperationFiles).toEqual([]);
  });

  it("keeps calendar integration invalidation behind the calendar integration helper", () => {
    const directCalendarIntegrationOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedCalendarIntegrationOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.settingsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.settings(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.connectionsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.connections(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.questLinksAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.questLinks(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.outlookTaskLinksAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.outlookTaskLinks(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.externalEventsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.calendar.externalEvents(",
          "queryClient.invalidateQueries({ queryKey: ['calendar-user-settings']",
          'queryClient.invalidateQueries({ queryKey: ["calendar-user-settings"]',
          "queryClient.invalidateQueries({ queryKey: ['calendar-connections']",
          'queryClient.invalidateQueries({ queryKey: ["calendar-connections"]',
          "queryClient.invalidateQueries({ queryKey: ['quest-calendar-links']",
          'queryClient.invalidateQueries({ queryKey: ["quest-calendar-links"]',
          "queryClient.invalidateQueries({ queryKey: ['quest-outlook-task-links']",
          'queryClient.invalidateQueries({ queryKey: ["quest-outlook-task-links"]',
          "queryClient.invalidateQueries({ queryKey: ['external-calendar-events']",
          'queryClient.invalidateQueries({ queryKey: ["external-calendar-events"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directCalendarIntegrationOperationFiles).toEqual([]);
  });

  it("keeps quest autocomplete invalidation behind the quest autocomplete helper", () => {
    const directQuestAutocompleteOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => !allowedQuestAutocompleteOperationFiles.includes(filePath))
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.taskHistoryAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.taskHistory(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.habitsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.habits(",
          "queryClient.invalidateQueries({ queryKey: ['quest-autocomplete-tasks']",
          'queryClient.invalidateQueries({ queryKey: ["quest-autocomplete-tasks"]',
          "queryClient.invalidateQueries({ queryKey: ['quest-autocomplete-habits']",
          'queryClient.invalidateQueries({ queryKey: ["quest-autocomplete-habits"]',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directQuestAutocompleteOperationFiles).toEqual([]);
  });

  it("keeps astral and resist cache operations behind the astral/resist helper", () => {
    const directAstralResistOperationFiles = collectRuntimeSourceFiles(srcRoot)
      .filter((filePath) => filePath !== allowedAstralResistOperationFiles[0])
      .filter((filePath) => {
        const source = fs.readFileSync(filePath, "utf8");
        return [
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.encountersAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.encounters(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.essencesAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.essences(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.codexAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.codex(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.xpTodayAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.astral.xpToday(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.resist.badHabitsAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.resist.badHabits(",
          "queryClient.invalidateQueries({ queryKey: queryKeys.resist.logAll",
          "queryClient.invalidateQueries({ queryKey: queryKeys.resist.log(",
          "queryClient.setQueryData(queryKeys.resist.badHabits(",
          "queryClient.invalidateQueries({ queryKey: ['astral-encounters']",
          'queryClient.invalidateQueries({ queryKey: ["astral-encounters"]',
          "queryClient.invalidateQueries({ queryKey: ['adversary-essences']",
          'queryClient.invalidateQueries({ queryKey: ["adversary-essences"]',
          "queryClient.invalidateQueries({ queryKey: ['cosmic-codex']",
          'queryClient.invalidateQueries({ queryKey: ["cosmic-codex"]',
          "queryClient.invalidateQueries({ queryKey: ['astral-encounter-xp-today']",
          'queryClient.invalidateQueries({ queryKey: ["astral-encounter-xp-today"]',
          "queryClient.invalidateQueries({ queryKey: ['bad-habits']",
          'queryClient.invalidateQueries({ queryKey: ["bad-habits"]',
          "queryClient.invalidateQueries({ queryKey: ['resist-log']",
          'queryClient.invalidateQueries({ queryKey: ["resist-log"]',
          "queryClient.setQueryData(['bad-habits'",
          'queryClient.setQueryData(["bad-habits"',
        ].some((pattern) => source.includes(pattern));
      })
      .sort();

    expect(directAstralResistOperationFiles).toEqual([]);
  });
});
