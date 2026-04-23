import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

export const invalidateContactsQueryFamily = async (
  queryClient: QueryClient,
  options: {
    userId?: string;
    includeByUser?: boolean;
  } = {},
) => {
  const { userId, includeByUser = false } = options;

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
    ...(includeByUser
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.contacts.byUser(userId ?? "") })]
      : []),
  ]);
};

export const cancelContactsByUserQuery = async (
  queryClient: QueryClient,
  userId: string | undefined,
) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.contacts.byUser(userId ?? "") });
};

export const snapshotContactsByUserQuery = <T>(
  queryClient: QueryClient,
  userId: string | undefined,
) => queryClient.getQueryData<T>(queryKeys.contacts.byUser(userId ?? ""));

export const setContactsByUserQueryData = <T>(
  queryClient: QueryClient,
  userId: string | undefined,
  updater: (current: T | undefined) => T | undefined,
) => {
  queryClient.setQueryData<T>(queryKeys.contacts.byUser(userId ?? ""), updater);
};

export const restoreContactsByUserQuery = <T>(
  queryClient: QueryClient,
  userId: string | undefined,
  previous: T | undefined,
) => {
  queryClient.setQueryData(queryKeys.contacts.byUser(userId ?? ""), previous);
};

export const invalidateContactInteractionsQuery = async (
  queryClient: QueryClient,
  contactId: string,
) => {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.contactInteractions.byContact(contactId),
  });
};

export const invalidateContactRemindersQueries = async (
  queryClient: QueryClient,
  options: {
    contactId?: string;
    includeUpcoming?: boolean;
  } = {},
) => {
  const { contactId, includeUpcoming = false } = options;

  await Promise.all([
    ...(contactId
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.byContact(contactId) })]
      : []),
    ...(includeUpcoming
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.upcoming() })]
      : []),
  ]);
};
