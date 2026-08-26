import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storePendingSocialAuthAttempt } from "@/utils/socialAuth";

const mocks = vi.hoisted(() => {
  const getAuthRedirectPathMock = vi.fn();
  const getProfileAwareAuthFallbackPathMock = vi.fn();
  const safeNavigateMock = vi.fn();
  const toastMock = vi.fn();
  const getSessionMock = vi.fn();
  const onAuthStateChangeMock = vi.fn();
  const exchangeCodeForSessionMock = vi.fn();
  const invokeMock = vi.fn();
  const signInWithIdTokenMock = vi.fn();
  const signOutMock = vi.fn();
  const signInWithOAuthMock = vi.fn();
  const appleAuthorizeMock = vi.fn();
  const validateSessionProductBoundaryMock = vi.fn();
  const announceAuthProductMismatchMock = vi.fn();

  return {
    getAuthRedirectPathMock,
    getProfileAwareAuthFallbackPathMock,
    safeNavigateMock,
    toastMock,
    getSessionMock,
    onAuthStateChangeMock,
    exchangeCodeForSessionMock,
    invokeMock,
    signInWithIdTokenMock,
    signOutMock,
    signInWithOAuthMock,
    appleAuthorizeMock,
    validateSessionProductBoundaryMock,
    announceAuthProductMismatchMock,
    isNativePlatform: false,
    platform: "web",
    applePluginAvailable: false,
  };
});

vi.mock("@/utils/authRedirect", () => ({
  getAuthRedirectPath: mocks.getAuthRedirectPathMock,
  getProfileAwareAuthFallbackPath: mocks.getProfileAwareAuthFallbackPathMock,
}));

