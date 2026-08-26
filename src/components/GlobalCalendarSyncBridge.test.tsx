import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalCalendarSyncBridge } from "@/components/GlobalCalendarSyncBridge";
import {
  dispatchCalendarTaskUpdated,
  requestCalendarTaskDeleteSync,
} from "@/utils/calendarSyncEvents";

const mocks = vi.hoisted(() => ({
  syncProviderPull: vi.fn().mockResolvedValue(undefined),
  syncTaskUpdate: vi.fn().mockResolvedValue(undefined),
  syncTaskDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useCalendarIntegrations", () => ({
  useCalendarIntegrations: () => ({
    connections: [
      {
        id: "connection-1",
        provider: "google",
        sync_enabled: true,
        sync_mode: "full_sync",
      },
    ],
  }),
}));

vi.mock("@/hooks/useQuestCalendarSync", () => ({
  useQuestCalendarSync: () => ({
    syncProviderPull: { mutateAsync: mocks.syncProviderPull },
    syncTaskUpdate: { mutateAsync: mocks.syncTaskUpdate },
    syncTaskDelete: { mutateAsync: mocks.syncTaskDelete },
  }),
}));

describe("GlobalCalendarSyncBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pulls on launch and pushes task updates and deletes automatically", async () => {
    const view = render(<GlobalCalendarSyncBridge enabled />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.syncProviderPull).toHaveBeenCalledWith({ provider: "google" });

    act(() => {
      dispatchCalendarTaskUpdated("task-1");
      vi.advanceTimersByTime(350);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.syncTaskUpdate).toHaveBeenCalledWith({ taskId: "task-1" });

    await act(async () => {
      await requestCalendarTaskDeleteSync("task-1");
    });
    expect(mocks.syncTaskDelete).toHaveBeenCalledWith({ taskId: "task-1" });

    view.unmount();
  });

  it("does not sync while disabled", async () => {
    render(<GlobalCalendarSyncBridge enabled={false} />);

    act(() => {
      dispatchCalendarTaskUpdated("task-1");
      vi.advanceTimersByTime(1_000);
    });
    await requestCalendarTaskDeleteSync("task-1");

    expect(mocks.syncProviderPull).not.toHaveBeenCalled();
    expect(mocks.syncTaskUpdate).not.toHaveBeenCalled();
    expect(mocks.syncTaskDelete).not.toHaveBeenCalled();
  });
});
