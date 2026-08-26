import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getAuthRedirectPathMock = vi.fn();
  const getProfileAwareAuthFallbackPathMock = vi.fn();
  const safeNavigateMock = vi.fn();
  const toastMock = vi.fn();
  const getSessionMock = vi.fn();
  const onAuthStateChangeMock = vi.fn();
  const invokeMock = vi.fn();
  const signInWithIdTokenMock = vi.fn();
  const appleAuthorizeMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const loggerDebugMock = vi.fn();
  const loggerInfoMock = vi.fn();
  const loggerWarnMock = vi.fn();
  const loggerErrorMock = vi.fn();
  const loggerLogMock = vi.fn();
  const validateSessionProductBoundaryMock = vi.fn();

  const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    getAuthRedirectPathMock,
    getProfileAwareAuthFallbackPathMock,
    safeNavigateMock,
    toastMock,
    getSessionMock,
    onAuthStateChangeMock,
    invokeMock,
    signInWithIdTokenMock,
    appleAuthorizeMock,
    maybeSingleMock,
    selectEqMock,
    selectMock,
    fromMock,
    loggerDebugMock,
    loggerInfoMock,
    loggerWarnMock,
    loggerErrorMock,
    loggerLogMock,
    validateSessionProductBoundaryMock,
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
    debug: mocks.loggerDebugMock,
    info: mocks.loggerInfoMock,
    warn: mocks.loggerWarnMock,
    error: mocks.loggerErrorMock,
    log: mocks.loggerLogMock,
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
      exchangeCodeForSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
      signInWithIdToken: mocks.signInWithIdTokenMock,
    },
    from: mocks.fromMock,
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

