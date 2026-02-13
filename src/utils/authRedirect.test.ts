import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const updateEqMock = vi.fn(() => Promise.resolve({ error: null }));
  const updateMock = vi.fn(() => ({ eq: updateEqMock }));
  const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
  }));

  return {
    maybeSingleMock,
    updateEqMock,
    updateMock,
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

import { getAuthRedirectPath } from "./authRedirect";

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
});
