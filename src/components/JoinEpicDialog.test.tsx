import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_CAMPAIGN_LIMIT, ACTIVE_CAMPAIGN_LIMIT_MESSAGE } from "@/features/epics/constants";

const mocks = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpcMock(...args),
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
    success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { JoinEpicDialog } from "./JoinEpicDialog";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("JoinEpicDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the campaign limit message when joining would exceed the active campaign limit", async () => {
    mocks.rpcMock.mockResolvedValue({
      data: [
        {
          success: false,
          code: "epic_limit_reached",
          message: `You can only have ${ACTIVE_CAMPAIGN_LIMIT} active epics at a time`,
          epic_id: null,
          epic_title: null,
          copied_habit_count: 0,
        },
      ],
      error: null,
    });

    render(<JoinEpicDialog open onOpenChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/Invite Code/i), {
      target: { value: "EPIC-ALPHA" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join Epic/i }));

    await waitFor(() => {
      expect(mocks.toastErrorMock).toHaveBeenCalledWith(ACTIVE_CAMPAIGN_LIMIT_MESSAGE);
    });

    expect(screen.getByText(ACTIVE_CAMPAIGN_LIMIT_MESSAGE)).toBeInTheDocument();
  });
});
