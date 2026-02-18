import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PostOnboardingMentorGuidanceProvider } from "./usePostOnboardingMentorGuidance";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    loading: false,
    profile: {
      onboarding_data: {
        walkthrough_completed: true,
        guided_tutorial: {
          version: 2,
          eligible: true,
          completed: false,
          completedSteps: ["create_quest", "meet_companion"],
          xpAwardedSteps: [],
          milestonesCompleted: ["open_mentor_tab"],
        },
      },
    },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => null,
}));

const RouteProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </div>
  );
};

describe("guided tutorial route restoration", () => {
  it("redirects to the active tutorial route using replace semantics", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/journeys"]}>
          <PostOnboardingMentorGuidanceProvider>
            <Routes>
              <Route path="*" element={<RouteProbe />} />
            </Routes>
          </PostOnboardingMentorGuidanceProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));

    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/mentor");
    });
  });
});