vi.mock("@/services/authProductBoundary", () => ({
  validateSessionProductBoundary: mocks.validateSessionProductBoundaryMock,
  announceAuthProductMismatch: vi.fn(),
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

const primeNativeAppleFlow = () => {
  mocks.isNativePlatform = true;
  mocks.platform = "ios";
  mocks.applePluginAvailable = true;
  mocks.getSessionMock.mockResolvedValue({
    data: {
      session: null,
    },
  });
  mocks.appleAuthorizeMock.mockResolvedValue({
    response: {
      identityToken: "apple-identity-token",
      email: signedInSession.user.email,
      user: "apple-user-1",
    },
  });
  mocks.signInWithIdTokenMock.mockResolvedValue({
    data: {
      session: signedInSession,
    },
    error: null,
  });
};

describe("Auth post-auth navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform = false;
    mocks.platform = "web";
    mocks.applePluginAvailable = false;

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

    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");
    mocks.signInWithIdTokenMock.mockResolvedValue({
      data: {
        session: signedInSession,
      },
      error: null,
    });
    mocks.appleAuthorizeMock.mockResolvedValue({
      response: {
        identityToken: "apple-identity-token",
        email: signedInSession.user.email,
        user: "apple-user-1",
      },
    });

    mocks.maybeSingleMock.mockResolvedValue({
      data: {
        onboarding_completed: true,
      },
      error: null,
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
  });

  it("routes existing users to /tasks when core redirect hangs and timeout fallback runs", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(
      () => new Promise(() => {}),
    );
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/tasks");

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/tasks",
    );
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).not.toHaveBeenCalled();
  });

  it("does not render a guest-mode CTA", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    renderAuth();
    await flushMicrotasks();

    expect(
      screen.queryByRole("button", { name: /continue as guest/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
  });

  it("lets account creation users reveal and hide password fields", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    renderAuth();
    await flushMicrotasks();

    expect(
      screen.queryByRole("button", { name: /^show confirm password$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/^confirm password$/i);
    const showPasswordButton = screen.getByRole("button", {
      name: /^show password$/i,
    });
    const showConfirmPasswordButton = screen.getByRole("button", {
      name: /^show confirm password$/i,
    });

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");

    fireEvent.click(showPasswordButton);
    expect(passwordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: /^hide password$/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^hide password$/i }));
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(showConfirmPasswordButton);
    expect(confirmPasswordInput).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: /^hide confirm password$/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /^hide confirm password$/i }),
    );
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request could not be completed.",
    );
  });

  it("shows a friendly inline error when reset password cannot reach the auth service", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(screen.getByRole("button", { name: /forgot password\?/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach the server to send the reset link. Check your connection and try again.",
    );
  });

  it("retries transient auth-gateway transport failures during password sign-up", async () => {
    vi.useFakeTimers();
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          name: "FunctionsFetchError",
          message: "Failed to send a request to the Edge Function",
        },
      })
      .mockResolvedValueOnce({
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

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    await flushMicrotasks();
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mocks.invokeMock).toHaveBeenCalledTimes(2);

    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Check your email",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    await screen.findByRole("button", {
      name: /already have an account\? sign in/i,
    });

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

  it("shows an accurate toast when sign-up validation fails before submit", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.c" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email address",
    );
    expect(mocks.invokeMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't create account",
        description: "Invalid email address",
        variant: "destructive",
      }),
    );
  });

  it("shows an accurate toast when email sign-up fails because the email already exists", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({
            error:
              "An account with this email already exists. Try signing in instead.",
            code: "EMAIL_ALREADY_REGISTERED",
            requestId: "req-auth-duplicate-1",
          }),
        },
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Try signing in instead.",
    );
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't create account",
        description:
          "An account with this email already exists. Try signing in instead.",
        variant: "destructive",
      }),
    );
  });

  it("maps auth outage codes to a temporary auth message and logs requestId", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });

    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({
            error: "Request could not be processed right now",
            code: "ABUSE_CHECK_FAILED",
            requestId: "req-auth-outage-1",
          }),
        },
      },
    });

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /need an account\? sign up/i }),
    );
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^get started$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Authentication is temporarily unavailable. Please try again in a moment.",
    );
    expect(mocks.loggerErrorMock).toHaveBeenCalledWith(
      "[Auth Gateway] Password auth request failed",
      expect.objectContaining({
        code: "ABUSE_CHECK_FAILED",
        requestId: "req-auth-outage-1",
        action: "sign_up_password",
      }),
    );
  });

  it("routes native Apple sign-in timeout fallbacks to / instead of /onboarding", async () => {
    vi.useFakeTimers();
    primeNativeAppleFlow();
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

  it("routes native Apple sign-in core redirects to / instead of /onboarding", async () => {
    primeNativeAppleFlow();
    mocks.getAuthRedirectPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    fireEvent.click(
      screen.getByRole("button", { name: /sign in with apple/i }),
    );

    await waitFor(() => {
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
        expect.any(Function),
        "/",
      );
    });
  });

  it("keeps native Apple sign-up routing to /onboarding", async () => {
    primeNativeAppleFlow();
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
      expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
        expect.any(Function),
        "/onboarding",
      );
    });
  });

  it("routes incomplete users to /onboarding when core redirect hangs and timeout fallback runs", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(
      () => new Promise(() => {}),
    );
    mocks.getProfileAwareAuthFallbackPathMock.mockResolvedValue("/onboarding");

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/onboarding",
    );
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("uses the resolved core path when it completes before timeout", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockResolvedValue("/tasks");

    renderAuth();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/tasks",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.getProfileAwareAuthFallbackPathMock).not.toHaveBeenCalled();
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
    expect(mocks.toastMock).not.toHaveBeenCalled();
  });

  it("falls back deterministically to /onboarding when profile-aware timeout fallback throws", async () => {
    vi.useFakeTimers();
    mocks.getAuthRedirectPathMock.mockImplementation(
      () => new Promise(() => {}),
    );
    mocks.getProfileAwareAuthFallbackPathMock.mockRejectedValue(
      new Error("fallback failed"),
    );

    renderAuth();
    await flushMicrotasks();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushMicrotasks();

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/onboarding",
    );
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

    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(
      expect.any(Function),
      "/tasks",
    );
    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCorePath?.("/onboarding");
      await Promise.resolve();
    });

    expect(mocks.safeNavigateMock).toHaveBeenCalledTimes(1);
  });
});
