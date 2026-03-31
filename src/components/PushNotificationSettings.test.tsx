import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const queueLimitMock = vi.fn();
  const queueOrderMock = vi.fn(() => ({ limit: queueLimitMock }));
  const queueEqMock = vi.fn(() => ({ order: queueOrderMock }));
  const queueSelectMock = vi.fn(() => ({ eq: queueEqMock }));

  const profileMaybeSingleMock = vi.fn();
  const profileEqMock = vi.fn(() => ({ maybeSingle: profileMaybeSingleMock }));
  const profileSelectMock = vi.fn(() => ({ eq: profileEqMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === "push_notification_queue") {
      return { select: queueSelectMock };
    }

    if (table === "profiles") {
      return { select: profileSelectMock };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    profile: {
      daily_push_enabled: false,
      daily_quote_push_enabled: false,
      habit_reminders_enabled: true,
      task_reminders_enabled: true,
      checkin_reminders_enabled: true,
      timezone: "America/Los_Angeles",
      daily_push_time: "08:00",
      daily_quote_push_time: "07:00",
    },
    user: { id: "user-1" },
    toast: vi.fn(),
    isNativePushSupported: vi.fn(() => true),
    hasActiveNativePushSubscription: vi.fn(() => Promise.resolve(true)),
    debugTestRegistration: vi.fn(() => Promise.resolve({
      platform: "ios",
      isNative: true,
      isSupported: true,
      permissionStatus: "granted",
    })),
    getNativePushTokenDebugSnapshot: vi.fn(() => Promise.resolve({
      tokenCount: 2,
      latestUpdatedAt: "2026-03-31T18:00:00.000Z",
      latestTokenPreview: "abcd1234...wxyz",
    })),
    initializeNativePush: vi.fn(() => Promise.resolve()),
    unregisterNativePush: vi.fn(() => Promise.resolve()),
    fromMock,
    queueLimitMock,
    profileMaybeSingleMock,
  };
});

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: mocks.profile }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/utils/nativePushNotifications", () => ({
  isNativePushSupported: mocks.isNativePushSupported,
  hasActiveNativePushSubscription: mocks.hasActiveNativePushSubscription,
  debugTestRegistration: mocks.debugTestRegistration,
  getNativePushTokenDebugSnapshot: mocks.getNativePushTokenDebugSnapshot,
  initializeNativePush: mocks.initializeNativePush,
  unregisterNativePush: mocks.unregisterNativePush,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

import { PushNotificationSettings } from "./PushNotificationSettings";

describe("PushNotificationSettings debug panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-31T20:00:00.000Z").getTime());

    mocks.queueLimitMock.mockResolvedValue({
      data: [
        {
          id: "queue-1",
          notification_type: "task_reminder",
          status: "skipped_budget",
          scheduled_for: "2026-03-31T18:30:00.000Z",
          delivered_at: "2026-03-31T18:31:00.000Z",
          last_error: "spacing_guard",
        },
        {
          id: "queue-2",
          notification_type: "habit_reminder",
          status: "failed_terminal",
          scheduled_for: "2026-03-31T19:00:00.000Z",
          delivered_at: "2026-03-31T19:01:00.000Z",
          last_error: "no_device_tokens",
        },
      ],
      error: null,
    });
    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: { timezone: "America/Los_Angeles" },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows timezone, token freshness, and recent queue diagnostics", async () => {
    render(<PushNotificationSettings />);

    fireEvent.click(screen.getByRole("button", { name: /Debug Push Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText("Profile Timezone:")).toBeInTheDocument();
    });

    expect(screen.getAllByText("America/Los_Angeles").length).toBeGreaterThan(0);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("Recent skipped_budget")).toBeInTheDocument();
    expect(screen.getByText("Recent failed_terminal")).toBeInTheDocument();
    expect(screen.getByText("Recent no_device_tokens")).toBeInTheDocument();
    expect(screen.getByText("Reason: no_device_tokens")).toBeInTheDocument();
    expect(screen.getByText("task_reminder")).toBeInTheDocument();
    expect(screen.getByText("habit_reminder")).toBeInTheDocument();
  });
});
