import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getLocalJourneyPathForEpicMock: vi.fn(),
  invokeMock: vi.fn(),
  upsertPlannerRecordMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

vi.mock("@/hooks/epicsQuery", () => ({
  getEpicsQueryKey: (userId: string | undefined) => ["epics", userId] as const,
}));

vi.mock("@/utils/plannerLocalStore", () => ({
  getLocalJourneyPathForEpic: (...args: unknown[]) => mocks.getLocalJourneyPathForEpicMock(...args),
  upsertPlannerRecord: (...args: unknown[]) => mocks.upsertPlannerRecordMock(...args),
}));

import {
  JourneyPathGenerationFailure,
  getJourneyPathGenerationKey,
  requestJourneyPathGeneration,
} from "./journeyPathCache";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const buildRemoteFetchChain = () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const orderGeneratedAt = vi.fn(() => ({ limit }));
  const orderMilestone = vi.fn(() => ({ order: orderGeneratedAt }));
  const eqUserId = vi.fn(() => ({ order: orderMilestone }));
  const eqEpicId = vi.fn(() => ({ eq: eqUserId }));
  const select = vi.fn(() => ({ eq: eqEpicId }));

  mocks.fromMock.mockReturnValue({ select });
};

describe("journeyPathCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildRemoteFetchChain();
    mocks.getLocalJourneyPathForEpicMock.mockResolvedValue(null);
    mocks.upsertPlannerRecordMock.mockResolvedValue(undefined);
  });

  it("rejects invalid local inputs before invoking generate-journey-path", async () => {
    const queryClient = createQueryClient();

    const caughtError = await requestJourneyPathGeneration({
      epicId: "   ",
      milestoneIndex: 0,
      queryClient,
      userId: "user-1",
    }).catch((error) => error);

    expect(caughtError).toBeInstanceOf(JourneyPathGenerationFailure);
    expect(caughtError).toMatchObject({
      code: "INVALID_INPUT",
      message: "Missing or invalid journey path parameters.",
      requestId: null,
      retryAfterSeconds: null,
      retryable: false,
      status: 400,
    });

    expect(mocks.invokeMock).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(getJourneyPathGenerationKey("   ", "user-1"))).toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Missing or invalid journey path parameters.",
        requestId: null,
        retryAfterSeconds: null,
        retryable: false,
        status: 400,
      },
      milestoneIndex: null,
      pending: false,
    });
  });

  it("invokes generate-journey-path with the normalized request body for valid inputs", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: {
        imageUrl: "https://example.com/generated-path.png",
        milestoneIndex: 0,
      },
      error: null,
    });

    const queryClient = createQueryClient();
    const snapshot = await requestJourneyPathGeneration({
      epicId: " epic-1 ",
      milestoneIndex: 0,
      queryClient,
      userId: "user-1",
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-journey-path", {
      body: {
        epicId: "epic-1",
        milestoneIndex: 0,
      },
    });
    expect(snapshot).toMatchObject({
      epic_id: "epic-1",
      image_url: "https://example.com/generated-path.png",
      milestone_index: 0,
      user_id: "user-1",
    });
  });

  it("preserves structured rate-limit errors from generate-journey-path", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "You're making requests too quickly. Please wait about 45 seconds and try again.",
            code: "RATE_LIMITED",
            requestId: "req-journey-429",
            retryAfterSeconds: 45,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const queryClient = createQueryClient();

    const caughtError = await requestJourneyPathGeneration({
      epicId: "epic-1",
      milestoneIndex: 0,
      queryClient,
      userId: "user-1",
    }).catch((error) => error);

    expect(caughtError).toBeInstanceOf(JourneyPathGenerationFailure);
    expect(caughtError).toMatchObject({
      code: "RATE_LIMITED",
      message: "You're making requests too quickly. Please wait about 45 seconds and try again.",
      requestId: "req-journey-429",
      retryAfterSeconds: 45,
      retryable: true,
      status: 429,
    });

    expect(queryClient.getQueryData(getJourneyPathGenerationKey("epic-1", "user-1"))).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "You're making requests too quickly. Please wait about 45 seconds and try again.",
        requestId: "req-journey-429",
        retryAfterSeconds: 45,
        retryable: true,
        status: 429,
      },
      milestoneIndex: null,
      pending: false,
    });
  });

  it("maps generic server failures into a retryable journey-path error state", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Request could not be processed right now",
            code: "UPSTREAM_FAILED",
            requestId: "req-journey-503",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const queryClient = createQueryClient();

    const caughtError = await requestJourneyPathGeneration({
      epicId: "epic-9",
      milestoneIndex: 1,
      queryClient,
      userId: "user-1",
    }).catch((error) => error);

    expect(caughtError).toBeInstanceOf(JourneyPathGenerationFailure);
    expect(caughtError).toMatchObject({
      code: "UPSTREAM_FAILED",
      message: "Our servers are temporarily unavailable. Please try again in a moment.",
      requestId: "req-journey-503",
      retryAfterSeconds: null,
      retryable: true,
      status: 503,
    });

    expect(queryClient.getQueryData(getJourneyPathGenerationKey("epic-9", "user-1"))).toEqual({
      error: {
        code: "UPSTREAM_FAILED",
        message: "Our servers are temporarily unavailable. Please try again in a moment.",
        requestId: "req-journey-503",
        retryAfterSeconds: null,
        retryable: true,
        status: 503,
      },
      milestoneIndex: null,
      pending: false,
    });
  });
});
