import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  deleteCurrentAccount: vi.fn(),
  isAccountDeletionAuthError: vi.fn(() => false),
  loggerError: vi.fn(),
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

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: mocks.deleteCurrentAccount,
  isAccountDeletionAuthError: mocks.isAccountDeletionAuthError,
  getAccountDeletionErrorMetadata: (error: unknown) => {
    if (!error || typeof error !== "object") return {};
    const candidate = error as Record<string, unknown>;
    return {
      ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
      ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
      ...(typeof candidate.stage === "string" ? { stage: candidate.stage } : {}),
    };
  },
  getAccountDeletionFailureMessage: (error: unknown) => {
    const stage =
      error && typeof error === "object" && typeof (error as { stage?: unknown }).stage === "string"
        ? (error as { stage: string }).stage
        : undefined;
    if (stage === "storage_cleanup") {
      return "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.";
    }
    return error instanceof Error ? error.message : "Failed to delete account. Please try again.";
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
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

import Profile from "./Profile";

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>,
  );

const openDeleteDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
  return screen.getByLabelText('Type "delete" to confirm');
};

describe("Profile account deletion dialog", () => {
  beforeEach(() => {
    mocks.user = {
      id: "user-1",
      email: "user@example.com",
    };
    mocks.profile = {
      selected_mentor_id: "",
      onboarding_data: null,
      timezone: "UTC",
      faction: null,
    };
    mocks.mentorId = null;
    mocks.signOut.mockReset();
    mocks.toast.mockReset();
    mocks.navigate.mockReset();
    mocks.deleteCurrentAccount.mockReset();
    mocks.deleteCurrentAccount.mockResolvedValue({ warnings: [] });
    mocks.isAccountDeletionAuthError.mockReset();
    mocks.isAccountDeletionAuthError.mockReturnValue(false);
    mocks.loggerError.mockReset();
  });

  it("submits deletion on the first activation while the confirmation input is focused", async () => {
    renderProfile();

    const input = openDeleteDialog();
    const activeElementSpy = vi.spyOn(document, "activeElement", "get").mockReturnValue(input);
    const blurSpy = vi.spyOn(input, "blur");
    fireEvent.change(input, { target: { value: "delete" } });

    await waitFor(() => {
      expect(blurSpy).toHaveBeenCalled();
    });

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.pointerDown(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mocks.deleteCurrentAccount).toHaveBeenCalledTimes(1);
    });
    activeElementSpy.mockRestore();
  });

  it("closes and clears the dialog after a successful deletion", async () => {
    renderProfile();

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth", {
        replace: true,
        state: { message: "Your account has been deleted." },
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Delete your account?")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
    expect(screen.getByLabelText('Type "delete" to confirm')).toHaveValue("");
  });

  it("keeps the dialog open and preserves the confirmation text after a deletion failure", async () => {
    mocks.deleteCurrentAccount.mockRejectedValueOnce(
      Object.assign(new Error("Account deletion is temporarily unavailable. Please try again later."), {
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        status: 500,
        requestId: "req-delete-profile-1",
        stage: "storage_cleanup",
      }),
    );

    renderProfile();

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Account deletion failed",
        description: "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
        variant: "destructive",
      });
    });
    expect(mocks.loggerError).toHaveBeenCalledWith("[Account Deletion] Profile deletion failed", {
      surface: "profile",
      userId: "user-1",
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      status: 500,
      requestId: "req-delete-profile-1",
      stage: "storage_cleanup",
      message: "Account deletion is temporarily unavailable. Please try again later.",
    });

    expect(screen.getByText("Delete your account?")).toBeInTheDocument();
    expect(screen.getByLabelText('Type "delete" to confirm')).toHaveValue("delete");
  });

  it("blocks deletion when the confirmation text is invalid", () => {
    renderProfile();

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "nope" } });

    const deleteForm = input.closest("form");
    expect(deleteForm).not.toBeNull();
    fireEvent.submit(deleteForm!);

    expect(mocks.deleteCurrentAccount).not.toHaveBeenCalled();
  });
});
