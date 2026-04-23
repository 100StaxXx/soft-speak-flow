import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type MentorContextQueryOptions = {
  mentorId?: string | null;
  pepTalkDate?: string;
  includeMentorPageData?: boolean;
  includeMentorPersonality?: boolean;
  includeMentor?: boolean;
  includeSelectedMentor?: boolean;
  includeMorningCheckIn?: boolean;
  includeTodayPepTalk?: boolean;
  includeStreakFreezes?: boolean;
};

const buildMentorContextQueryKeys = ({
  mentorId,
  pepTalkDate,
  includeMentorPageData = true,
  includeMentorPersonality = true,
  includeMentor = true,
  includeSelectedMentor = true,
  includeMorningCheckIn = false,
  includeTodayPepTalk = false,
  includeStreakFreezes = false,
}: MentorContextQueryOptions = {}) => [
  ...(includeMentorPageData ? [queryKeys.mentor.pageDataAll] : []),
  ...(includeMentorPersonality ? [queryKeys.mentor.personalityAll] : []),
  ...(includeMentor ? [queryKeys.mentor.all] : []),
  ...(includeSelectedMentor ? [queryKeys.mentor.selectedAll] : []),
  ...(includeMorningCheckIn ? [queryKeys.checkIns.morningAll] : []),
  ...(includeTodayPepTalk ? [queryKeys.mentor.todayPepTalkAll] : []),
  ...(includeStreakFreezes ? [queryKeys.streaks.freezesAll] : []),
  ...((mentorId || pepTalkDate)
    ? [queryKeys.mentor.todayPepTalk(mentorId, pepTalkDate)]
    : []),
];

export const invalidateMentorContextQueries = async (
  queryClient: QueryClient,
  options: MentorContextQueryOptions = {},
) => {
  const queryKeys = buildMentorContextQueryKeys(options);
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
};

export const refetchMentorContextQueries = async (
  queryClient: QueryClient,
  options: MentorContextQueryOptions = {},
) => {
  const queryKeys = buildMentorContextQueryKeys(options);
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey })),
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
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.mentor.todayPepTalkAll })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.mentor.todayPepTalk(mentorId, pepTalkDate) })]
      : []),
  ]);
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
  await Promise.all([
    ...(includeAll
      ? [queryClient.refetchQueries({ queryKey: queryKeys.mentor.todayPepTalkAll })]
      : []),
    ...(includeDetail
      ? [queryClient.refetchQueries({ queryKey: queryKeys.mentor.todayPepTalk(mentorId, pepTalkDate) })]
      : []),
  ]);
};
