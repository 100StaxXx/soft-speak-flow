import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connections: [] as Array<Record<string, unknown>>,
  settings: {} as { visible_calendars?: Record<string, string[]> },
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
    settings: mocks.settings,
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
    mocks.settings = {};
    mocks.isAvailableMock.mockResolvedValue({ available: true });
  });

  it("requests all seven agenda days even when they extend beyond the month grid", async () => {
    mocks.connections = [connection("google")];
    mocks.invokeMock.mockResolvedValue({ data: { events: [] }, error: null });
    renderHook(() => useExternalCalendarEvents(new Date("2026-09-30T12:00:00")), { wrapper });
    await waitFor(() => expect(mocks.invokeMock).toHaveBeenCalledWith("calendar-read-events", expect.objectContaining({
      body: expect.objectContaining({ endDate: new Date("2026-10-07T00:00:00").toISOString() }),
    })));
  });

  it("loads and combines read-only events from connected cloud calendars", async () => {
    mocks.connections = [connection("google"), connection("outlook")];
    mocks.invokeMock.mockImplementation(async (_name: string, options: { body: { provider: string } }) => ({
      data: {
        events: [{
          id: `${options.body.provider}-event`,
          title: options.body.provider === "google" ? "Google meeting" : "Outlook meeting",
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
      "calendar-read-events",
      expect.objectContaining({ body: expect.objectContaining({ action: "listEvents" }) }),
    );
  });

  it("keeps successful provider events when another provider fails", async () => {
    mocks.connections = [connection("google"), connection("outlook")];
    mocks.invokeMock.mockImplementation(async (_name: string, options: { body: { provider: string } }) => {
      if (options.body.provider === "outlook") {
        return { data: null, error: { message: "Reconnect Outlook", status: 409 } };
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
      { provider: "outlook", message: "Reconnect Outlook in Preferences, then retry calendar sync." },
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

  it('keeps working calendars visible when a second calendar on the same account fails', async () => {
    mocks.connections = [connection('google')];
    mocks.settings = { visible_calendars: { google: ['google-calendar', 'removed-shared-calendar'] } };
    mocks.invokeMock.mockImplementation(async (_name, { body }) => body.calendarId === 'removed-shared-calendar'
      ? { data: null, error: { message: 'Calendar removed', status: 409 } }
      : { data: { events: [{ id: 'work', title: 'Work meeting', startDate: '2026-08-09', endDate: '2026-08-10', isAllDay: true }] }, error: null });
    const { result } = renderHook(() => useExternalCalendarEvents(new Date('2026-08-09T12:00:00')), { wrapper });
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0].title).toBe('Work meeting');
    expect(result.current.errors).toHaveLength(1);
  });

  it('does not fetch calendars explicitly hidden from the agenda', async () => {
    mocks.connections = [connection('google')];
    mocks.settings = { visible_calendars: { google: [] } };
    const { result } = renderHook(() => useExternalCalendarEvents(new Date('2026-08-09T12:00:00')), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.invokeMock).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });
});
