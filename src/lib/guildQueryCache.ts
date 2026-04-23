import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type GuildShoutScope = "epic" | "community";

type GuildTitleQueryOptions = {
  userId?: string;
  epicId?: string;
  communityId?: string;
  includeTitlesAll?: boolean;
  includeTitlesDetail?: boolean;
  includeMyTitlesAll?: boolean;
  includeMyTitlesDetail?: boolean;
};

type GuildActivityQueryOptions = {
  epicId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

type GuildShoutQueryOptions = {
  scopeType: GuildShoutScope;
  scopeId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

type GuildBlessingQueryOptions = {
  userId?: string;
  epicId?: string;
  communityId?: string;
  includeTypes?: boolean;
  includeChargesAll?: boolean;
  includeChargesDetail?: boolean;
  includeMyBlessingsAll?: boolean;
  includeMyBlessingsDetail?: boolean;
  includeFeedAll?: boolean;
  includeFeedDetail?: boolean;
};

type GuildMutedUserQueryOptions = {
  userId?: string;
  epicId?: string;
  includeDetail?: boolean;
};

export const invalidateGuildActivityQueries = async (
  queryClient: QueryClient,
  {
    epicId,
    includeAll = false,
    includeDetail = false,
  }: GuildActivityQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.activityAll })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.activity(epicId) })]
      : []),
  ]);
};

export const invalidateGuildTitleQueries = async (
  queryClient: QueryClient,
  {
    userId,
    epicId,
    communityId,
    includeTitlesAll = false,
    includeTitlesDetail = false,
    includeMyTitlesAll = false,
    includeMyTitlesDetail = false,
  }: GuildTitleQueryOptions = {},
) => {
  await Promise.all([
    ...(includeTitlesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.titlesAll })]
      : []),
    ...(includeTitlesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.titles() })]
      : []),
    ...(includeMyTitlesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.myTitlesAll })]
      : []),
    ...(includeMyTitlesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.myTitles(userId, epicId, communityId) })]
      : []),
  ]);
};

export const invalidateGuildShoutQueries = async (
  queryClient: QueryClient,
  {
    scopeType,
    scopeId,
    includeAll = false,
    includeDetail = false,
  }: GuildShoutQueryOptions,
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.shoutsAll })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.shouts(scopeType, scopeId) })]
      : []),
  ]);
};

export const invalidateGuildBlessingQueries = async (
  queryClient: QueryClient,
  {
    userId,
    epicId,
    communityId,
    includeTypes = false,
    includeChargesAll = false,
    includeChargesDetail = false,
    includeMyBlessingsAll = false,
    includeMyBlessingsDetail = false,
    includeFeedAll = false,
    includeFeedDetail = false,
  }: GuildBlessingQueryOptions = {},
) => {
  await Promise.all([
    ...(includeTypes
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.blessingTypes })]
      : []),
    ...(includeChargesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.blessingChargesAll })]
      : []),
    ...(includeChargesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.blessingCharges(userId) })]
      : []),
    ...(includeMyBlessingsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.myBlessingsAll })]
      : []),
    ...(includeMyBlessingsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.myBlessings(userId, epicId, communityId) })]
      : []),
    ...(includeFeedAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.blessingsFeedAll })]
      : []),
    ...(includeFeedDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.blessingsFeed(epicId, communityId) })]
      : []),
  ]);
};

export const invalidateGuildMutedUserQueries = async (
  queryClient: QueryClient,
  {
    userId,
    epicId,
    includeDetail = false,
  }: GuildMutedUserQueryOptions = {},
) => {
  await Promise.all([
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.mutedUsers(userId, epicId) })]
      : []),
  ]);
};
