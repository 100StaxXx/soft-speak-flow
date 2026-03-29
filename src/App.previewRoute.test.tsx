import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { passthroughProvider } = vi.hoisted(() => ({
  passthroughProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  PostOnboardingMentorGuidanceProvider: passthroughProvider,
  usePostOnboardingMentorGuidance: () => ({
    isActive: false,
    activeTargetSelector: null,
    isStrictLockActive: false,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
    loading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: passthroughProvider,
  useAuth: () => ({
    session: null,
    status: "unauthenticated",
    loading: false,
    user: null,
  }),
}));

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: passthroughProvider,
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

vi.mock("@/components/MainTabsKeepAlive", () => ({
  MainTabsKeepAlive: () => null,
  isMainTabPath: () => false,
}));

vi.mock("@/hooks/useAppResumeRefresh", () => ({
  useAppResumeRefresh: () => undefined,
}));

vi.mock("@/hooks/useGlobalWidgetSync", () => ({
  useGlobalWidgetSync: () => undefined,
}));

vi.mock("@/utils/orientationLock", () => ({
  lockToPortrait: vi.fn(),
}));

vi.mock("@/utils/capacitor", () => ({
  hideSplashScreen: vi.fn(),
}));

vi.mock("@/utils/nativePushNotifications", () => ({
  initializeNativePush: vi.fn(),
  isNativePushSupported: () => false,
  unregisterNativePush: vi.fn(),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("@/utils/profileOnboarding", () => ({
  isReturningProfile: () => false,
}));

vi.mock("@/utils/storage", () => ({
  safeSessionStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/utils/bottomNavVisibility", () => ({
  shouldShowBottomNav: () => false,
}));

vi.mock("./pages/NotFound", () => ({
  default: () => <div>Page Not Found</div>,
}));

import App from "./App";

describe("App preview route", () => {
  it("falls through to not found when /preview is requested", async () => {
    window.history.pushState({}, "", "/preview");

    render(<App />);

    expect(await screen.findByText("Page Not Found")).toBeInTheDocument();
  });
});
