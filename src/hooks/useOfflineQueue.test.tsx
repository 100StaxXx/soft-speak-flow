import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetOfflineDBForTests,
  clearAllPendingActions,
  enqueueAction,
  initOfflineDB,
  updateQueuedAction,
} from "@/utils/offlineStorage";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  invoke: vi.fn(),
  trackResilienceEvent: vi.fn(),
  dispatchPlannerSyncFinished: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/utils/resilienceTelemetry", () => ({
  trackResilienceEvent: (...args: unknown[]) => mocks.trackResilienceEvent(...args),
}));

vi.mock("@/utils/plannerSync", () => ({
  dispatchPlannerSyncFinished: () => mocks.dispatchPlannerSyncFinished(),
}));

import { useOfflineQueue } from "./useOfflineQueue";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

const enqueueFailedSupportReport = async (retryCount: number) => {
  await initOfflineDB();
  const id = await enqueueAction({
    userId: "user-1",
    actionKind: "SUPPORT_REPORT",
    entityType: "support_report",
    entityId: "corr-1",
    payload: {
      correlationId: "corr-1",
      summary: "Queued support report",
    },
  });

  await updateQueuedAction(id, {
    status: "failed",
    retry_count: retryCount,
    last_error: "Network request failed",
  });

  return id;
};

describe("useOfflineQueue", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setOnline(true);
    await clearAllPendingActions();
  });

  afterEach(async () => {
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
    await clearAllPendingActions();
    __resetOfflineDBForTests();
  });

  it("manually retries failed actions even after they hit the auto-retry limit", async () => {
    const id = await enqueueFailedSupportReport(3);
    mocks.invoke.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("submit-support-report", {
        body: expect.objectContaining({
          correlationId: "corr-1",
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
      expect(result.current.syncStatus).toBe("success");
    });

    expect(result.current.receipts.find((receipt) => receipt.id === id)?.status).toBe("synced");
  });

  it("keeps syncStatus in error when skipped failed actions remain", async () => {
    const id = await enqueueFailedSupportReport(3);

    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });

    await act(async () => {
      await result.current.syncPendingActions();
    });

    expect(mocks.invoke).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.syncStatus).toBe("error");
      expect(result.current.lastSyncError).toBe("1 action needs retry.");
    });

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.receipts.find((receipt) => receipt.id === id)?.status).toBe("failed");
  });
});
