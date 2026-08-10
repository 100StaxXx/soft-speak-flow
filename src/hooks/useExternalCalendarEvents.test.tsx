import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connections: [] as Array<Record<string, unknown>>,
  invokeMock: vi.fn(),
  isAvailableMock: vi.fn(),
  listEventsMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    connections: mocks.connections,
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

vi.mock("@/plugins/NativeCalendarPlugin", () => ({
  NativeCalendar: {
    isAvailable: mocks.isAvailableMock,
    listEvents: mocks.listEventsMock,
  },
}));

import { useExternalCalendarEvents } from "./useExternalCalendarEvents";

const connection = (provider: "google" | "outlook" | "apple") => ({
  id: `${provider}-connection`,
  provider,
  calendar_email: `${provider}@example.com`,
  primary_calendar_id: `${provider}-calendar`,
  primary_calendar_name: `${provider} Work`,
  primary_task_list_id: null,
  primary_task_list_name: null,
  sync_mode: "send_only",
  sync_enabled: true,
  platform: provider === "apple" ? "ios" : "web",
  last_synced_at: null,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })}>
    {children}
  </QueryClientProvider>
);

describe("useExternalCalendarEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connections = [];
    mocks.isAvailableMock.mockResolvedValue({ available: true });
  });

  it("loads and combines read-only events from connected cloud calendars", async () => {
    mocks.connections = [connection("google"), connection("outlook")];
    mocks.invokeMock.mockImplementation(async (name: string) => ({
      data: {
        events: [{
          id: `${name}-event`,
          title: name.includes("google") ? "Google meeting" : "Outlook meeting",
          startDate: "2026-08-09T17:00:00.000Z",
          endDate: "2026-08-09T17:30:00.000Z",
          isAllDay: false,
        }],
      },
      error: null,
    }));

    const { result } = renderHook(
      () => useExternalCalendarEvents(new Date("2026-08-09T12:00:00")),
      { wrapper },
    );

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.connectedProviderCount).toBe(2);
    expect(result.current.errors).toEqual([]);
    expect(mocks.invokeMock).toHaveBeenCalledWith(
      "google-calendar-events",
      expect.objectContaining({ body: expect.objectContaining({ action: "listEvents" }) }),
    );
  });

  it("keeps successful provider events when another provider fails", async () => {
    mocks.connections = [connection("google"), connection("outlook")];
    mocks.invokeMock.mockImplementation(async (name: string) => {
      if (name.startsWith("outlook")) {
        return { data: null, error: { message: "Reconnect Outlook" } };
      }
      return {
        data: {
          events: [{
            id: "google-event",
            title: "Google meeting",
            startDate: "2026-08-09",
            endDate: "2026-08-10",
            isAllDay: true,
          }],
        },
        error: null,
      };
    });

    const { result } = renderHook(
      () => useExternalCalendarEvents(new Date("2026-08-09T12:00:00")),
      { wrapper },
    );

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.errors).toEqual([
      { provider: "outlook", message: "Reconnect Outlook" },
    ]);
  });

  it("reads native Apple Calendar events through the plugin", async () => {
    mocks.connections = [connection("apple")];
    mocks.listEventsMock.mockResolvedValue({
      events: [{
        id: "apple-event",
        title: "Dentist",
        startDate: "2026-08-09T17:00:00.000Z",
        endDate: "2026-08-09T18:00:00.000Z",
        isAllDay: false,
        calendarId: "apple-calendar",
        calendarName: "Personal",
      }],
    });

    const { result } = renderHook(
      () => useExternalCalendarEvents(new Date("2026-08-09T12:00:00")),
      { wrapper },
    );

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(mocks.listEventsMock).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: "apple-calendar",
    }));
  });
});
