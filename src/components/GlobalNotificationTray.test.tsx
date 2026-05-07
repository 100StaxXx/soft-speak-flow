import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalNotificationTray } from "@/components/GlobalNotificationTray";

const hookMocks = vi.hoisted(() => ({
  markOpened: vi.fn().mockResolvedValue(undefined),
  markAllRead: vi.fn().mockResolvedValue(undefined),
  state: {
    items: [
      {
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
    ],
    unreadCount: 1,
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
  });

  it("shows unread count and opens notification destinations", async () => {
    renderTray();

    fireEvent.click(screen.getByRole("button", { name: /open notifications, 1 unread/i }));
    expect(screen.getByText("Quest reminder")).toBeInTheDocument();
    expect(screen.getByText("Quest soon")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /quest reminder/i }));

    await waitFor(() => {
      expect(hookMocks.markOpened).toHaveBeenCalledWith("queue-1");
      expect(screen.getByTestId("location")).toHaveTextContent("/journeys?taskId=task-1");
    });
  });

  it("marks all notifications read from the header action", async () => {
    renderTray();

    fireEvent.click(screen.getByRole("button", { name: /open notifications, 1 unread/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark all notifications read/i }));

    await waitFor(() => {
      expect(hookMocks.markAllRead).toHaveBeenCalled();
    });
  });
});
