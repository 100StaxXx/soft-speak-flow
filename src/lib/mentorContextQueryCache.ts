import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type MentorContextQueryOptions = {
  includeMentorPageData?: boolean;
  includeMentorPersonality?: boolean;
  includeMentor?: boolean;
  includeSelectedMentor?: boolean;
  includeMorningCheckIn?: boolean;
  includeTodayPepTalk?: boolean;
  includeStreakFreezes?: boolean;
};

type QueryFilter = Parameters<QueryClient["invalidateQueries"]>[0];

const buildMentorContextQueryKeys = ({
  includeMentorPageData = true,
  includeMentorPersonality = true,
  includeMentor = true,
  includeSelectedMentor = true,
  includeMorningCheckIn = false,
  includeTodayPepTalk = false,
  includeStreakFreezes = false,
}: MentorContextQueryOptions = {}): QueryFilter[] => [
  ...(includeMentorPageData ? [{ queryKey: queryKeys.mentor.pageDataAll }] : []),
  ...(includeMentorPersonality ? [{ queryKey: queryKeys.mentor.personalityAll }] : []),
  ...(includeMentor ? [{ queryKey: queryKeys.mentor.all }] : []),
  ...(includeSelectedMentor ? [{ queryKey: queryKeys.mentor.selectedAll }] : []),
  ...(includeMorningCheckIn ? [{ queryKey: queryKeys.checkIns.morningAll }] : []),
  ...(includeTodayPepTalk ? [{ queryKey: queryKeys.mentor.todayPepTalkAll }] : []),
  ...(includeStreakFreezes ? [{ queryKey: queryKeys.streaks.freezesAll }] : []),
];

const runQueryFilters = async (
  queryClient: QueryClient,
  queryFilters: QueryFilter[],
  operation: "invalidateQueries" | "refetchQueries",
) => {
  await Promise.all(
    queryFilters.map((queryFilter) => queryClient[operation](queryFilter)),
  );
};

export const invalidateMentorContextQueries = async (
  queryClient: QueryClient,
  options: MentorContextQueryOptions = {},
) => {
  await runQueryFilters(
    queryClient,
    buildMentorContextQueryKeys(options),
    "invalidateQueries",
  );
};

export const refetchMentorContextQueries = async (
  queryClient: QueryClient,
  options: MentorContextQueryOptions = {},
) => {
  await runQueryFilters(
    queryClient,
    buildMentorContextQueryKeys(options),
    "refetchQueries",
  );
};

export const invalidateTodayPepTalkQueries = async (
  queryClient: QueryClient,
  {
    mentorId,
    pepTalkDate,
    includeAll = false,
    includeDetail = false,
  }: {
    mentorId?: string | null;
    pepTalkDate?: string;
    includeAll?: boolean;
    includeDetail?: boolean;
  } = {},
) => {
  await runQueryFilters(
    queryClient,
    [
      ...(includeAll
        ? [{ queryKey: queryKeys.mentor.todayPepTalkAll, exact: true }]
        : []),
      ...(includeDetail
        ? [{ queryKey: queryKeys.mentor.todayPepTalk(mentorId, pepTalkDate), exact: true }]
        : []),
    ],
    "invalidateQueries",
  );
};

export const refetchTodayPepTalkQueries = async (
  queryClient: QueryClient,
  {
    mentorId,
    pepTalkDate,
    includeAll = false,
    includeDetail = false,
  }: {
    mentorId?: string | null;
    pepTalkDate?: string;
    includeAll?: boolean;
    includeDetail?: boolean;
  } = {},
) => {
  await runQueryFilters(
    queryClient,
    [
      ...(includeAll
        ? [{ queryKey: queryKeys.mentor.todayPepTalkAll, exact: true }]
        : []),
      ...(includeDetail
        ? [{ queryKey: queryKeys.mentor.todayPepTalk(mentorId, pepTalkDate), exact: true }]
        : []),
    ],
    "refetchQueries",
  );
};
