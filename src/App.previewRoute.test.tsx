import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { passthroughProvider, isMainTabPathMock, authMock, profileMock, storageMock, hideSplashScreenMock } = vi.hoisted(() => ({
  passthroughProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  isMainTabPathMock: vi.fn((pathname: string) => pathname === "/mentor"),
  hideSplashScreenMock: vi.fn(),
  authMock: {
    session: null as null | { user: { id: string } },
    status: "unauthenticated",
    loading: false,
    user: null as null | { id: string },
  },
  profileMock: {
    profile: null as unknown,
    loading: false,
  },
  storageMock: {
    getItem: vi.fn(() => null as string | null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("@/components/ui/toaster", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: passthroughProvider,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  ThemeProvider: passthroughProvider,
}));

vi.mock("@/contexts/ViewModeContext", () => ({
  ViewModeProvider: passthroughProvider,
}));

vi.mock("@/contexts/TimeContext", () => ({
  TimeProvider: passthroughProvider,
}));

vi.mock("@/contexts/XPContext", () => ({
  XPProvider: passthroughProvider,
}));

vi.mock("@/contexts/EvolutionContext", () => ({
  EvolutionProvider: passthroughProvider,
}));

vi.mock("@/contexts/CelebrationContext", () => ({
  CelebrationProvider: passthroughProvider,
}));

vi.mock("@/contexts/CompanionPresenceContext", () => ({
  CompanionPresenceProvider: passthroughProvider,
}));

vi.mock("@/contexts/DeepLinkContext", () => ({
  DeepLinkProvider: passthroughProvider,
}));

vi.mock("@/contexts/WeeklyRecapContext", () => ({
  WeeklyRecapProvider: passthroughProvider,
}));

vi.mock("@/contexts/TalkPopupContext", () => ({
  TalkPopupProvider: passthroughProvider,
}));

vi.mock("@/contexts/ResilienceContext", () => ({
  ResilienceProvider: passthroughProvider,
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  MentorConnectionProvider: passthroughProvider,
  useMentorConnection: () => ({
    mentorId: null,
  }),
}));

vi.mock("@/contexts/WallpaperManifestContext", () => ({
  WallpaperManifestProvider: passthroughProvider,
}));

vi.mock("@/components/GlobalWidgetSyncBridge", () => ({
  GlobalWidgetSyncBridge: () => null,
}));

vi.mock("@/providers/StoreKitProvider", () => ({
  StoreKitProvider: passthroughProvider,
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  PostOnboardingMentorGuidanceProvider: passthroughProvider,
  usePostOnboardingMentorGuidance: () => ({
    isActive: false,
    activeTargetSelector: null,
    isStrictLockActive: false,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => profileMock,
}));

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: passthroughProvider,
  useAuth: () => authMock,
}));

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children, requireAccess = true }: { children?: ReactNode; requireAccess?: boolean }) => (
    <div data-testid="protected-route" data-require-access={String(requireAccess)}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/OnboardingExperienceGate", () => ({
  OnboardingExperienceGate: passthroughProvider,
}));

vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: passthroughProvider,
}));

vi.mock("@/components/GlobalEvolutionListener", () => ({
  GlobalEvolutionListener: () => null,
}));

vi.mock("@/components/RealtimeSyncProvider", () => ({
  RealtimeSyncProvider: passthroughProvider,
}));

vi.mock("@/components/InstallPWA", () => ({
  InstallPWA: () => null,
}));

vi.mock("@/components/UpdateAvailablePrompt", () => ({
  UpdateAvailablePrompt: () => null,
}));

vi.mock("@/components/WeeklyRecapModal", () => ({
  WeeklyRecapModal: () => null,
}));

vi.mock("@/components/BottomNav", () => ({
  BottomNav: () => null,
}));

vi.mock("@/components/MentorGuidanceCard", () => ({
  MentorGuidanceCard: () => null,
}));

vi.mock("@/components/tutorial/MentorSpotlightGuard", () => ({
  MentorSpotlightGuard: () => null,
}));

vi.mock("@/components/resilience/ResilienceStatusBanner", () => ({
  ResilienceStatusBanner: () => null,
}));

vi.mock("@/components/astral-encounters", () => ({
  AstralEncounterProvider: passthroughProvider,
}));

vi.mock("@/components/astral-encounters/AstralEncounterProvider", () => ({
  AstralEncounterProvider: passthroughProvider,
}));

vi.mock("@/components/MainTabsKeepAlive", () => ({
  MainTabsKeepAlive: ({ activePath }: { activePath: string }) => (
    <div data-testid="main-tabs">{activePath}</div>
  ),
  isMainTabPath: (pathname: string) => isMainTabPathMock(pathname),
}));

vi.mock("@/hooks/useAppResumeRefresh", () => ({
  useAppResumeRefresh: () => undefined,
}));

