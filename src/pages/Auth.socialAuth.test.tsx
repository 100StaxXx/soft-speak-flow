import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  const setSessionMock = vi.fn();
  const signOutMock = vi.fn();
  const signInWithOAuthMock = vi.fn();
  const appleAuthorizeMock = vi.fn();

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
    setSessionMock,
    signOutMock,
    signInWithOAuthMock,
    appleAuthorizeMock,
    browserOpenMock: vi.fn(),
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

vi.mock("@capacitor/browser", () => ({ Browser: { open: mocks.browserOpenMock } }));

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
      setSession: mocks.setSessionMock,
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

import Auth from "./Auth";

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

const acceptSignupConsent = () => {
  fireEvent.click(screen.getByRole("checkbox", { name: /i agree to cosmiq/i }));
};

describe("Auth social auth intent guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/auth");

    mocks.isNativePlatform = false;
    mocks.platform = "web";
    mocks.applePluginAvailable = false;
    mocks.browserOpenMock.mockResolvedValue(undefined);

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
    mocks.setSessionMock.mockResolvedValue({ data: { session: signedInSession }, error: null });
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
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/auth");
  });

  it("does not render Google social auth buttons", async () => {
    renderAuth();
    await flushMicrotasks();

    expect(screen.queryByRole("button", { name: /sign in with google/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));

    expect(screen.queryByRole("button", { name: /sign up with google/i })).not.toBeInTheDocument();
  });

  it("uses Apple web login on the web", async () => {
    renderAuth();
    await flushMicrotasks();
    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));
    await waitFor(() => expect(mocks.signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "apple", options: { redirectTo: `${window.location.origin}/auth` },
    }));
    expect(mocks.appleAuthorizeMock).not.toHaveBeenCalled();
  });

  it("opens the external browser when native Apple authorization is unavailable", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    vi.stubEnv("VITE_NATIVE_REDIRECT_BASE", "https://app.cosmiq.quest");
    renderAuth();
    await flushMicrotasks();
    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));
    await waitFor(() => expect(mocks.browserOpenMock).toHaveBeenCalledWith({ url: "https://example.com/oauth" }));
    expect(mocks.signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "apple", options: { redirectTo: "https://app.cosmiq.quest/auth", skipBrowserRedirect: true },
    });
    vi.unstubAllEnvs();
  });

  it("treats Apple cancellation as cancellation and allows another attempt", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.appleAuthorizeMock.mockRejectedValueOnce(new Error("Authorization cancelled (1001)"));
    renderAuth();
    await flushMicrotasks();
    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in with apple/i })).toBeEnabled());
    expect(mocks.signInWithIdTokenMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));
    await waitFor(() => expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks"));
  });

  it("matches Apple's hashed nonce to the raw nonce exchanged with Supabase", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    renderAuth();
    await flushMicrotasks();
    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));
    await waitFor(() => expect(mocks.signInWithIdTokenMock).toHaveBeenCalled());
    const raw = mocks.signInWithIdTokenMock.mock.calls[0][0].nonce;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    expect(mocks.appleAuthorizeMock.mock.calls[0][0].nonce).toBe(hash);
    expect(mocks.invokeMock).not.toHaveBeenCalled();
  });

  it("reports Apple callback failures and clears the pending attempt", async () => {
    window.history.replaceState({}, "", "/auth?error=access_denied");
    storePendingSocialAuthAttempt({ provider: "apple", intent: "sign_in" });
    renderAuth();
    expect(await screen.findByRole("alert")).toHaveTextContent("Apple sign-in wasn't completed");
    expect(window.sessionStorage.getItem("pending_social_auth_attempt")).toBeNull();
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("establishes the session from a native Apple return link", async () => {
    window.history.replaceState({}, "", "/auth#access_token=apple-access&refresh_token=apple-refresh");
    renderAuth();
    await waitFor(() => expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks"));
    expect(mocks.setSessionMock).toHaveBeenCalledWith({ access_token: "apple-access", refresh_token: "apple-refresh" });
    expect(window.location.hash).toBe("");
  });

  it("opens signup mode when requested by the auth query string", async () => {
    renderAuth("/auth?mode=signup");
    await flushMicrotasks();

    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /i agree to cosmiq/i })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /^get started$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /already have an account\? sign in/i })).toBeInTheDocument();
  });

  it("accepts a valid Apple session for an account created moments ago", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));

    await waitFor(() => {
      expect(mocks.signInWithIdTokenMock).toHaveBeenCalledWith({
        provider: "apple",
        token: "apple-identity-token",
        nonce: expect.any(String),
      });
    });

    await waitFor(() => expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.signOutMock).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));

    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(
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

    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in with Apple is temporarily unavailable. Please try again in a moment.",
    );
  });

  it("routes incomplete Apple accounts to onboarding after a profile timeout", async () => {
    vi.useFakeTimers();
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.getAuthRedirectPathMock.mockImplementation(() => new Promise(() => {}));
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));

    await flushMicrotasks();
    await flushMicrotasks();

    expect(mocks.signInWithIdTokenMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("sends sign_up intent for Apple in signup mode and still allows onboarding", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    acceptSignupConsent();
    fireEvent.click(screen.getByRole("button", { name: /sign up with apple/i }));

    await waitFor(() => {
      expect(mocks.signInWithIdTokenMock).toHaveBeenCalledWith({
        provider: "apple",
        token: "apple-identity-token",
        nonce: expect.any(String),
      });
    });

    await waitFor(() => {
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    });
  });

  it("lets verified Apple callback sessions finish onboarding", async () => {
    window.history.replaceState({}, "", "/auth?code=oauth-code");
    storePendingSocialAuthAttempt({
      provider: "apple",
      intent: "sign_in",
    });
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth("/auth");
    await flushMicrotasks();
    await flushMicrotasks();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
    expect(mocks.signOutMock).not.toHaveBeenCalled();
    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    expect(window.sessionStorage.getItem("pending_social_auth_attempt")).toBeNull();
  });
});
