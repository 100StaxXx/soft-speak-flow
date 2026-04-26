import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: {
    onboarding_data: {},
  } as Record<string, unknown> | null,
  rpc: vi.fn(),
  toastError: vi.fn(),
}));

const storageMocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    safeLocalStorage: {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        store.clear();
        return true;
      }),
    },
    reset: () => {
      store.clear();
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storageMocks.safeLocalStorage,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

import { useFirstTimeModal } from "./useFirstTimeModal";

describe("useFirstTimeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.reset();
    mocks.user = { id: "user-1" };
    mocks.profile = { onboarding_data: {} };
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("shows once and persists dismissal locally plus remotely", async () => {
    const { result } = renderHook(() => useFirstTimeModal("search"));

    await waitFor(() => {
      expect(result.current.showModal).toBe(true);
    });

    act(() => {
      result.current.dismissModal();
    });

    expect(result.current.showModal).toBe(false);
    expect(storageMocks.safeLocalStorage.setItem).toHaveBeenCalledWith(
      "tab_intro_search_user-1",
      "true",
    );
    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "mark_profile_tab_intro_dismissed",
        { p_tab_name: "search" },
      );
    });
  });

  it("honors server dismissal on a fresh device and can be manually reopened", () => {
    mocks.profile = {
      onboarding_data: {
        tab_intros: {
          epics: true,
        },
      },
    };

    const { result } = renderHook(() => useFirstTimeModal("epics"));

    expect(result.current.showModal).toBe(false);

    act(() => {
      result.current.openModal();
    });

    expect(result.current.showModal).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("restores the modal when remote dismissal persistence fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: new Error("network down") });
    const { result } = renderHook(() => useFirstTimeModal("search"));

    await waitFor(() => {
      expect(result.current.showModal).toBe(true);
    });

    act(() => {
      result.current.dismissModal();
    });

    expect(result.current.showModal).toBe(false);

    await waitFor(() => {
      expect(result.current.showModal).toBe(true);
    });
    expect(storageMocks.safeLocalStorage.removeItem).toHaveBeenCalledWith(
      "tab_intro_search_user-1",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "We couldn't save that tutorial dismissal. Please try again.",
    );
  });

  it("does not reopen when server dismissal arrives before an RPC failure", async () => {
    let resolveRpc: ((value: { error: Error }) => void) | null = null;
    mocks.rpc.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRpc = resolve as (value: { error: Error }) => void;
      }),
    );

    const { result, rerender } = renderHook(() => useFirstTimeModal("search"));

    await waitFor(() => {
      expect(result.current.showModal).toBe(true);
    });

    act(() => {
      result.current.dismissModal();
    });

    expect(result.current.showModal).toBe(false);

    mocks.profile = {
      onboarding_data: {
        tab_intros: {
          search: true,
        },
      },
    };
    rerender();

    await act(async () => {
      resolveRpc?.({ error: new Error("network down") });
      await Promise.resolve();
    });

    expect(result.current.showModal).toBe(false);
    expect(storageMocks.safeLocalStorage.removeItem).not.toHaveBeenCalledWith(
      "tab_intro_search_user-1",
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
