import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retryNow: vi.fn(),
  dismissDegraded: vi.fn(),
  resilience: {
    state: "recovering",
    queueCount: 0,
    receipts: [],
    syncStatus: "idle",
    lastSyncError: null,
  } as {
    state: "healthy" | "offline" | "degraded" | "outage" | "recovering" | "recovered";
    queueCount: number;
    receipts: Array<{
      id: string;
      actionKind: string;
      entityType: string;
      entityId: string | null;
      status: "queued" | "syncing" | "synced" | "failed" | "dropped";
      retryCount: number;
      lastError: string | null;
      createdAt: number;
      updatedAt: number;
    }>;
    syncStatus: "idle" | "syncing" | "success" | "error";
    lastSyncError: string | null;
  },
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  useResilience: () => ({
    ...mocks.resilience,
    retryNow: mocks.retryNow,
    dismissDegraded: mocks.dismissDegraded,
  }),
}));

vi.mock("@/components/resilience/QueuedActionsSheet", () => ({
  QueuedActionsSheet: () => null,
}));

import { ResilienceStatusBanner } from "./ResilienceStatusBanner";

const buildReceipt = (
  id: string,
  status: "queued" | "syncing" | "synced" | "failed" | "dropped",
) => ({
  id,
  actionKind: "TASK_CREATE",
  entityType: "task",
  entityId: id,
  status,
  retryCount: 0,
  lastError: null,
  createdAt: 1,
  updatedAt: 1,
});

const renderBanner = () =>
  render(
    <MemoryRouter>
      <ResilienceStatusBanner />
    </MemoryRouter>,
  );

describe("ResilienceStatusBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.resilience, {
      state: "recovering",
      queueCount: 0,
      receipts: [],
      syncStatus: "idle",
      lastSyncError: null,
    });
  });

  it("shows syncing copy only while a sync is actually in progress", () => {
    Object.assign(mocks.resilience, {
      state: "recovering",
      queueCount: 2,
      receipts: [buildReceipt("queued-1", "queued"), buildReceipt("syncing-1", "syncing")],
      syncStatus: "syncing",
    });

    renderBanner();

    expect(screen.getByText("Back online. Syncing 2 actions...")).toBeInTheDocument();
  });

  it("shows retry-needed copy when only failed actions remain", () => {
    Object.assign(mocks.resilience, {
      state: "recovering",
      queueCount: 2,
      receipts: [buildReceipt("failed-1", "failed"), buildReceipt("failed-2", "failed")],
      syncStatus: "error",
      lastSyncError: "2 actions need retry.",
    });

    renderBanner();

    expect(screen.getByText("Back online. 2 actions need retry.")).toBeInTheDocument();
    expect(screen.queryByText(/Syncing 2 actions/)).not.toBeInTheDocument();
  });
});
