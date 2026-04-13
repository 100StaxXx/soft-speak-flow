import { createContext, useContext, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SelectContext = createContext<{
  onValueChange?: (value: string) => void;
  value?: string;
}>({});

const mocks = vi.hoisted(() => {
  const defaultProfile = {
    daily_push_enabled: false,
    daily_quote_push_enabled: false,
    habit_reminders_enabled: true,
    task_reminders_enabled: true,
    checkin_reminders_enabled: true,
    timezone: "America/Los_Angeles",
    daily_push_time: "08:00",
    daily_quote_push_time: "07:00",
  };
  const queueLimitMock = vi.fn();
  const queueOrderMock = vi.fn(() => ({ limit: queueLimitMock }));
  const queueEqMock = vi.fn(() => ({ order: queueOrderMock }));
  const queueSelectMock = vi.fn(() => ({ eq: queueEqMock }));

  const profileMaybeSingleMock = vi.fn();
  const profileEqMock = vi.fn(() => ({ maybeSingle: profileMaybeSingleMock }));
  const profileSelectMock = vi.fn(() => ({ eq: profileEqMock }));
  const profileUpdateEqMock = vi.fn();
  const profileUpdateMock = vi.fn(() => ({ eq: profileUpdateEqMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === "push_notification_queue") {
      return { select: queueSelectMock };
    }

    if (table === "profiles") {
      return { select: profileSelectMock, update: profileUpdateMock };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    defaultProfile,
    profile: { ...defaultProfile },
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
      installationCount: 1,
      legacyTokenCount: 1,
      latestUpdatedAt: "2026-03-31T18:00:00.000Z",
      latestTokenPreview: "abcd1234...wxyz",
      currentInstallationIdPreview: "install-a...1234",
    })),
    waitForNativePushToken: vi.fn(() => Promise.resolve(true)),
    initializeNativePush: vi.fn(() => Promise.resolve()),
    unregisterNativePush: vi.fn(() => Promise.resolve()),
    fromMock,
    queueLimitMock,
    profileMaybeSingleMock,
    profileUpdateEqMock,
    profileUpdateMock,
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div>{children}</div>
    </SelectContext.Provider>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button role="combobox">{children}</button>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
    const ctx = useContext(SelectContext);
    return (
      <button role="option" onClick={() => ctx.onValueChange?.(value)}>
        {children}
      </button>
    );
  },
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder || ""}</span>
  ),
}));

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
  waitForNativePushToken: mocks.waitForNativePushToken,
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
  const renderWithClient = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(["profile", mocks.user.id], mocks.profile);

    render(
      <QueryClientProvider client={queryClient}>
        <PushNotificationSettings />
      </QueryClientProvider>,
    );

    return { queryClient };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-31T20:00:00.000Z").getTime());
    mocks.profile = { ...mocks.defaultProfile };

    mocks.queueLimitMock.mockResolvedValue({
      data: [
        {
          id: "queue-1",
          notification_type: "task_reminder",
          status: "skipped_budget",
          scheduled_for: "2026-03-31T18:30:00.000Z",
          delivered_at: "2026-03-31T18:31:00.000Z",
          last_error: "spacing_guard",
          dedupe_key: "task_reminder:task-1:15",
          payload: {
            task_id: "task-1",
            reminder_minutes_before: 15,
          },
          source_table: "daily_tasks",
        },
        {
          id: "queue-2",
          notification_type: "habit_reminder",
          status: "failed_terminal",
          scheduled_for: "2026-03-31T19:00:00.000Z",
          delivered_at: "2026-03-31T19:01:00.000Z",
          last_error: "no_device_tokens",
          dedupe_key: "habit_reminder:habit-1:2026-03-31",
          payload: {
            habit_id: "habit-1",
            local_date: "2026-03-31",
          },
          source_table: "habits",
        },
        {
          id: "queue-3",
          notification_type: "daily_pep",
          status: "sent",
          scheduled_for: "2026-03-31T19:05:00.000Z",
          delivered_at: "2026-03-31T19:06:00.000Z",
          last_error: null,
          dedupe_key: "legacy:queue-3",
          payload: {
            pep_talk_id: "pep-1",
          },
          source_table: "user_daily_pushes",
        },
        {
          id: "queue-4",
          notification_type: "daily_pep",
          status: "sent",
          scheduled_for: "2026-03-31T19:07:00.000Z",
          delivered_at: "2026-03-31T19:08:00.000Z",
          last_error: null,
          dedupe_key: "legacy:queue-4",
          payload: {
            pep_talk_id: "pep-1",
          },
          source_table: "user_daily_pushes",
        },
      ],
      error: null,
    });
    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: { timezone: "America/Los_Angeles" },
      error: null,
    });
    mocks.profileUpdateEqMock.mockResolvedValue({
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows timezone, token freshness, and recent queue diagnostics", async () => {
    renderWithClient();

    expect(screen.getByText("Mobile Push Notifications")).toBeInTheDocument();
    expect(screen.getByText("Mobile Push Access")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Debug Push Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText("Profile Timezone:")).toBeInTheDocument();
    });

    expect(screen.getAllByText("America/Los_Angeles").length).toBeGreaterThan(0);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("Recent skipped_budget")).toBeInTheDocument();
    expect(screen.getByText("Recent failed_terminal")).toBeInTheDocument();
    expect(screen.getByText("Recent no_device_tokens")).toBeInTheDocument();
    expect(screen.getByText("Multiple iOS token rows")).toBeInTheDocument();
    expect(screen.getByText("Legacy token rows")).toBeInTheDocument();
    expect(screen.getByText("Repeated logical notifications")).toBeInTheDocument();
    expect(screen.getByText(/Potential duplicate risk detected/i)).toBeInTheDocument();
    expect(screen.getByText("Recent Quest Queue Rows")).toBeInTheDocument();
    expect(screen.getByText("Reason: no_device_tokens")).toBeInTheDocument();
    expect(screen.getAllByText("task_reminder").length).toBeGreaterThan(0);
    expect(screen.getByText("habit_reminder")).toBeInTheDocument();
  });

  it("shows a recovery clue when quest reminders are enabled but no device token is registered", async () => {
    mocks.hasActiveNativePushSubscription.mockResolvedValue(false);

    renderWithClient();

    await waitFor(() => {
      expect(screen.getByText(/Quest reminders are enabled, but this device is not registered for mobile push yet/i)).toBeInTheDocument();
    });
  });

  it("refreshes diagnostics immediately after test registration succeeds", async () => {
    renderWithClient();

    fireEvent.click(screen.getByRole("button", { name: /Debug Push Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText("Profile Timezone:")).toBeInTheDocument();
    });

    mocks.debugTestRegistration.mockClear();
    mocks.getNativePushTokenDebugSnapshot.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test Registration" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.initializeNativePush).toHaveBeenCalledWith(mocks.user.id);
    expect(mocks.waitForNativePushToken).toHaveBeenCalledWith(mocks.user.id, { timeoutMs: 5000, pollMs: 250 });
    expect(mocks.debugTestRegistration).toHaveBeenCalled();
    expect(mocks.getNativePushTokenDebugSnapshot).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Registration Checked",
      description: "Refreshed this device's push token and queue diagnostics.",
    });
  });

  it("updates daily pep talk delivery time without reloading the app", async () => {
    mocks.profile = {
      ...mocks.defaultProfile,
      daily_push_enabled: true,
    };
    const { queryClient } = renderWithClient();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    setTimeoutSpy.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "9:00 AM" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.profileUpdateMock).toHaveBeenCalledWith({ daily_push_time: "09:00" });

    expect(mocks.profileUpdateEqMock).toHaveBeenCalledWith("id", mocks.user.id);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Time Updated",
      description: "Your push notification time has been updated",
    });
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["profile", mocks.user.id])).toMatchObject({
      daily_push_time: "09:00",
    });
  });

  it("toggles daily pep talks without reloading the app", async () => {
    const { queryClient } = renderWithClient();

    await waitFor(() => {
      expect(screen.getAllByRole("switch")[1]).not.toBeDisabled();
    });

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    setTimeoutSpy.mockClear();
    await act(async () => {
      fireEvent.click(screen.getAllByRole("switch")[1]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.profileUpdateMock).toHaveBeenCalledWith({ daily_push_enabled: true });

    expect(mocks.profileUpdateEqMock).toHaveBeenCalledWith("id", mocks.user.id);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Daily Push Enabled",
      description: "Settings updated successfully",
    });
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["profile", mocks.user.id])).toMatchObject({
      daily_push_enabled: true,
    });
  });
});
