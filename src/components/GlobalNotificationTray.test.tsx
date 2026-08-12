import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalNotificationTray } from "@/components/GlobalNotificationTray";

const hookMocks = vi.hoisted(() => ({
  markOpened: vi.fn().mockResolvedValue(undefined),
  markAllRead: vi.fn().mockResolvedValue(undefined),
  item: {
    id: "queue-1",
    type: "task_reminder",
    sourceLabel: "Quest reminder",
    title: "Quest soon",
    body: "Start the thing.",
    deliveredAt: "2026-05-07T12:00:00.000Z",
    readAt: null,
    openedAt: null,
    destinationPath: "/journeys?taskId=task-1",
  },
  state: {
    items: [] as Array<{
      id: string;
      type: string;
      sourceLabel: string;
      title: string;
      body: string;
      deliveredAt: string;
      readAt: string | null;
      openedAt: string | null;
      destinationPath: string;
    }>,
    unreadCount: 1,
    remainingTodayCount: 1,
    isLoading: false,
    isError: false,
    isMarkingAllRead: false,
  },
}));

vi.mock("@/hooks/usePushNotificationsInbox", () => ({
  usePushNotificationsInbox: () => ({
    ...hookMocks.state,
    markOpened: hookMocks.markOpened,
    markAllRead: hookMocks.markAllRead,
    markRead: vi.fn(),
    invalidateNotifications: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDailyTaskBadgeSync", () => ({
  useRemainingTodayBadgeCount: () => ({
    count: hookMocks.state.remainingTodayCount,
    hasCanonicalCount: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderTray = () => render(
  <MemoryRouter initialEntries={["/mentor"]}>
    <GlobalNotificationTray />
    <Routes>
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  </MemoryRouter>,
);

describe("GlobalNotificationTray", () => {
  beforeEach(() => {
    hookMocks.markOpened.mockClear();
    hookMocks.markAllRead.mockClear();
    hookMocks.state.items = [{ ...hookMocks.item }];
    hookMocks.state.unreadCount = 1;
    hookMocks.state.remainingTodayCount = 1;
    hookMocks.state.isLoading = false;
    hookMocks.state.isError = false;
    hookMocks.state.isMarkingAllRead = false;
  });

  it("shows unread count and opens notification destinations", async () => {
    renderTray();

    fireEvent.click(screen.getByRole("button", { name: /open notifications, 1 remaining today/i }));
    expect(screen.getByText("Quest reminder")).toBeInTheDocument();
    expect(screen.getByText("Quest soon")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
    expect(screen.getByText("Remaining today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /quest reminder/i }));

    await waitFor(() => {
      expect(hookMocks.markOpened).toHaveBeenCalledWith("queue-1");
      expect(screen.getByTestId("location")).toHaveTextContent("/journeys?taskId=task-1");
    });
  });

  it("marks all notifications read from the header action", async () => {
    renderTray();

    fireEvent.click(screen.getByRole("button", { name: /open notifications, 1 remaining today/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark all notifications read/i }));

    await waitFor(() => {
      expect(hookMocks.markAllRead).toHaveBeenCalled();
    });
  });

  it("opens today's remaining work when there are no inbox notifications", async () => {
    hookMocks.state.items = [];
    hookMocks.state.unreadCount = 0;
    hookMocks.state.remainingTodayCount = 2;

    renderTray();

    fireEvent.click(screen.getByRole("button", { name: /open notifications, 2 remaining today/i }));
    expect(screen.getByText("No notifications")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open remaining today, 2 remaining/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/mentor");
    });
  });
});
