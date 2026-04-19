import { createContext, useContext, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SelectContext = createContext<{
  onValueChange?: (value: string) => void;
  value?: string;
}>({});

const mocks = vi.hoisted(() => {
  const toastMock = vi.fn();
  const upsertSettingsMutateAsync = vi.fn();
  const beginOAuthConnectionMutateAsync = vi.fn();
  const completeOAuthConnectionMutateAsync = vi.fn();
  const disconnectProviderMutateAsync = vi.fn();
  const setProviderSyncModeMutateAsync = vi.fn();
  const listProviderCalendarsMutateAsync = vi.fn();
  const setPrimaryCalendarMutateAsync = vi.fn();
  const listProviderTaskListsMutateAsync = vi.fn();
  const setPrimaryTaskListMutateAsync = vi.fn();
  const connectAppleNativeMutateAsync = vi.fn();
  const syncProviderPullMutateAsync = vi.fn();

  const state = {
    integrationVisible: false,
    defaultProvider: null as "google" | "outlook" | "apple" | null,
    connections: [] as Array<Record<string, unknown>>,
    connectedByProvider: {} as Record<string, unknown>,
  };

  return {
    toastMock,
    upsertSettingsMutateAsync,
    beginOAuthConnectionMutateAsync,
    completeOAuthConnectionMutateAsync,
    disconnectProviderMutateAsync,
    setProviderSyncModeMutateAsync,
    listProviderCalendarsMutateAsync,
    setPrimaryCalendarMutateAsync,
    listProviderTaskListsMutateAsync,
    setPrimaryTaskListMutateAsync,
    connectAppleNativeMutateAsync,
    syncProviderPullMutateAsync,
    state,
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: () => ({
    syncProviderPull: {
      mutateAsync: mocks.syncProviderPullMutateAsync,
    },
  }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    integrationVisible: mocks.state.integrationVisible,
    defaultProvider: mocks.state.defaultProvider,
    connections: mocks.state.connections,
    connectedByProvider: mocks.state.connectedByProvider,
    canConnectAppleNative: false,
    appleNativeUnavailableReason: "This app build needs an update to enable Apple Calendar.",
    isLoading: false,
    upsertSettings: { mutateAsync: mocks.upsertSettingsMutateAsync },
    beginOAuthConnection: { mutateAsync: mocks.beginOAuthConnectionMutateAsync },
    completeOAuthConnection: { mutateAsync: mocks.completeOAuthConnectionMutateAsync },
    disconnectProvider: { mutateAsync: mocks.disconnectProviderMutateAsync },
    setProviderSyncMode: { mutateAsync: mocks.setProviderSyncModeMutateAsync },
    listProviderCalendars: { mutateAsync: mocks.listProviderCalendarsMutateAsync },
    setPrimaryCalendar: { mutateAsync: mocks.setPrimaryCalendarMutateAsync },
    listProviderTaskLists: { mutateAsync: mocks.listProviderTaskListsMutateAsync },
    setPrimaryTaskList: { mutateAsync: mocks.setPrimaryTaskListMutateAsync },
    connectAppleNative: { mutateAsync: mocks.connectAppleNativeMutateAsync },
  }),
}));

import { CalendarIntegrationsSettings } from "./CalendarIntegrationsSettings";

