import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => ({
        data: table === "daily_encouragement_history"
          ? [
              {
                id: "history-1",
                daily_pep_talk_id: "pep-1",
                first_started_at: "2026-08-08T15:00:00Z",
                completed_at: "2026-08-08T15:02:00Z",
                listen_count: 2,
                max_progress: 1,
                last_interaction_at: "2026-08-08T15:02:00Z",
              },
              {
                id: "history-2",
                daily_pep_talk_id: "pep-2",
                first_started_at: null,
                completed_at: null,
                listen_count: 0,
                max_progress: 0,
                last_interaction_at: "2026-08-07T15:02:00Z",
              },
            ]
          : [],
        error: null,
      })),
      in: vi.fn(async () => ({
        data: table === "daily_pep_talks"
          ? [
              {
                id: "pep-1",
                for_date: "2026-08-08",
                title: "Grace for the Next Step",
                summary: "Receive grace and take the next faithful step.",
                topic_category: "faithfulness",
              },
              {
                id: "pep-2",
                for_date: "2026-08-07",
                title: "Held in the Waiting",
                summary: "A reflection for patient trust.",
                topic_category: "patience",
              },
            ]
          : [],
        error: null,
      })),
    };
    return builder;
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import EncouragementHistory from "./EncouragementHistory";

describe("EncouragementHistory", () => {
  it("shows received and heard daily encouragements without requiring user setup", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EncouragementHistory />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Grace for the Next Step")).toBeInTheDocument();
    expect(screen.getByText("Held in the Waiting")).toBeInTheDocument();
    expect(screen.getByText("2 received")).toBeInTheDocument();
    expect(screen.getByText("1 heard")).toBeInTheDocument();
    expect(screen.getByText("Heard")).toBeInTheDocument();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText("2 plays")).toBeInTheDocument();
  });
});
