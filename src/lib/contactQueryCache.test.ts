import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  cancelContactsByUserQuery,
  invalidateContactInteractionsQuery,
  invalidateContactRemindersQueries,
  invalidateContactsQueryFamily,
  restoreContactsByUserQuery,
  setContactsByUserQueryData,
  snapshotContactsByUserQuery,
} from "@/lib/contactQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("contactQueryCache", () => {
  it("invalidates contact root and scoped user queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateContactsQueryFamily(queryClient, {
      userId: "user-123",
      includeByUser: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contacts.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contacts.byUser("user-123"),
    });
  });

  it("cancels the user-scoped contacts query", async () => {
    const queryClient = new QueryClient();
    const cancelSpy = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue();

    await cancelContactsByUserQuery(queryClient, "user-123");

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contacts.byUser("user-123"),
    });
  });

  it("invalidates the interaction history for a specific contact", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateContactInteractionsQuery(queryClient, "contact-123");

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contactInteractions.byContact("contact-123"),
    });
  });

  it("invalidates contact reminders and the upcoming reminder feed", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateContactRemindersQueries(queryClient, {
      contactId: "contact-123",
      includeUpcoming: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contactReminders.byContact("contact-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.contactReminders.upcoming(),
    });
  });

  it("snapshots, updates, and restores the user-scoped contacts query", () => {
    const queryClient = new QueryClient();
    const key = queryKeys.contacts.byUser("user-123");
    queryClient.setQueryData(key, [
      { id: "contact-1", is_favorite: false },
      { id: "contact-2", is_favorite: false },
    ]);

    const previous = snapshotContactsByUserQuery<Array<{ id: string; is_favorite: boolean }>>(
      queryClient,
      "user-123",
    );

    setContactsByUserQueryData<Array<{ id: string; is_favorite: boolean }>>(
      queryClient,
      "user-123",
      (current) => current?.map((contact) =>
        contact.id === "contact-1"
          ? { ...contact, is_favorite: true }
          : contact,
      ),
    );

    expect(queryClient.getQueryData(key)).toEqual([
      { id: "contact-1", is_favorite: true },
      { id: "contact-2", is_favorite: false },
    ]);

    restoreContactsByUserQuery(queryClient, "user-123", previous);

    expect(queryClient.getQueryData(key)).toEqual([
      { id: "contact-1", is_favorite: false },
      { id: "contact-2", is_favorite: false },
    ]);
  });
});
