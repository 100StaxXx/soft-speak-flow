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
  const connectAppleNativeMutateAsync = vi.fn();
  const syncProviderPullMutateAsync = vi.fn();

  const state = {
    integrationVisible: false,
    defaultProvider: null as "google" | "outlook" | "apple" | null,
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
    connectedByProvider: mocks.state.connectedByProvider,
    isLoading: false,
    upsertSettings: { mutateAsync: mocks.upsertSettingsMutateAsync },
    beginOAuthConnection: { mutateAsync: mocks.beginOAuthConnectionMutateAsync },
    completeOAuthConnection: { mutateAsync: mocks.completeOAuthConnectionMutateAsync },
    disconnectProvider: { mutateAsync: mocks.disconnectProviderMutateAsync },
    setProviderSyncMode: { mutateAsync: mocks.setProviderSyncModeMutateAsync },
    listProviderCalendars: { mutateAsync: mocks.listProviderCalendarsMutateAsync },
    setPrimaryCalendar: { mutateAsync: mocks.setPrimaryCalendarMutateAsync },
    connectAppleNative: { mutateAsync: mocks.connectAppleNativeMutateAsync },
  }),
}));

import { CalendarIntegrationsSettings } from "./CalendarIntegrationsSettings";

describe("CalendarIntegrationsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.integrationVisible = false;
    mocks.state.defaultProvider = null;
    mocks.state.connectedByProvider = {};
    mocks.upsertSettingsMutateAsync.mockResolvedValue(undefined);
    mocks.setProviderSyncModeMutateAsync.mockResolvedValue(undefined);
  });

  it("renders hidden opt-in state and enables visibility", async () => {
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
});
