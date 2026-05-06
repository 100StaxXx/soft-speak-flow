import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  achievements: [] as Array<{ achievement_type: string; earned_at: string }>,
  achievementsError: null as null | { code?: string; message?: string; details?: string | null; hint?: string | null },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "achievements") {
        return {
          select: () => ({
            eq: async () => ({ data: mocks.achievements, error: mocks.achievementsError }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { BadgesCollectionPanel } from "@/components/BadgesCollectionPanel";

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BadgesCollectionPanel />
    </QueryClientProvider>,
  );
};

describe("BadgesCollectionPanel", () => {
  beforeEach(() => {
    mocks.achievements = [];
    mocks.achievementsError = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders badges without the Evolutions moments section", async () => {
    renderPanel();

    expect(await screen.findByText("Your Badges")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /evolutions/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /watch stage/i })).not.toBeInTheDocument();
  });

  it("still renders when the achievements table has not reached the schema cache yet", async () => {
    mocks.achievementsError = {
      code: "PGRST205",
      message: "Could not find the table 'public.achievements' in the schema cache",
      details: null,
      hint: null,
    };

    renderPanel();

    expect(await screen.findByText("Your Badges")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /evolutions/i })).not.toBeInTheDocument();
  });
});
