import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    isOnline: true,
    profile: {
      selected_mentor_id: null as string | null,
      onboarding_completed: true as boolean | null,
      onboarding_data: null as unknown,
    },
    profileLoading: false,
    user: { id: "user-default" } as { id: string } | null,
    profileMaybeSingleResponses: [] as Array<{ data: any; error: any }>,
    mentorMaybeSingleResponses: [] as Array<{ data: any; error: any }>,
    profileUpdateResponses: [] as Array<{ error: any }>,
    profileUpdatePayloads: [] as Array<Record<string, unknown>>,
    queryClient: {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      refetchQueries: vi.fn().mockResolvedValue(undefined),
    },
  };

  const reset = () => {
    state.isOnline = true;
    state.profile = {
      selected_mentor_id: null,
      onboarding_completed: true,
      onboarding_data: null,
    };
    state.profileLoading = false;
    state.user = { id: "user-default" };
    state.profileMaybeSingleResponses = [];
    state.mentorMaybeSingleResponses = [];
    state.profileUpdateResponses = [];
    state.profileUpdatePayloads = [];
    state.queryClient.invalidateQueries.mockClear();
    state.queryClient.refetchQueries.mockClear();
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            return state.profileMaybeSingleResponses.shift() ?? { data: null, error: null };
          }
          if (table === "mentors") {
            return state.mentorMaybeSingleResponses.shift() ?? { data: null, error: null };
          }
          return { data: null, error: null };
        }),
      })),
    })),
    update: vi.fn((payload: Record<string, unknown>) => ({
      eq: vi.fn(async () => {
        if (table === "profiles") {
          state.profileUpdatePayloads.push(payload);
          return state.profileUpdateResponses.shift() ?? { error: null };
        }
        return { error: null };
      }),
    })),
  }));

  return { state, reset, from };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.state.queryClient,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.state.user,
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: mocks.state.profile,
    loading: mocks.state.profileLoading,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { useMentorConnectionHealth } from "./useMentorConnectionHealth";

describe("useMentorConnectionHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.reset();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => mocks.state.isOnline,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recovers from temporary missing mentor via profile refresh", async () => {
    mocks.state.user = { id: "user-temp-recovery" };
    mocks.state.profile = {
      selected_mentor_id: null,
      onboarding_completed: true,
      onboarding_data: null,
    };
    mocks.state.profileMaybeSingleResponses.push({
      data: {
        selected_mentor_id: "mentor-restored",
        onboarding_completed: true,
        onboarding_data: null,
      },
      error: null,
    });

    const { result } = renderHook(() => useMentorConnectionHealth());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.effectiveMentorId).toBe("mentor-restored");
  });

  it("backfills a valid onboarding mentor and marks status ready", async () => {
    mocks.state.user = { id: "user-backfill" };
    mocks.state.profile = {
      selected_mentor_id: null,
      onboarding_completed: true,
      onboarding_data: { mentorId: "66d0b7e0-215c-4c6c-b091-33c217de7fbb" },
    };
    mocks.state.profileMaybeSingleResponses.push({
      data: {
        selected_mentor_id: null,
        onboarding_completed: true,
        onboarding_data: { mentorId: "66d0b7e0-215c-4c6c-b091-33c217de7fbb" },
      },
      error: null,
    });
    mocks.state.mentorMaybeSingleResponses.push({
      data: { id: "66d0b7e0-215c-4c6c-b091-33c217de7fbb" },
      error: null,
    });
    mocks.state.profileUpdateResponses.push({ error: null });

    const { result } = renderHook(() => useMentorConnectionHealth());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.effectiveMentorId).toBe("66d0b7e0-215c-4c6c-b091-33c217de7fbb");
    expect(
      mocks.state.profileUpdatePayloads.some(
        (payload) => payload.selected_mentor_id === "66d0b7e0-215c-4c6c-b091-33c217de7fbb",
      ),
    ).toBe(true);
  });

  it("sanitizes invalid onboarding mentor and eventually resolves to missing", async () => {
    mocks.state.user = { id: "user-invalid-onboarding" };
    mocks.state.profile = {
      selected_mentor_id: null,
      onboarding_completed: true,
      onboarding_data: { mentorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", keep: true },
    };
    mocks.state.profileMaybeSingleResponses.push(
      {
        data: {
          selected_mentor_id: null,
          onboarding_completed: true,
          onboarding_data: { mentorId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", keep: true },
        },
        error: null,
      },
      {
        data: {
          selected_mentor_id: null,
          onboarding_completed: true,
          onboarding_data: { keep: true },
        },
        error: null,
      },
    );
    mocks.state.mentorMaybeSingleResponses.push({ data: null, error: null });
    mocks.state.profileUpdateResponses.push({ error: null });

    const { result } = renderHook(() => useMentorConnectionHealth());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe("missing");
    expect(result.current.effectiveMentorId).toBeNull();
    expect(
      mocks.state.profileUpdatePayloads.some(
        (payload) =>
          Object.prototype.hasOwnProperty.call(payload, "onboarding_data") &&
          !Object.prototype.hasOwnProperty.call(payload.onboarding_data as object, "mentorId"),
      ),
    ).toBe(true);
  });

  it("stays recovering while offline and retries on reconnect", async () => {
    mocks.state.user = { id: "user-offline" };
    mocks.state.profile = {
      selected_mentor_id: null,
      onboarding_completed: true,
      onboarding_data: null,
    };
    mocks.state.isOnline = false;

    const { result } = renderHook(() => useMentorConnectionHealth());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("recovering");

    mocks.state.isOnline = true;
    mocks.state.profileMaybeSingleResponses.push({
      data: {
        selected_mentor_id: "mentor-after-online",
        onboarding_completed: true,
        onboarding_data: null,
      },
      error: null,
    });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.effectiveMentorId).toBe("mentor-after-online");
  });
});