describe("CalendarIntegrationsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/profile");
    mocks.state.integrationVisible = false;
    mocks.state.defaultProvider = null;
    mocks.state.connections = [];
    mocks.state.connectedByProvider = {};
    mocks.upsertSettingsMutateAsync.mockResolvedValue(undefined);
    mocks.setProviderSyncModeMutateAsync.mockResolvedValue(undefined);
    mocks.listProviderCalendarsMutateAsync.mockResolvedValue([]);
    mocks.listProviderTaskListsMutateAsync.mockResolvedValue([]);
    mocks.setPrimaryCalendarMutateAsync.mockResolvedValue(undefined);
    mocks.setPrimaryTaskListMutateAsync.mockResolvedValue(undefined);
  });

  it("shows calendar integrations by default when nothing is connected", () => {
    render(<CalendarIntegrationsSettings />);

    expect(screen.getByText("Optional sync. Choose send-only or full sync per provider.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect outlook calendar/i })).toBeInTheDocument();
  });

  it("renders hidden opt-in state and enables visibility once a provider exists", async () => {
    mocks.state.connections = [
      {
        id: "conn-1",
        provider: "google",
      },
    ];
    mocks.state.connectedByProvider = {
      google: {
        id: "conn-1",
        provider: "google",
        calendar_email: "user@example.com",
        primary_calendar_id: "primary-calendar",
        primary_calendar_name: "Primary Calendar",
        sync_mode: "send_only",
        sync_enabled: true,
        platform: "web",
      },
    };

    render(<CalendarIntegrationsSettings />);

    const showButton = screen.getByRole("button", { name: /show calendar integrations/i });
    fireEvent.click(showButton);

    await waitFor(() => {
      expect(mocks.upsertSettingsMutateAsync).toHaveBeenCalledWith({
        integration_visible: true,
      });
    });
  });

  it("updates provider sync mode for a connected provider", async () => {
    mocks.state.integrationVisible = true;
    mocks.state.defaultProvider = "google";
    mocks.state.connections = [
      {
        id: "conn-1",
        provider: "google",
      },
    ];
    mocks.state.connectedByProvider = {
      google: {
        id: "conn-1",
        provider: "google",
        calendar_email: "user@example.com",
        primary_calendar_id: "primary-calendar",
        primary_calendar_name: "Primary Calendar",
        sync_mode: "send_only",
        sync_enabled: true,
        platform: "web",
      },
    };

    render(<CalendarIntegrationsSettings />);

    const fullSyncOption = screen.getByRole("option", { name: "Full sync" });
    fireEvent.click(fullSyncOption);

    await waitFor(() => {
      expect(mocks.setProviderSyncModeMutateAsync).toHaveBeenCalledWith({
        provider: "google",
        syncMode: "full_sync",
      });
    });
  });

  it("shows callback error toast from calendar oauth query params", async () => {
    window.history.replaceState(
      {},
      "",
      "/profile?calendar_oauth_provider=google&calendar_oauth_status=error&calendar_oauth_message=OAuth%20failed",
    );

    mocks.state.integrationVisible = true;
    mocks.state.connections = [
      {
        id: "conn-1",
        provider: "google",
      },
    ];

    render(<CalendarIntegrationsSettings />);

    await waitFor(() => {
      expect(mocks.toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Failed to complete connection",
          description: "OAuth failed",
          variant: "destructive",
        }),
      );
    });
  });

  it("auto-loads Outlook calendars and To Do lists for a new Outlook connection", async () => {
    mocks.state.integrationVisible = true;
    mocks.state.connections = [
      {
        id: "conn-outlook-1",
        provider: "outlook",
      },
    ];
    mocks.state.connectedByProvider = {
      outlook: {
        id: "conn-outlook-1",
        provider: "outlook",
        calendar_email: "user@example.com",
        primary_calendar_id: null,
        primary_calendar_name: null,
        primary_task_list_id: null,
        primary_task_list_name: null,
        sync_mode: "send_only",
        sync_enabled: true,
        platform: "web",
      },
    };
    mocks.listProviderCalendarsMutateAsync.mockResolvedValue([
      { id: "calendar-1", name: "Calendar", isPrimary: true },
    ]);
    mocks.listProviderTaskListsMutateAsync.mockResolvedValue([
      { id: "list-1", name: "Tasks", isPrimary: true },
    ]);

    render(<CalendarIntegrationsSettings />);

    await waitFor(() => {
      expect(mocks.listProviderCalendarsMutateAsync).toHaveBeenCalledWith("outlook");
      expect(mocks.listProviderTaskListsMutateAsync).toHaveBeenCalledWith("outlook");
    });

    await waitFor(() => {
      expect(mocks.setPrimaryCalendarMutateAsync).toHaveBeenCalledWith({
        provider: "outlook",
        calendarId: "calendar-1",
        calendarName: "Calendar",
      });
      expect(mocks.setPrimaryTaskListMutateAsync).toHaveBeenCalledWith({
        taskListId: "list-1",
        taskListName: "Tasks",
      });
    });
  });

  it("activates Outlook planning with one click", async () => {
    mocks.state.integrationVisible = true;
    mocks.state.connections = [
      {
        id: "conn-outlook-2",
        provider: "outlook",
      },
    ];
    mocks.state.connectedByProvider = {
      outlook: {
        id: "conn-outlook-2",
        provider: "outlook",
        calendar_email: "user@example.com",
        primary_calendar_id: "calendar-2",
        primary_calendar_name: "Calendar",
        primary_task_list_id: "list-2",
        primary_task_list_name: "Tasks",
        sync_mode: "send_only",
        sync_enabled: true,
        platform: "web",
      },
    };
    mocks.listProviderCalendarsMutateAsync.mockResolvedValue([
      { id: "calendar-2", name: "Calendar", isPrimary: true },
    ]);
    mocks.listProviderTaskListsMutateAsync.mockResolvedValue([
      { id: "list-2", name: "Tasks", isPrimary: true },
    ]);

    render(<CalendarIntegrationsSettings />);

    const activateButton = await screen.findByRole("button", { name: /use outlook for planning/i });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(mocks.setProviderSyncModeMutateAsync).toHaveBeenCalledWith({
        provider: "outlook",
        syncMode: "full_sync",
      });
      expect(mocks.upsertSettingsMutateAsync).toHaveBeenCalledWith({
        default_provider: "outlook",
        integration_visible: true,
      });
    });
  });
});
