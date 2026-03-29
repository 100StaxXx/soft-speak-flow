import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storePendingSocialAuthAttempt } from "@/utils/socialAuth";

const mocks = vi.hoisted(() => {
  const ensureProfileMock = vi.fn();
  const getAuthRedirectPathMock = vi.fn();
  const getProfileAwareAuthFallbackPathMock = vi.fn();
  const safeNavigateMock = vi.fn();
  const toastMock = vi.fn();
  const getSessionMock = vi.fn();
  const onAuthStateChangeMock = vi.fn();
  const exchangeCodeForSessionMock = vi.fn();
  const invokeMock = vi.fn();
  const setSessionMock = vi.fn();
  const signOutMock = vi.fn();
  const signInWithOAuthMock = vi.fn();
  const socialLoginInitializeMock = vi.fn();
  const socialLoginLoginMock = vi.fn();
  const appleAuthorizeMock = vi.fn();

  return {
    ensureProfileMock,
    getAuthRedirectPathMock,
    getProfileAwareAuthFallbackPathMock,
    safeNavigateMock,
    toastMock,
    getSessionMock,
    onAuthStateChangeMock,
    exchangeCodeForSessionMock,
    invokeMock,
    setSessionMock,
    signOutMock,
    signInWithOAuthMock,
    socialLoginInitializeMock,
    socialLoginLoginMock,
    appleAuthorizeMock,
    isNativePlatform: false,
    platform: "web",
    socialLoginAvailable: false,
    applePluginAvailable: false,
  };
});

vi.mock("@/utils/authRedirect", () => ({
  ensureProfile: mocks.ensureProfileMock,
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
      if (name === "SocialLogin") return mocks.socialLoginAvailable;
      if (name === "SignInWithApple") return mocks.applePluginAvailable;
      return false;
    },
    getPlatform: () => mocks.platform,
  },
}));

vi.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: {
    initialize: mocks.socialLoginInitializeMock,
    login: mocks.socialLoginLoginMock,
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

describe("Auth social auth intent guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/auth");

    mocks.isNativePlatform = false;
    mocks.platform = "web";
    mocks.socialLoginAvailable = false;
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
    mocks.ensureProfileMock.mockResolvedValue(undefined);
    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");
    mocks.invokeMock.mockResolvedValue({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
      error: null,
    });
    mocks.setSessionMock.mockResolvedValue({
      data: {
        session: signedInSession,
      },
      error: null,
    });
    mocks.signOutMock.mockResolvedValue(undefined);
    mocks.signInWithOAuthMock.mockResolvedValue({
      data: {
        url: "https://example.com/oauth",
        provider: "google",
      },
      error: null,
    });
    mocks.socialLoginInitializeMock.mockResolvedValue(undefined);
    mocks.socialLoginLoginMock.mockResolvedValue({
      result: {
        idToken: "google-id-token",
      },
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
    window.history.replaceState({}, "", "/auth");
  });

  it("sends sign_in intent for Google in login mode", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.socialLoginAvailable = true;

    renderAuth();
    await flushMicrotasks();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("google-native-auth", {
        body: {
          idToken: "google-id-token",
          intent: "sign_in",
        },
      });
    });
  });

  it("sends sign_up intent for Google in signup mode and still allows onboarding", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.socialLoginAvailable = true;
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign up with google/i }));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("google-native-auth", {
        body: {
          idToken: "google-id-token",
          intent: "sign_up",
        },
      });
    });

    await waitFor(() => {
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    });
  });

  it("sends sign_in intent for Apple in login mode and blocks account-not-found logins", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Function failed",
        context: {
          json: vi.fn().mockResolvedValue({
            code: "ACCOUNT_NOT_FOUND",
            error: "No account",
          }),
        },
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /sign in with apple/i }));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("apple-native-auth", {
        body: expect.objectContaining({
          identityToken: "apple-identity-token",
          intent: "sign_in",
        }),
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't find an existing account for Apple sign-in.",
    );
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("sends sign_up intent for Apple in signup mode and still allows onboarding", async () => {
    mocks.isNativePlatform = true;
    mocks.platform = "ios";
    mocks.applePluginAvailable = true;
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign up with apple/i }));

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("apple-native-auth", {
        body: expect.objectContaining({
          identityToken: "apple-identity-token",
          intent: "sign_up",
        }),
      });
    });

    await waitFor(() => {
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    });
  });

  it("blocks redirect-based social sign-in callbacks that resolve to onboarding", async () => {
    window.history.replaceState({}, "", "/auth?code=oauth-code");
    storePendingSocialAuthAttempt({
      provider: "google",
      intent: "sign_in",
    });
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth("/auth");
    await flushMicrotasks();
    await flushMicrotasks();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't find an existing account for Google sign-in.",
    );
    expect(mocks.exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
    expect(mocks.signOutMock).toHaveBeenCalledTimes(1);
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("pending_social_auth_attempt")).toBeNull();
  });
});
