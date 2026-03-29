import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  profileLoading: false,
  accessState: {
    has_access: false,
    access_source: "none",
    trial_ends_at: null,
    subscribed: false,
  },
  accessLoading: false,
}));

const localStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("./useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
    loading: mocks.profileLoading,
  }),
}));

vi.mock("./useAccessState", () => ({
  useAccessState: () => ({
    accessState: mocks.accessState,
    isLoading: mocks.accessLoading,
  }),
}));

import { useAccessStatus } from "./useAccessStatus";

const createProfile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "user-1",
  created_at: "2026-02-01T00:00:00.000Z",
  onboarding_data: null,
  ...overrides,
});

const installLocalStorageMock = () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageState.store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageState.store.set(key, value);
      },
      removeItem: (key: string) => {
        localStorageState.store.delete(key);
      },
      clear: () => {
        localStorageState.store.clear();
      },
      key: (index: number) => Array.from(localStorageState.store.keys())[index] ?? null,
      get length() {
        return localStorageState.store.size;
      },
    } as Storage,
  });
};

describe("useAccessStatus", () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorageState.store.clear();
    mocks.profileLoading = false;
    mocks.accessLoading = false;
    mocks.accessState = {
      has_access: false,
      access_source: "none",
      trial_ends_at: null,
      subscribed: false,
    };
    mocks.profile = createProfile();
  });

  it("returns pre-trial signup gate after guided tutorial when trial has not started", () => {
    mocks.profile = createProfile({
      onboarding_data: {
        guided_tutorial: { completed: true },
      },
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.gateReason).toBe("pre_trial_signup");
  });

  it("allows access during active trial", () => {
    mocks.accessState = {
      has_access: true,
      access_source: "trial",
      trial_ends_at: "2026-03-01T00:00:00.000Z",
      subscribed: false,
    };

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isInTrial).toBe(true);
    expect(result.current.gateReason).toBe("none");
  });

  it("blocks access when trial is expired and user is not subscribed", () => {
    mocks.accessState = {
      has_access: false,
      access_source: "none",
      trial_ends_at: "2026-01-08T00:00:00.000Z",
      subscribed: false,
    };

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.trialExpired).toBe(true);
    expect(result.current.gateReason).toBe("trial_expired");
  });

  it("keeps access when user is subscribed regardless of trial state", () => {
    mocks.accessState = {
      has_access: true,
      access_source: "subscription",
      trial_ends_at: null,
      subscribed: true,
    };
    mocks.profile = createProfile({
      onboarding_data: {
        guided_tutorial: { completed: true },
      },
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.accessSource).toBe("subscription");
    expect(result.current.gateReason).toBe("none");
  });

  it("shows pre-trial signup gate after tutorial completion even if legacy trial dates exist", () => {
    mocks.accessState = {
      has_access: true,
      access_source: "trial",
      trial_ends_at: "2026-03-01T00:00:00.000Z",
      subscribed: false,
    };
    mocks.profile = createProfile({
      onboarding_data: {
        guided_tutorial: { completed: true },
      },
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.gateReason).toBe("pre_trial_signup");
  });

  it("shows pre-trial signup gate from local guided tutorial completion before profile refresh", () => {
    mocks.profile = createProfile({
      onboarding_data: {
        guided_tutorial: { completed: false },
      },
    });
    globalThis.localStorage?.setItem?.(
      "guided_tutorial_progress_user-1",
      JSON.stringify({ completed: true })
    );

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.gateReason).toBe("pre_trial_signup");
  });
});
