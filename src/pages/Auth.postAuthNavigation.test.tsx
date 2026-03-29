import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const ensureProfileMock = vi.fn();
  const getAuthRedirectPathMock = vi.fn();
  const getProfileAwareAuthFallbackPathMock = vi.fn();
  const safeNavigateMock = vi.fn();
  const toastMock = vi.fn();
  const getSessionMock = vi.fn();
  const onAuthStateChangeMock = vi.fn();
  const invokeMock = vi.fn();
  const maybeSingleMock = vi.fn();

  const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    ensureProfileMock,
    getAuthRedirectPathMock,
    getProfileAwareAuthFallbackPathMock,
    safeNavigateMock,
    toastMock,
    getSessionMock,
    onAuthStateChangeMock,
    invokeMock,
    maybeSingleMock,
    selectEqMock,
    selectMock,
    fromMock,
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
    isNativePlatform: () => false,
    isPluginAvailable: () => false,
    getPlatform: () => "web",
  },
}));

vi.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: {
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
  },
}));

vi.mock("@capacitor-community/apple-sign-in", () => ({
  SignInWithApple: {
    authorize: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: mocks.onAuthStateChangeMock,
      exchangeCodeForSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
      setSession: vi.fn(),
    },
    from: mocks.fromMock,
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

import Auth from "./Auth";

const renderAuth = () =>
  render(
    <MemoryRouter initialEntries={["/auth"]}>
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

const signedInSession = {
  user: {
    id: "user-1234",
    email: "user@example.com",
  },
};

describe("Auth post-auth navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: signedInSession,
      },
    });

    mocks.onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    mocks.ensureProfileMock.mockResolvedValue(undefined);
    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");

    mocks.maybeSingleMock.mockResolvedValue({
      data: {
        onboarding_completed: true,
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes existing users to /tasks when core redirect hangs and timeout fallback runs", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(() => new Promise(() => {}));
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks");
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).toHaveBeenCalledTimes(1);
  });

  it("does not render a guest-mode CTA", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    renderAuth();
    await flushMicrotasks();

    expect(screen.queryByRole("button", { name: /continue as guest/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("renders an inline error card when password sign-in fails", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        message: "Function failed",
        context: {
          json: vi.fn().mockResolvedValue({
            error: "Request could not be completed.",
          }),
        },
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Request could not be completed.");
  });

  it("submits password sign-up requests and shows the confirmation email toast", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock.mockResolvedValue({
      data: {
        access_token: null,
        refresh_token: null,
        user: {
          id: "new-user-1",
          email: "new@example.com",
        },
        requiresEmailConfirmation: true,
      },
      error: null,
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    await screen.findByRole("button", { name: /already have an account\? sign in/i });

    expect(mocks.invokeMock).toHaveBeenCalledWith("auth-gateway", {
      body: expect.objectContaining({
        action: "sign_up_password",
        email: "new@example.com",
        password: "Password123",
      }),
    });
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Check your email",
      }),
    );
  });

  it("routes incomplete users to /onboarding when core redirect hangs and timeout fallback runs", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(() => new Promise(() => {}));
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("uses the resolved core path when it completes before timeout", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");

    renderAuth();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.getProfileAwareAuthFallbackPathMock).not.toHaveBeenCalled();
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).not.toHaveBeenCalled();
  });

  it("falls back deterministically to /onboarding when profile-aware timeout fallback throws", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(() => new Promise(() => {}));
    mocks.getProfileAwareAuthFallbackPathMock.mockRejectedValue(new Error("fallback failed"));

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/onboarding");
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("does not navigate twice when deadline fallback wins and core resolves later", async () => {
    vi.useFakeTimers();

    let resolveCorePath: ((value: string) => void) | null = null;
    const delayedCorePath = new Promise<string>((resolve) => {
      resolveCorePath = resolve;
    });

    mocks.getAuthRedirectPathMock.mockReturnValue(delayedCorePath);
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/tasks");
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCorePath?.("/onboarding");
      await Promise.resolve();
    });

    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });
});
