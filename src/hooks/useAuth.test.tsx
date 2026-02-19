import { render, waitFor, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getSessionMock = vi.fn();
  const onAuthStateChangeMock = vi.fn();
  const signOutMock = vi.fn();
  const removeAllChannelsMock = vi.fn();
  const unsubscribeMock = vi.fn();
  const profileUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn(() => ({
    update: vi.fn(() => ({
      eq: profileUpdateEqMock,
    })),
  }));
  const removeSessionItemMock = vi.fn();

  return {
    getSessionMock,
    onAuthStateChangeMock,
    signOutMock,
    removeAllChannelsMock,
    unsubscribeMock,
    fromMock,
    removeSessionItemMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      onAuthStateChange: mocks.onAuthStateChangeMock,
      signOut: mocks.signOutMock,
    },
    from: mocks.fromMock,
    removeAllChannels: mocks.removeAllChannelsMock,
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
  },
}));

vi.mock("@/utils/timezone", () => ({
  getUserTimezone: () => "UTC",
}));

vi.mock("@/utils/storage", () => ({
  safeSessionStorage: {
    removeItem: mocks.removeSessionItemMock,
  },
}));

import { AuthProvider, useAuth } from "./useAuth";

const createWrapper = (queryClient?: QueryClient) => {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe("useAuth provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAuthStateChangeMock.mockImplementation(() => ({
      data: { subscription: { unsubscribe: mocks.unsubscribeMock } },
    }));
    mocks.removeAllChannelsMock.mockResolvedValue([]);
    mocks.signOutMock.mockResolvedValue(undefined);
  });

  it("creates one auth subscription for multiple consumers", async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    const Probe = () => {
      const { status } = useAuth();
      return <div data-testid="status">{status}</div>;
    };

    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Probe />
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.onAuthStateChangeMock).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps authenticated user in recovering state after transient refresh errors", async () => {
    const session = { user: { id: "user-1", email: "test@example.com" } } as Session;
    mocks.getSessionMock.mockResolvedValueOnce({ data: { session }, error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    mocks.getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error("network timeout"),
    });

    await act(async () => {
      const refreshPromise = result.current.refreshSession();
      await refreshPromise;
    });

    expect(result.current.status).toBe("recovering");
    expect(result.current.user?.id).toBe("user-1");
  });

  it("transitions to unauthenticated when session is confirmed missing", async () => {
    const session = { user: { id: "user-2", email: "test2@example.com" } } as Session;
    mocks.getSessionMock.mockResolvedValueOnce({ data: { session }, error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    mocks.getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.user).toBeNull();
  });

  it("signOut is idempotent and performs cleanup once", async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    let resolveSignOut: (() => void) | null = null;
    mocks.signOutMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const clearSpy = vi.spyOn(queryClient, "clear");

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    let firstSignOut: Promise<void>;
    let secondSignOut: Promise<void>;
    await act(async () => {
      firstSignOut = result.current.signOut();
      secondSignOut = result.current.signOut();
    });

    expect(mocks.signOutMock).toHaveBeenCalledTimes(1);
    expect(firstSignOut).toBeDefined();
    expect(secondSignOut).toBeDefined();

    await act(async () => {
      resolveSignOut?.();
      await firstSignOut!;
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(mocks.removeAllChannelsMock).toHaveBeenCalledTimes(1);
    expect(mocks.removeSessionItemMock).toHaveBeenCalledWith("initialRouteRedirected");
  });
});
