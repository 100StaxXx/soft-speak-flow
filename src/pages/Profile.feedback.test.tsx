import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "user@example.com",
  } as { id: string; email: string } | null,
  signOut: vi.fn(),
  profile: {
    selected_mentor_id: "",
    onboarding_data: null,
    timezone: "UTC",
    faction: null,
  } as Record<string, unknown> | null,
  mentorId: null as string | null,
  toast: vi.fn(),
  navigate: vi.fn(),
  queryClient: {},
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "selected-mentor") {
      return { data: null, isLoading: false, error: null };
    }

    return { data: [], isLoading: false, error: null };
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: mocks.mentorId,
  }),
}));

vi.mock("@/hooks/useLongPress", () => ({
  useLongPress: () => ({
    handlers: {},
    isActivated: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: ({ preset }: { preset: string }) => (
    <div data-testid="cinematic-background" data-preset={preset} />
  ),
}));

vi.mock("@/components/PageInfoButton", () => ({
  PageInfoButton: () => null,
}));

vi.mock("@/components/PageInfoModal", () => ({
  PageInfoModal: () => null,
}));

vi.mock("@/components/PushNotificationSettings", () => ({
  PushNotificationSettings: () => null,
}));

vi.mock("@/components/DailyQuoteSettings", () => ({
  DailyQuoteSettings: () => null,
}));

vi.mock("@/components/ReferralDashboard", () => ({
  ReferralDashboard: () => null,
}));

vi.mock("@/components/CompanionSkins", () => ({
  CompanionSkins: () => null,
}));

vi.mock("@/components/ReferralCodeRedeemCard", () => ({
  ReferralCodeRedeemCard: () => null,
}));

vi.mock("@/components/FactionBadge", () => ({
  FactionBadge: () => null,
}));

vi.mock("@/components/ResetCompanionButton", () => ({
  ResetCompanionButton: () => null,
}));

vi.mock("@/components/SubscriptionManagement", () => ({
  SubscriptionManagement: () => null,
}));

vi.mock("@/components/SoundSettings", () => ({
  SoundSettings: () => null,
}));

vi.mock("@/components/LegalDocumentViewer", () => ({
  LegalDocumentViewer: () => null,
}));

vi.mock("@/components/QuestBehaviorSettings", () => ({
  QuestBehaviorSettings: () => null,
}));

vi.mock("@/components/DisplayNameSetting", () => ({
  DisplayNameSetting: () => null,
}));

vi.mock("@/components/CalendarIntegrationsSettings", () => ({
  CalendarIntegrationsSettings: () => null,
}));

vi.mock("@/pages/profileMentorChange", () => ({
  applyMentorChange: vi.fn(),
}));

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: vi.fn(),
  isAccountDeletionAuthError: vi.fn(() => false),
}));

import Profile from "./Profile";

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>,
  );

describe("Profile feedback entry", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it("uses the profile cinematic wallpaper preset", () => {
    renderProfile();

    expect(screen.getByTestId("cinematic-background")).toHaveAttribute("data-preset", "profile");
  });

  it("renders a feedback card that opens the support form in feedback mode", () => {
    renderProfile();

    expect(screen.getByText("Feedback")).toBeInTheDocument();
    expect(screen.getByText("Share ideas, feature requests, or anything that needs attention.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send Feedback" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/support/report", {
      state: { defaultCategory: "feedback" },
    });
  });
});
