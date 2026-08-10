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
  const listProviderCalendarsMutateAsync = vi.fn();
  const setPrimaryCalendarMutateAsync = vi.fn();
  const listProviderTaskListsMutateAsync = vi.fn();
  const setPrimaryTaskListMutateAsync = vi.fn();
  const connectAppleNativeMutateAsync = vi.fn();
  const refreshCalendarIntegrationsMock = vi.fn();
  const browserOpenMock = vi.fn();

  const state = {
    integrationVisible: false,
    defaultProvider: null as "google" | "outlook" | "apple" | null,
    connections: [] as Array<Record<string, unknown>>,
    connectedByProvider: {} as Record<string, unknown>,
    nativePlatform: false,
  };

  return {
    toastMock,
    upsertSettingsMutateAsync,
    beginOAuthConnectionMutateAsync,
    completeOAuthConnectionMutateAsync,
    disconnectProviderMutateAsync,
    listProviderCalendarsMutateAsync,
    setPrimaryCalendarMutateAsync,
    listProviderTaskListsMutateAsync,
    setPrimaryTaskListMutateAsync,
    connectAppleNativeMutateAsync,
    refreshCalendarIntegrationsMock,
    browserOpenMock,
    state,
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.state.nativePlatform,
    getPlatform: () => (mocks.state.nativePlatform ? "ios" : "web"),
  },
}));

vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: mocks.browserOpenMock,
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
    listProviderCalendars: { mutateAsync: mocks.listProviderCalendarsMutateAsync },
    setPrimaryCalendar: { mutateAsync: mocks.setPrimaryCalendarMutateAsync },
    listProviderTaskLists: { mutateAsync: mocks.listProviderTaskListsMutateAsync },
    setPrimaryTaskList: { mutateAsync: mocks.setPrimaryTaskListMutateAsync },
    connectAppleNative: { mutateAsync: mocks.connectAppleNativeMutateAsync },
    refreshCalendarIntegrations: mocks.refreshCalendarIntegrationsMock,
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
    mocks.state.nativePlatform = false;
    mocks.upsertSettingsMutateAsync.mockResolvedValue(undefined);
    mocks.beginOAuthConnectionMutateAsync.mockResolvedValue("https://accounts.google.com/o/oauth2/v2/auth");
    mocks.listProviderCalendarsMutateAsync.mockResolvedValue([]);
    mocks.listProviderTaskListsMutateAsync.mockResolvedValue([]);
    mocks.setPrimaryCalendarMutateAsync.mockResolvedValue(undefined);
    mocks.setPrimaryTaskListMutateAsync.mockResolvedValue(undefined);
    mocks.refreshCalendarIntegrationsMock.mockResolvedValue(undefined);
  });

  it("shows calendar integrations by default when nothing is connected", () => {
    render(<CalendarIntegrationsSettings />);

    expect(screen.getByText(/show selected calendars in agenda and send quests outward/i)).toBeInTheDocument();
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

  it("does not expose provider sync mode controls for a connected provider", async () => {
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

    expect(screen.queryByRole("option", { name: /sync/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Google Calendar" })).toBeInTheDocument();
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

  it("refreshes calendar state and clears params after callback success", async () => {
    window.history.replaceState(
      {},
      "",
      "/profile?calendar_oauth_provider=google&calendar_oauth_status=success",
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
          title: "Calendar connected",
          description: "google connected successfully.",
        }),
      );
      expect(mocks.refreshCalendarIntegrationsMock).toHaveBeenCalledTimes(1);
    });

    expect(window.location.pathname).toBe("/profile");
    expect(window.location.search).toBe("");
  });

  it("opens native Google OAuth in the system browser", async () => {
    mocks.state.nativePlatform = true;
    mocks.browserOpenMock.mockResolvedValue(undefined);

    render(<CalendarIntegrationsSettings />);

    fireEvent.click(screen.getByRole("button", { name: /connect google calendar/i }));

    await waitFor(() => {
      expect(mocks.beginOAuthConnectionMutateAsync).toHaveBeenCalledWith({
        provider: "google",
        redirectUri: expect.stringMatching(/\/functions\/v1\/google-calendar-auth\/callback$/),
        syncMode: "send_only",
        source: "native",
      });
      expect(mocks.browserOpenMock).toHaveBeenCalledWith({
        url: "https://accounts.google.com/o/oauth2/v2/auth",
      });
    });
  });

  it("does not auto-load Outlook destinations for a connected account", async () => {
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
    render(<CalendarIntegrationsSettings />);

    expect(await screen.findByRole("button", { name: /load calendars/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load to do lists/i })).toBeInTheDocument();
    expect(mocks.listProviderCalendarsMutateAsync).not.toHaveBeenCalled();
    expect(mocks.listProviderTaskListsMutateAsync).not.toHaveBeenCalled();
    expect(mocks.setPrimaryCalendarMutateAsync).not.toHaveBeenCalled();
    expect(mocks.setPrimaryTaskListMutateAsync).not.toHaveBeenCalled();
  });

  it("keeps destination reload buttons visible for connected Outlook destinations", async () => {
    mocks.state.integrationVisible = true;
    mocks.state.defaultProvider = "outlook";
    mocks.state.connections = [
      {
        id: "conn-outlook-4",
        provider: "outlook",
      },
    ];
    mocks.state.connectedByProvider = {
      outlook: {
        id: "conn-outlook-4",
        provider: "outlook",
        calendar_email: "user@example.com",
        primary_calendar_id: "calendar-4",
        primary_calendar_name: "Calendar",
        primary_task_list_id: "list-4",
        primary_task_list_name: "Tasks",
        sync_mode: "send_only",
        sync_enabled: true,
        platform: "web",
      },
    };

    render(<CalendarIntegrationsSettings />);

    expect(await screen.findByRole("button", { name: /load calendars/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /load to do lists/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sync now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use outlook for planning/i })).not.toBeInTheDocument();
  });
});
