import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Today from "./Today";

const mocks = vi.hoisted(() => ({
  prayerAlreadyCompleted: false,
  awardCheckInComplete: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.prayerAlreadyCompleted,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: { id: "user-1", timezone: "America/Los_Angeles" },
  }),
}));

vi.mock("@/hooks/useXPRewards", () => ({
  useXPRewards: () => ({ awardCheckInComplete: mocks.awardCheckInComplete }),
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => ({
    currentStep: "morning_checkin",
    isIntroDialogueActive: false,
  }),
}));

vi.mock("@/hooks/useEveningReflection", () => ({
  useEveningReflection: () => ({
    isEvening: false,
    hasCompletedToday: false,
    isLoading: false,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: () => null,
}));

vi.mock("@/components/EveningReflectionDrawer", () => ({
  EveningReflectionDrawer: () => null,
}));

vi.mock("@/components/TodaysPepTalk", () => ({ TodaysPepTalk: () => null }));
vi.mock("@/components/EarlyAccessFeedbackCard", () => ({ EarlyAccessFeedbackCard: () => null }));
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/MentorConnectionContext", () => ({
  MentorConnectionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("Today guided tutorial handoff", () => {
  beforeEach(() => {
    mocks.prayerAlreadyCompleted = false;
    mocks.awardCheckInComplete.mockReset();
    mocks.awardCheckInComplete.mockResolvedValue({ xpAwarded: 4 });
  });

  it("signals tutorial completion after the user completes the first prayer", async () => {
    const completed = vi.fn();
    window.addEventListener("morning-checkin-completed", completed);

    render(<MemoryRouter initialEntries={["/mentor"]}><Today /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Reflect and pray" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark prayer complete" }));

    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
    expect(mocks.awardCheckInComplete).toHaveBeenCalledOnce();

    window.removeEventListener("morning-checkin-completed", completed);
  });

  it("recovers the tutorial when today's prayer was already complete", async () => {
    mocks.prayerAlreadyCompleted = true;
    const completed = vi.fn();
    window.addEventListener("morning-checkin-completed", completed);

    render(<MemoryRouter initialEntries={["/mentor"]}><Today /></MemoryRouter>);

    await waitFor(() => expect(completed).toHaveBeenCalledOnce());
    window.removeEventListener("morning-checkin-completed", completed);
  });
});
