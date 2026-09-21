import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const toastMock = vi.fn();
  const safeNavigateMock = vi.fn();
  const getSessionMock = vi.fn();
  const updateUserMock = vi.fn();
  const setSessionMock = vi.fn();
  const exchangeCodeForSessionMock = vi.fn();
  const unsubscribeMock = vi.fn();
  let authStateHandler: ((event: string, session: { user: { id: string } } | null) => void) | null = null;

  return {
    toastMock,
    safeNavigateMock,
    getSessionMock,
    updateUserMock,
    setSessionMock,
    exchangeCodeForSessionMock,
    unsubscribeMock,
    setAuthStateHandler: (
      handler: ((event: string, session: { user: { id: string } } | null) => void) | null,
    ) => {
      authStateHandler = handler;
    },
    getAuthStateHandler: () => authStateHandler,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

vi.mock("@/utils/nativeNavigation", () => ({
  safeNavigate: mocks.safeNavigateMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: (handler: (event: string, session: { user: { id: string } } | null) => void) => {
        mocks.setAuthStateHandler(handler);
        return {
          data: {
            subscription: {
              unsubscribe: mocks.unsubscribeMock,
            },
          },
        };
      },
      updateUser: mocks.updateUserMock,
      setSession: mocks.setSessionMock,
      exchangeCodeForSession: mocks.exchangeCodeForSessionMock,
    },
  },
}));

import ResetPassword from "./ResetPassword";

const renderResetPassword = () =>
  render(
    <MemoryRouter initialEntries={["/auth/reset-password"]}>
      <Routes>
        <Route path="/auth/reset-password" element={<ResetPassword />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/auth/reset-password");
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });
    mocks.updateUserMock.mockResolvedValue({ error: null });
    mocks.setSessionMock.mockResolvedValue({ data: { session: { access_token: 'token', user: { id: 'user-1' } } }, error: null });
    mocks.exchangeCodeForSessionMock.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    mocks.setAuthStateHandler(null);
  });

  it("redirects when the link has expired", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#error=access_denied&error_description=Link%20expired",
    );

    renderResetPassword();

    await waitFor(() => {
      expect(mocks.toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Reset Link Expired",
          description: "Link expired",
        }),
      );
    });
    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/auth");
  });

  it("redirects when the recovery hash is missing", async () => {
    renderResetPassword();

    await waitFor(() => {
      expect(mocks.toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Invalid Link",
        }),
      );
    });
    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/auth");
  });

  it("renders the reset form when a recovery session already exists", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
    });

    renderResetPassword();

    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  it("establishes a recovery session when a link opens in the running app", async () => {
    window.history.replaceState({}, "", "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery");
    renderResetPassword();
    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
    expect(mocks.setSessionMock).toHaveBeenCalledWith({ access_token: "token", refresh_token: "refresh" });
    expect(window.location.hash).toBe("");
  });

  it("accepts a session after Supabase has already consumed the recovery URL", async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    renderResetPassword();
    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
    expect(mocks.safeNavigateMock).not.toHaveBeenCalled();
  });

  it("exchanges recovery codes", async () => {
    window.history.replaceState({}, "", "/auth/reset-password?code=recovery-code");
    renderResetPassword();
    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
    expect(mocks.exchangeCodeForSessionMock).toHaveBeenCalledWith("recovery-code");
    expect(window.location.search).toBe("");
  });

  it("rejects invalid recovery tokens even when another account is signed in", async () => {
    window.history.replaceState({}, "", "/auth/reset-password#access_token=bad&refresh_token=bad&type=recovery");
    mocks.getSessionMock.mockResolvedValue({ data: { session: { user: { id: "other-user" } } } });
    mocks.setSessionMock.mockResolvedValue({ data: { session: null }, error: new Error("Invalid token") });
    renderResetPassword();
    await waitFor(() => expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/auth"));
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("renders the reset form after a PASSWORD_RECOVERY auth event", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );

    renderResetPassword();

    act(() => {
      mocks.getAuthStateHandler()?.("PASSWORD_RECOVERY", {
        user: {
          id: "user-1",
        },
      });
    });

    expect(await screen.findByLabelText(/new password/i)).toBeInTheDocument();
  });

  it("rejects mismatched passwords", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
    });

    renderResetPassword();

    fireEvent.change(await screen.findByLabelText(/new password/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password999" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(mocks.updateUserMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Passwords don't match",
      }),
    );
  });

  it("rejects passwords that fail policy checks", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
    });

    renderResetPassword();

    fireEvent.change(await screen.findByLabelText(/new password/i), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(mocks.updateUserMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invalid Password",
      }),
    );
  });

  it("updates the password and returns to auth on success", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#access_token=token&refresh_token=refresh&type=recovery",
    );
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
    });

    renderResetPassword();

    fireEvent.change(await screen.findByLabelText(/new password/i), {
      target: { value: "Password123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(mocks.updateUserMock).toHaveBeenCalledWith({
        password: "Password123",
      });
    });
    expect(mocks.toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Password Updated",
      }),
    );
    expect(mocks.safeNavigateMock).toHaveBeenCalledWith(expect.any(Function), "/auth");
  });
});
