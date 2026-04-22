import * as React from "react";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "user@example.com",
  } as { id: string; email: string } | null,
  signOut: vi.fn(),
  profile: {
    selected_mentor_id: "mentor-lyra",
    onboarding_data: null,
    timezone: "UTC",
    faction: null,
  } as Record<string, unknown> | null,
  mentorId: "mentor-lyra" as string | null,
  toast: vi.fn(),
  navigate: vi.fn(),
  queryClient: {},
  mentors: [
    { id: "mentor-atlas", name: "Atlas", slug: "atlas", avatar_url: null, is_active: true },
    { id: "mentor-sage", name: "The Sage", slug: "sage", avatar_url: null, is_active: true },
    { id: "mentor-lyra", name: "Lyra", slug: "lyra", avatar_url: null, is_active: true },
    { id: "mentor-icon", name: "The Icon", slug: "icon", avatar_url: null, is_active: true },
    { id: "mentor-charles", name: "Charles", slug: "charles", avatar_url: null, is_active: true },
    { id: "mentor-princess", name: "The Princess", slug: "princess", avatar_url: null, is_active: true },
    { id: "mentor-operator", name: "The Operator", slug: "operator", avatar_url: null, is_active: true },
    { id: "mentor-rival", name: "The Rival", slug: "rival", avatar_url: null, is_active: true },
    { id: "mentor-stryker", name: "Stryker", slug: "stryker", avatar_url: null, is_active: true },
  ],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "selected-mentor") {
      return {
        data: mocks.mentors.find((mentor) => mentor.id === mocks.mentorId) ?? null,
        isLoading: false,
        error: null,
      };
    }

    if (queryKey[0] === "mentors") {
      return {
        data: mocks.mentors,
        isLoading: false,
        error: null,
      };
    }

    return { data: null, isLoading: false, error: null };
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
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CinematicPageBackground", () => ({
  CinematicPageBackground: () => null,
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

vi.mock("@/components/CompanionAccessibilitySettings", () => ({
  CompanionAccessibilitySettings: () => null,
}));

vi.mock("@/components/CompanionPersonalitySettings", () => ({
  CompanionPersonalitySettings: () => null,
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

vi.mock("@/components/CompanionNameSetting", () => ({
  CompanionNameSetting: () => null,
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

vi.mock("@/components/ui/select", () => {
  type SelectContextValue = {
    value?: string;
    onValueChange?: (value: string) => void;
  };

  const SelectContext = React.createContext<SelectContextValue>({});

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div data-testid="mentor-select">{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
      const context = React.useContext(SelectContext);
      return (
        <button role="option" type="button" aria-selected={context.value === value} onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
  };
});

import Profile from "./Profile";

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>,
  );

describe("Profile mentor selection", () => {
  beforeEach(() => {
    mocks.mentorId = "mentor-lyra";
  });

  it("renders all active guides while keeping the canonical roster first", () => {
    renderProfile();

    expect(screen.getByText("Your Guide")).toBeInTheDocument();

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "The Sage",
      "Lyra",
      "The Icon",
      "Charles",
      "The Princess",
      "The Operator",
      "The Rival",
      "Atlas",
      "Stryker",
    ]);

    expect(screen.getByRole("option", { name: "Atlas" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "The Guy" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Stryker" })).toBeInTheDocument();
  });
});
