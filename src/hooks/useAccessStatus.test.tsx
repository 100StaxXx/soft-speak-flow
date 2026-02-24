import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  profileLoading: false,
  isSubscribed: false,
  subscriptionLoading: false,
}));

vi.mock("./useProfile", () => ({
  useProfile: () => ({
    profile: mocks.profile,
    loading: mocks.profileLoading,
  }),
}));

vi.mock("./useSubscription", () => ({
  useSubscription: () => ({
    isActive: mocks.isSubscribed,
    isLoading: mocks.subscriptionLoading,
  }),
}));

import { useAccessStatus } from "./useAccessStatus";

const createProfile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  created_at: "2026-02-01T00:00:00.000Z",
  trial_started_at: null,
  trial_ends_at: null,
  onboarding_data: null,
  ...overrides,
});

describe("useAccessStatus", () => {
  beforeEach(() => {
    mocks.profileLoading = false;
    mocks.subscriptionLoading = false;
    mocks.isSubscribed = false;
    mocks.profile = createProfile();
  });

  it("returns pre-trial signup gate after guided tutorial when trial has not started", () => {
    mocks.profile = createProfile({
      onboarding_data: {
        guided_tutorial: { completed: true },
      },
      trial_started_at: null,
      trial_ends_at: null,
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.gateReason).toBe("pre_trial_signup");
  });

  it("allows access during active trial", () => {
    mocks.profile = createProfile({
      trial_started_at: "2026-02-20T00:00:00.000Z",
      trial_ends_at: "2026-03-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.isInTrial).toBe(true);
    expect(result.current.gateReason).toBe("none");
  });

  it("blocks access when trial is expired and user is not subscribed", () => {
    mocks.profile = createProfile({
      trial_started_at: "2026-01-01T00:00:00.000Z",
      trial_ends_at: "2026-01-08T00:00:00.000Z",
    });

    const { result } = renderHook(() => useAccessStatus());

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.trialExpired).toBe(true);
    expect(result.current.gateReason).toBe("trial_expired");
  });

  it("keeps access when user is subscribed regardless of trial state", () => {
    mocks.isSubscribed = true;
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
});
