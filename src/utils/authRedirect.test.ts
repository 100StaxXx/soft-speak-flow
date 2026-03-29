import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const updateEqMock = vi.fn(() => Promise.resolve({ error: null }));
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));
  const upsertMock = vi.fn(() => Promise.resolve({ error: null }));
  const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    upsert: upsertMock,
  }));

  return {
    maybeSingleMock,
    updateEqMock,
    updateMock,
    upsertMock,
    selectEqMock,
    selectMock,
    fromMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("./logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { ensureProfile, getAuthRedirectPath, getProfileAwareAuthFallbackPath } from "./authRedirect";

describe("getAuthRedirectPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes to /tasks when onboarding is complete", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-1",
        onboarding_completed: true,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/tasks");
  });

  it("routes existing users to /tasks even without mentor when onboarding is complete", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: null,
        onboarding_completed: true,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getAuthRedirectPath("existing-user-no-mentor")).resolves.toBe("/tasks");
  });

  it("routes to /tasks when walkthrough is completed even if onboarding is false", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: null,
        onboarding_completed: false,
        onboarding_data: { walkthrough_completed: true },
      },
      error: null,
    });

    await expect(getAuthRedirectPath("walkthrough-complete-user")).resolves.toBe("/tasks");
  });

  it("routes to /onboarding when onboarding is explicitly incomplete, even with mentor", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: false,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/onboarding");
  });

  it("keeps legacy compatibility for null onboarding_completed when mentor is resolved", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-legacy",
        onboarding_completed: null,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/tasks");
  });

  it("routes to /onboarding when profile is missing", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/onboarding");
  });

  it("falls back safely on timeout and checks returning-user status", async () => {
    vi.useFakeTimers();

    mocks.maybeSingleMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        data: { onboarding_completed: false },
        error: null,
      });

    const pathPromise = getAuthRedirectPath("12345678-timeout");
    await vi.advanceTimersByTimeAsync(5001);

    await expect(pathPromise).resolves.toBe("/onboarding");
  });

  it("falls back to /tasks on timeout when returning-user check confirms completion", async () => {
    vi.useFakeTimers();

    mocks.maybeSingleMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        data: { onboarding_completed: true },
        error: null,
      });

    const pathPromise = getAuthRedirectPath("timeout-returning-user");
    await vi.advanceTimersByTimeAsync(5001);

    await expect(pathPromise).resolves.toBe("/tasks");
  });

  it("returns /onboarding when profile and returning-user checks both timeout", async () => {
    vi.useFakeTimers();

    mocks.maybeSingleMock.mockImplementation(() => new Promise(() => {}));

    const pathPromise = getAuthRedirectPath("12345678-double-timeout");
    await vi.advanceTimersByTimeAsync(7005);

    await expect(pathPromise).resolves.toBe("/onboarding");
  });

  it("keeps fallback deterministic when all lookups hang", async () => {
    vi.useFakeTimers();

    mocks.maybeSingleMock.mockImplementation(() => new Promise(() => {}));

    const firstPathPromise = getAuthRedirectPath("12345678-stuck-1");
    const secondPathPromise = getAuthRedirectPath("12345678-stuck-2");
    await vi.advanceTimersByTimeAsync(7005);

    await expect(firstPathPromise).resolves.toBe("/onboarding");
    await expect(secondPathPromise).resolves.toBe("/onboarding");
  });
});

describe("getProfileAwareAuthFallbackPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns /tasks for existing users", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: true,
        selected_mentor_id: null,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getProfileAwareAuthFallbackPath("returning-user")).resolves.toBe("/tasks");
  });

  it("returns /tasks for legacy existing users with a mentor and null onboarding_completed", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: null,
        selected_mentor_id: "mentor-legacy",
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getProfileAwareAuthFallbackPath("legacy-returning-user")).resolves.toBe("/tasks");
  });

  it("returns /tasks when walkthrough is completed even if onboarding is false", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: false,
        selected_mentor_id: null,
        onboarding_data: { walkthrough_completed: true },
      },
      error: null,
    });

    await expect(getProfileAwareAuthFallbackPath("walkthrough-fallback-user")).resolves.toBe("/tasks");
  });

  it("returns /onboarding for incomplete users", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: false,
        selected_mentor_id: null,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getProfileAwareAuthFallbackPath("new-user")).resolves.toBe("/onboarding");
  });

  it("returns /onboarding when fallback lookup times out", async () => {
    vi.useFakeTimers();
    mocks.maybeSingleMock.mockImplementationOnce(() => new Promise(() => {}));

    const fallbackPath = getProfileAwareAuthFallbackPath("timeout-user");
    await vi.advanceTimersByTimeAsync(2001);

    await expect(fallbackPath).resolves.toBe("/onboarding");
  });

  it("returns /onboarding when fallback lookup throws", async () => {
    mocks.maybeSingleMock.mockRejectedValueOnce(new Error("profile unavailable"));

    await expect(getProfileAwareAuthFallbackPath("error-user")).resolves.toBe("/onboarding");
  });
});

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates only a minimal bootstrap payload when the profile is missing", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await ensureProfile("profile-missing-user", "new@example.com");

    expect(mocks.upsertMock).toHaveBeenCalledTimes(1);
    const firstCall = mocks.upsertMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();

    const payload = firstCall?.[0] as Record<string, unknown>;
    const options = firstCall?.[1];

    expect(payload).toEqual(
      expect.objectContaining({
        id: "profile-missing-user",
        email: "new@example.com",
        timezone: expect.any(String),
      }),
    );
    expect(payload).not.toHaveProperty("selected_mentor_id");
    expect(payload).not.toHaveProperty("onboarding_completed");
    expect(payload).not.toHaveProperty("onboarding_step");
    expect(payload).not.toHaveProperty("onboarding_data");
    expect(options).toEqual({ onConflict: "id" });
  });
});
