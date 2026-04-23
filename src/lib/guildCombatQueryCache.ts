import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type GuildRivalryScope = "epic" | "community";

type GuildRivalryQueryOptions = {
  scopeType: GuildRivalryScope;
  scopeId?: string;
  userId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

type GuildBossQueryOptions = {
  epicId?: string;
  communityId?: string;
  includeBossAll?: boolean;
  includeBossDetail?: boolean;
  includeLegendsAll?: boolean;
  includeLegendsDetail?: boolean;
  includeDamageLogAll?: boolean;
  includeDamageLogDetail?: boolean;
  encounterId?: string;
};

export const invalidateGuildRivalryQueries = async (
  queryClient: QueryClient,
  {
    scopeType,
    scopeId,
    userId,
    includeAll = false,
    includeDetail = false,
  }: GuildRivalryQueryOptions,
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.rivalryAll })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.rivalry(scopeType, scopeId, userId) })]
      : []),
  ]);
};

export const invalidateGuildBossQueries = async (
  queryClient: QueryClient,
  {
    epicId,
    communityId,
    includeBossAll = false,
    includeBossDetail = false,
    includeLegendsAll = false,
    includeLegendsDetail = false,
    includeDamageLogAll = false,
    includeDamageLogDetail = false,
    encounterId,
  }: GuildBossQueryOptions = {},
) => {
  await Promise.all([
    ...(includeBossAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.bossAll })]
      : []),
    ...(includeBossDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.boss(epicId, communityId) })]
      : []),
    ...(includeLegendsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.legendsAll })]
      : []),
    ...(includeLegendsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.legends(epicId, communityId) })]
      : []),
    ...(includeDamageLogAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.bossDamageLogAll })]
      : []),
    ...(includeDamageLogDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.guild.bossDamageLog(encounterId) })]
      : []),
  ]);
};
