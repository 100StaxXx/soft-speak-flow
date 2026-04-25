import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: {
    onboarding_data: {},
  } as Record<string, unknown> | null,
  updatePayloads: [] as Array<Record<string, unknown>>,
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
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(async () => {
          mocks.updatePayloads.push(payload);
          return { error: null };
        }),
      })),
    })),
  },
}));

import { useFirstTimeModal } from "./useFirstTimeModal";

describe("useFirstTimeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.reset();
    mocks.user = { id: "user-1" };
    mocks.profile = { onboarding_data: {} };
    mocks.updatePayloads = [];
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
      expect(mocks.updatePayloads[0]).toMatchObject({
        onboarding_data: {
          tab_intros: {
            search: true,
          },
        },
      });
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
  });
});