vi.mock("@/utils/nativeNavigation", () => ({
  safeNavigate: mocks.safeNavigateMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
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

vi.mock("@/assets/backgrounds", () => ({
  signinBackground: "",
}));

vi.mock("@/components/StaticBackgroundImage", () => ({
  StaticBackgroundImage: () => null,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatform,
    isPluginAvailable: (name: string) => {
      if (name === "SignInWithApple") return mocks.applePluginAvailable;
      return false;
    },
    getPlatform: () => mocks.platform,
  },
}));

vi.mock("@capacitor-community/apple-sign-in", () => ({
  SignInWithApple: {
    authorize: mocks.appleAuthorizeMock,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: mocks.onAuthStateChangeMock,
      exchangeCodeForSession: mocks.exchangeCodeForSessionMock,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: mocks.signInWithOAuthMock,
      signInWithIdToken: mocks.signInWithIdTokenMock,
      signOut: mocks.signOutMock,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

vi.mock("@/services/authProductBoundary", () => ({
  validateSessionProductBoundary: mocks.validateSessionProductBoundaryMock,
  announceAuthProductMismatch: mocks.announceAuthProductMismatchMock,
}));

import Auth, { getAuthPresentation } from "./Auth";

const signedInSession = {
  user: {
    id: "user-1234",
    email: "user@example.com",
  },
};

const renderAuth = (path = "/auth") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
  );

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("Auth social auth intent guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/auth");

    mocks.isNativePlatform = false;
    mocks.platform = "web";
    mocks.applePluginAvailable = false;

    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });
    mocks.onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.exchangeCodeForSessionMock.mockResolvedValue({
      data: {
        session: signedInSession,
      },
      error: null,
    });
    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");
    mocks.invokeMock.mockResolvedValue({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
      error: null,
    });
    mocks.signInWithIdTokenMock.mockResolvedValue({
      data: {
        session: signedInSession,
      },
      error: null,
    });
    mocks.signOutMock.mockResolvedValue(undefined);
    mocks.signInWithOAuthMock.mockResolvedValue({
      data: {
        url: "https://example.com/oauth",
        provider: "apple",
      },
      error: null,
    });
    mocks.appleAuthorizeMock.mockResolvedValue({
      response: {
        identityToken: "apple-identity-token",
        email: "user@example.com",
        user: "apple-user-1",
      },
    });
    mocks.validateSessionProductBoundaryMock.mockResolvedValue({
      allowed: true,
      expectedProductMode: "graceward",
      actualProductMode: "graceward",
      reason: "trusted_binding",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/auth");
  });

  it("does not render Google social auth buttons", async () => {
    renderAuth();
    await flushMicrotasks();

    expect(
      screen.queryByRole("button", { name: /sign in with google/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );

    expect(
      screen.queryByRole("button", { name: /sign up with google/i }),
    ).not.toBeInTheDocument();
  });

  it("opens signup mode when requested by the auth query string", async () => {
    renderAuth("/auth?mode=signup");
    await flushMicrotasks();

    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^get started$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /already have an account\? sign in/i,
      }),
    ).toBeInTheDocument();
  });

  it("sends sign_in intent for Apple in login mode and blocks account-not-found logins", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.signInWithIdTokenMock.mockResolvedValue({
      data: {
        session: {
          ...signedInSession,
          user: {
            ...signedInSession.user,
            created_at: new Date().toISOString(),
          },
        },
      },
      error: null,
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    await waitFor(() => {
      expect(mocks.signInWithIdTokenMock).toHaveBeenCalledWith({
        provider: "apple",
        token: "apple-identity-token",
        nonce: expect.any(String),
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't find an existing account for Apple sign-in.",
    );
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("shows a friendly inline error when native Apple auth cannot reach Supabase Auth", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.signInWithIdTokenMock.mockResolvedValue({
      data: { session: null },
      error: {
        name: "AuthRetryableFetchError",
        message: "Failed to fetch",
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network issue while signing in with Apple. Check your connection and try again.",
    );
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("shows an actionable outage message when the Apple provider is unavailable", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.signInWithIdTokenMock.mockResolvedValue({
      data: { session: null },
      error: {
        name: "AuthApiError",
        message: "Unsupported provider: provider is not enabled",
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in with Apple is temporarily unavailable. Please try again in a moment.",
    );
  });

  it("routes native Apple sign-in timeout fallbacks to guarded home instead of onboarding", async () => {
    vi.useFakeTimers();
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.getAuthRedirectPathMock.mockImplementation(
      () => new Promise(() => {}),
    );
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    await flushMicrotasks();
    await flushMicrotasks();

    expect(mocks.signInWithIdTokenMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/",
    );
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("sends sign_up intent for Apple in signup mode and still allows onboarding", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /sign up with apple/i }),
    );

    await waitFor(() => {
      expect(mocks.signInWithIdTokenMock).toHaveBeenCalledWith({
        provider: "apple",
        token: "apple-identity-token",
        nonce: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
        expect.any(Function),
        "/onboarding",
      );
    });
  });

  it("blocks redirect-based social sign-in callbacks that resolve to onboarding", async () => {
    window.history.replaceState({}, "", "/auth?code=oauth-code");
    storePendingSocialAuthAttempt({
      provider: "apple",
      intent: "sign_in",
    });
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth("/auth");
    await flushMicrotasks();
    await flushMicrotasks();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't find an existing account for Apple sign-in.",
    );
    expect(mocks.exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
    expect(mocks.signOutMock).toHaveBeenCalledTimes(1);
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem("pending_social_auth_attempt"),
    ).toBeNull();
  });

  it("signs out a Cosmiq Apple session before redirect-based Graceward navigation", async () => {
    window.history.replaceState({}, "", "/auth?code=oauth-code");
    storePendingSocialAuthAttempt({
      provider: "apple",
      intent: "sign_in",
    });
    const boundary = {
      allowed: false,
      expectedProductMode: "graceward",
      actualProductMode: "cosmiq",
      reason: "trusted_binding",
    };
    mocks.validateSessionProductBoundaryMock.mockResolvedValue(boundary);

    renderAuth("/auth");
    await flushMicrotasks();
    await flushMicrotasks();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That session belongs to your Cosmiq account",
    );
    expect(mocks.signOutMock).toHaveBeenCalledTimes(1);
    expect(mocks.announceAuthProductMismatchMock).toHaveBeenCalledWith(
      boundary,
    );
    expect(mocks.getAuthRedirectPathMock).not.toHaveBeenCalled();
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("keeps the Cosmiq and Graceward auth presentations visually isolated", () => {
    const cosmiq = getAuthPresentation("cosmiq");
    const graceward = getAuthPresentation("christian");

    expect(cosmiq.rootClassName).toContain("bg-[#090311]");
    expect(cosmiq.primaryButtonClassName).toContain("from-[#b254ea]");
    expect(cosmiq.showBrandHeader).toBe(false);
    expect(cosmiq.rootClassName).not.toContain("#f4efe3");

    expect(graceward.rootClassName).toContain("bg-[#f4efe3]");
    expect(graceward.primaryButtonClassName).toContain("bg-[#2f5938]");
    expect(graceward.showBrandHeader).toBe(true);
    expect(graceward.rootClassName).not.toContain("#090311");
  });
});