vi.mock("@/hooks/useDailyTaskBadgeSync", () => ({
  REMAINING_TODAY_BADGE_COUNT_QUERY_KEY: "remaining-today-badge-count",
  useDailyTaskBadgeSync: () => undefined,
}));

vi.mock("@/hooks/useReferralSync", () => ({
  useReferralSync: () => undefined,
}));

vi.mock("@/hooks/useGlobalWidgetSync", () => ({
  useGlobalWidgetSync: () => undefined,
}));

vi.mock("@/utils/orientationLock", () => ({
  lockToPortrait: vi.fn(),
}));

vi.mock("@/utils/capacitor", () => ({
  hideSplashScreen: hideSplashScreenMock,
}));

vi.mock("@/utils/nativePushNotifications", () => ({
  initializeNativePush: vi.fn(),
  isNativePushSupported: () => false,
  NATIVE_PUSH_RECEIVED_EVENT: "native-push-received",
  unregisterNativePush: vi.fn(),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    scope: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    log: vi.fn(),
  },
}));

vi.mock("@/utils/profileOnboarding", () => ({
  isReturningProfile: () => false,
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: {
    getItem: (...args: unknown[]) => storageMock.getItem(...args),
    setItem: (...args: unknown[]) => storageMock.setItem(...args),
    removeItem: (...args: unknown[]) => storageMock.removeItem(...args),
    clear: (...args: unknown[]) => storageMock.clear(...args),
  },
  safeSessionStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("@/utils/bottomNavVisibility", () => ({
  shouldShowBottomNav: () => false,
}));

vi.mock("./pages/NotFound", () => ({
  default: () => <div>Page Not Found</div>,
}));

vi.mock("./pages/PremiumSuccess", () => ({
  default: () => <div>Premium Success Page</div>,
}));

import App from "./App";

describe("App preview route", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    authMock.session = null;
    authMock.status = "unauthenticated";
    authMock.loading = false;
    authMock.user = null;
    profileMock.profile = null;
    profileMock.loading = false;
    storageMock.getItem.mockReset();
    storageMock.getItem.mockReturnValue(null);
    storageMock.setItem.mockReset();
    storageMock.removeItem.mockReset();
    storageMock.clear.mockReset();
    hideSplashScreenMock.mockReset();
    isMainTabPathMock.mockImplementation((pathname: string) => pathname === "/mentor");
  });

  it("falls through to not found when /preview is requested", async () => {
    window.history.pushState({}, "", "/preview");

    render(<App />);

    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
  });

  it("renders premium success without requiring active access while activation syncs", async () => {
    authMock.session = { user: { id: "user-1" } };
    authMock.user = { id: "user-1" };
    authMock.status = "authenticated";
    window.history.pushState({}, "", "/premium/success");

    render(<App />);

    expect(await screen.findByText("Premium Success Page")).toBeInTheDocument();
    expect(screen.getByTestId("protected-route")).toHaveAttribute("data-require-access", "false");
  });

  it("redirects legacy reflection routes to the canonical mentor reflection URL", async () => {
    window.history.pushState({}, "", "/reflection");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/mentor");
      expect(window.location.search).toBe("?open=evening-reflection");
    });

    expect(screen.getByTestId("main-tabs")).toHaveTextContent("/mentor");
  });

  it.each([
    ["/journeys", "/mentor"],
    ["/campaigns", "/mentor"],
    ["/advanced-planner", "/mentor"],
    ["/tasks", "/mentor"],
  ])("redirects retired creation route %s to %s", async (legacyPath, destination) => {
    authMock.session = { user: { id: "user-1" } };
    authMock.user = { id: "user-1" };
    authMock.status = "authenticated";
    isMainTabPathMock.mockImplementation((pathname: string) => pathname === "/mentor");
    window.history.pushState({}, "", legacyPath);

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe(destination);
    });
    expect(screen.getByTestId("main-tabs")).toHaveTextContent(destination);
  });

  it.each(["/mentor", "/garden", "/companion"])(
    "hides the notifications tray on %s",
    async (pathname) => {
      authMock.session = { user: { id: "user-1" } };
      authMock.user = { id: "user-1" };
      authMock.status = "authenticated";
      isMainTabPathMock.mockImplementation((pathname: string) =>
        ["/mentor", "/garden", "/companion"].includes(pathname),
      );
      window.history.pushState({}, "", pathname);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId("main-tabs")).toHaveTextContent(pathname);
      });
      expect(screen.queryByRole("button", { name: /open notifications/i })).not.toBeInTheDocument();
    },
  );

  it("hides the native splash after the watchdog if startup data keeps loading", async () => {
    vi.useFakeTimers();
    authMock.session = { user: { id: "user-1" } };
    authMock.user = { id: "user-1" };
    authMock.status = "authenticated";
    profileMock.loading = true;
    isMainTabPathMock.mockImplementation((pathname: string) => pathname === "/mentor");
    window.history.pushState({}, "", "/mentor");

    render(<App />);

    expect(hideSplashScreenMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3500);
    });

    expect(hideSplashScreenMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
