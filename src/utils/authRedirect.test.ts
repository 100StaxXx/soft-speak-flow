import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const profilesMaybeSingleMock = vi.fn();
  const companionMaybeSingleMock = vi.fn();
  const profilesUpdateEqMock = vi.fn(() => Promise.resolve({ error: null }));
  const profilesUpdateMock = vi.fn(() => ({ eq: profilesUpdateEqMock }));
  const profilesUpsertMock = vi.fn(() => Promise.resolve({ error: null }));
  const profilesSelectEqMock = vi.fn(() => ({ maybeSingle: profilesMaybeSingleMock }));
  const profilesSelectMock = vi.fn(() => ({ eq: profilesSelectEqMock }));

  const companionLimitMock = vi.fn(() => ({ maybeSingle: companionMaybeSingleMock }));
  const companionOrderMock = vi.fn(() => ({ limit: companionLimitMock }));
  const companionEqMock = vi.fn(() => ({ order: companionOrderMock }));
  const companionSelectMock = vi.fn(() => ({ eq: companionEqMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: profilesSelectMock,
        update: profilesUpdateMock,
        upsert: profilesUpsertMock,
      };
    }

    if (table === "user_companion") {
      return {
        select: companionSelectMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    profilesMaybeSingleMock,
    companionMaybeSingleMock,
    profilesUpdateEqMock,
    profilesUpdateMock,
    profilesUpsertMock,
    profilesSelectEqMock,
    profilesSelectMock,
    companionLimitMock,
    companionOrderMock,
    companionEqMock,
    companionSelectMock,
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

const noCompanion = { data: null, error: null };
const existingCompanion = {
  data: { id: "companion-1", preset_id: "dragon", current_stage: 1 },
  error: null,
};
const stageZeroEggCompanion = {
  data: { id: "companion-egg", preset_id: null, current_stage: 0 },
  error: null,
};
const stageZeroPresetCompanion = {
  data: { id: "companion-egg", preset_id: "dragon", current_stage: 0 },
  error: null,
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("getAuthRedirectPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profilesMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.companionMaybeSingleMock.mockResolvedValue(noCompanion);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes to /tasks when onboarding is complete", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: null,
        onboarding_completed: false,
        onboarding_data: { walkthrough_completed: true },
      },
      error: null,
    });

    await expect(getAuthRedirectPath("walkthrough-complete-user")).resolves.toBe("/tasks");
  });

  it("routes companion-backed stale profiles to /tasks and self-heals the flags", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: false,
        onboarding_data: { guided_tutorial: { completed: false } },
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(existingCompanion);

    await expect(getAuthRedirectPath("companion-backed-user")).resolves.toBe("/tasks");
    await flushMicrotasks();

    expect(mocks.profilesUpdateEqMock).toHaveBeenCalledWith("id", "companion-backed-user");
    expect(mocks.profilesUpdateMock).toHaveBeenCalledWith({
      onboarding_completed: true,
      onboarding_data: {
        guided_tutorial: { completed: false },
        walkthrough_completed: true,
      },
    });
  });

  it("routes to /onboarding when onboarding is explicitly incomplete, even with mentor", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: false,
        onboarding_data: {},
      },
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/onboarding");
  });

  it("routes stage 0 egg accounts without guided tutorial progress back to /onboarding", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: true,
        onboarding_step: null,
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(stageZeroEggCompanion);

    await expect(getAuthRedirectPath("egg-recovery-user")).resolves.toBe("/onboarding");
  });

  it("routes preset-backed stage 0 egg accounts without guided tutorial progress back to /onboarding", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: true,
        onboarding_step: null,
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(stageZeroPresetCompanion);

    await expect(getAuthRedirectPath("preset-egg-recovery-user")).resolves.toBe("/onboarding");
  });

  it("routes stage 0 egg accounts with a complete onboarding step to /tasks", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: false,
        onboarding_step: "complete",
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(stageZeroEggCompanion);

    await expect(getAuthRedirectPath("egg-complete-user")).resolves.toBe("/tasks");
    await flushMicrotasks();

    expect(mocks.profilesUpdateEqMock).toHaveBeenCalledWith("id", "egg-complete-user");
    expect(mocks.profilesUpdateMock).toHaveBeenCalledWith({
      onboarding_completed: true,
      onboarding_data: {
        walkthrough_completed: true,
      },
    });
  });

  it("routes to /onboarding when progression reset is pending", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        selected_mentor_id: "mentor-2",
        onboarding_completed: true,
        onboarding_data: {
          walkthrough_completed: true,
          progression_reset_required: true,
        },
      },
      error: null,
    });

    await expect(getAuthRedirectPath("progression-reset-user")).resolves.toBe("/onboarding");
  });

  it("keeps legacy compatibility for null onboarding_completed when mentor is resolved", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(getAuthRedirectPath("12345678-user")).resolves.toBe("/onboarding");
  });

  it("falls back safely on timeout and checks returning-user status", async () => {
    vi.useFakeTimers();

    mocks.profilesMaybeSingleMock
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

    mocks.profilesMaybeSingleMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        data: { onboarding_completed: true },
        error: null,
      });

    const pathPromise = getAuthRedirectPath("timeout-returning-user");
    await vi.advanceTimersByTimeAsync(5001);

    await expect(pathPromise).resolves.toBe("/tasks");
  });

  it("falls back to /tasks on timeout when the returning-user check finds a companion-backed stale profile", async () => {
    vi.useFakeTimers();

    mocks.profilesMaybeSingleMock
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({
        data: {
          selected_mentor_id: "mentor-2",
          onboarding_completed: false,
          onboarding_data: {},
        },
        error: null,
      });
    mocks.companionMaybeSingleMock
      .mockResolvedValueOnce(existingCompanion)
      .mockResolvedValueOnce(existingCompanion);

    const pathPromise = getAuthRedirectPath("timeout-companion-user");
    await vi.advanceTimersByTimeAsync(5001);

    await expect(pathPromise).resolves.toBe("/tasks");
  });

  it("returns /onboarding when profile and returning-user checks both timeout", async () => {
    vi.useFakeTimers();

    mocks.profilesMaybeSingleMock.mockImplementation(() => new Promise(() => {}));

    const pathPromise = getAuthRedirectPath("12345678-double-timeout");
    await vi.advanceTimersByTimeAsync(7005);

    await expect(pathPromise).resolves.toBe("/onboarding");
  });

  it("keeps fallback deterministic when all lookups hang", async () => {
    vi.useFakeTimers();

    mocks.profilesMaybeSingleMock.mockImplementation(() => new Promise(() => {}));

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
    mocks.profilesMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.companionMaybeSingleMock.mockResolvedValue(noCompanion);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns /tasks for existing users", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: false,
        selected_mentor_id: null,
        onboarding_data: { walkthrough_completed: true },
      },
      error: null,
    });

    await expect(getProfileAwareAuthFallbackPath("walkthrough-fallback-user")).resolves.toBe("/tasks");
  });

  it("returns /tasks for companion-backed stale profiles", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: false,
        selected_mentor_id: "mentor-2",
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(existingCompanion);

    await expect(getProfileAwareAuthFallbackPath("companion-fallback-user")).resolves.toBe("/tasks");
  });

  it("returns /onboarding for stage 0 egg accounts without guided tutorial progress", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: true,
        onboarding_step: null,
        selected_mentor_id: "mentor-2",
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(stageZeroEggCompanion);

    await expect(getProfileAwareAuthFallbackPath("egg-fallback-user")).resolves.toBe("/onboarding");
  });

  it("returns /onboarding for preset-backed stage 0 egg accounts without guided tutorial progress", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        onboarding_completed: true,
        onboarding_step: null,
        selected_mentor_id: "mentor-2",
        onboarding_data: {},
      },
      error: null,
    });
    mocks.companionMaybeSingleMock.mockResolvedValueOnce(stageZeroPresetCompanion);

    await expect(getProfileAwareAuthFallbackPath("preset-egg-fallback-user")).resolves.toBe(
      "/onboarding",
    );
  });

  it("returns /onboarding for incomplete users", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
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
    mocks.profilesMaybeSingleMock.mockImplementationOnce(() => new Promise(() => {}));

    const fallbackPath = getProfileAwareAuthFallbackPath("timeout-user");
    await vi.advanceTimersByTimeAsync(2001);

    await expect(fallbackPath).resolves.toBe("/onboarding");
  });

  it("returns /onboarding when fallback lookup throws", async () => {
    mocks.profilesMaybeSingleMock.mockRejectedValueOnce(new Error("profile unavailable"));

    await expect(getProfileAwareAuthFallbackPath("error-user")).resolves.toBe("/onboarding");
  });
});

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profilesMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.companionMaybeSingleMock.mockResolvedValue(noCompanion);
  });

  it("creates only a minimal bootstrap payload when the profile is missing", async () => {
    mocks.profilesMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await ensureProfile("profile-missing-user", "new@example.com");

    expect(mocks.profilesUpsertMock).toHaveBeenCalledTimes(1);
    const upsertCalls = mocks.profilesUpsertMock.mock.calls as Array<
      [Record<string, unknown>, { onConflict?: string; ignoreDuplicates?: boolean }?]
    >;
    const [payload, options] = upsertCalls[0] ?? [{}];

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
