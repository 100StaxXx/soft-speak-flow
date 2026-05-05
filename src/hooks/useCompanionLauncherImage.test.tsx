import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompanionLauncherImage } from "./useCompanionLauncherImage";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    scope: vi.fn(() => ({
      warn: mocks.loggerWarn,
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

const companionQueryKey = ["companion", "user-1"] as const;

const createFunctionError = ({
  message = "Edge Function returned a non-2xx status code",
  status,
  payload,
}: {
  message?: string;
  status?: number;
  payload?: Record<string, unknown>;
}) => {
  const error = new Error(message) as Error & {
    name: string;
    status?: number;
    context?: Response;
  };
  error.name = "FunctionsHttpError";

  if (typeof status === "number") {
    error.status = status;
  }

  if (payload || typeof status === "number") {
    error.context = new Response(JSON.stringify(payload ?? {}), {
      status: status ?? 500,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "request-1",
      },
    });
  }

  return error;
};

describe("useCompanionLauncherImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new Error("generation unavailable"),
    });
  });

  it("sends the companion and source image and caches a generated launcher image", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(companionQueryKey, {
      id: "companion-1",
      launcher_image_url: null,
      launcher_image_focal_x: null,
      launcher_image_focal_y: null,
      launcher_image_source_url: null,
    });
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        imageUrl: "https://assets.example.com/launcher.png",
        imageFocalX: 0.42,
        imageFocalY: 0.57,
        sourceImageUrl: "https://assets.example.com/source-a.png",
      },
      error: null,
    });

    renderHook(
      () =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          enabled: true,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith(
        "generate-companion-launcher-image",
        {
          body: {
            companionId: "companion-1",
            sourceImageUrl: "https://assets.example.com/source-a.png",
          },
        },
      );
      expect(queryClient.getQueryData(companionQueryKey)).toMatchObject({
        launcher_image_url: "https://assets.example.com/launcher.png",
        launcher_image_focal_x: 0.42,
        launcher_image_focal_y: 0.57,
        launcher_image_source_url: "https://assets.example.com/source-a.png",
      });
    });
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it("retries one transient launcher request failure before succeeding", async () => {
    const transientError = createFunctionError({
      status: 503,
      payload: {
        code: "COMPANION_LAUNCHER_OPENAI_EDIT_FAILED",
        failureReason: "openai_edit_failed",
        stage: "edit_image",
        message: "Companion launcher image edit failed",
      },
    });
    mocks.invoke
      .mockResolvedValueOnce({ data: null, error: transientError })
      .mockResolvedValueOnce({
        data: {
          success: true,
          imageUrl: "https://assets.example.com/launcher.png",
          sourceImageUrl: "https://assets.example.com/source-a.png",
        },
        error: null,
      });

    renderHook(
      () =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          enabled: true,
        }),
      { wrapper: createHarness().wrapper },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
    });
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it("does not retry permanent launcher failures and logs structured diagnostics", async () => {
    const permanentError = createFunctionError({
      status: 424,
      payload: {
        code: "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
        failureReason: "reference_download_failed",
        stage: "download_reference",
        message: "Companion reference image could not be downloaded",
        upstreamStatus: 404,
        upstreamError: "Failed to download reference image: 404",
      },
    });
    mocks.invoke.mockResolvedValue({
      data: null,
      error: permanentError,
    });

    renderHook(
      () =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          enabled: true,
        }),
      { wrapper: createHarness().wrapper },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "Companion launcher image generation failed",
        expect.objectContaining({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          status: 424,
          code: "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
          reason: "reference_download_failed",
          category: "http",
          requestId: "request-1",
          upstreamStatus: 404,
          upstreamError: "Failed to download reference image: 404",
        }),
      );
    });
  });

  it("does not retry non-retryable structured 500 launcher failures", async () => {
    const configError = createFunctionError({
      status: 500,
      payload: {
        code: "COMPANION_LAUNCHER_CONFIG_ERROR",
        failureReason: "openai_config_missing",
        stage: "configure_openai",
        message: "Companion launcher image generation is not configured",
        retryable: false,
      },
    });
    mocks.invoke.mockResolvedValue({
      data: null,
      error: configError,
    });

    renderHook(
      () =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          enabled: true,
        }),
      { wrapper: createHarness().wrapper },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "Companion launcher image generation failed",
        expect.objectContaining({
          companionId: "companion-1",
          sourceImageUrl: "https://assets.example.com/source-a.png",
          status: 500,
          code: "COMPANION_LAUNCHER_CONFIG_ERROR",
          reason: "openai_config_missing",
          category: "http",
          requestId: "request-1",
        }),
      );
    });
  });

  it("does not immediately request the same failed source again on rerender", async () => {
    const { wrapper } = createHarness();
    const { rerender } = renderHook(
      ({ sourceImageUrl }) =>
        useCompanionLauncherImage({
          companionId: "companion-1",
          sourceImageUrl,
          enabled: true,
        }),
      {
        initialProps: {
          sourceImageUrl: "https://assets.example.com/source-a.png",
        },
        wrapper,
      },
    );

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
    });

    rerender({ sourceImageUrl: "https://assets.example.com/source-a.png" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    rerender({ sourceImageUrl: "https://assets.example.com/source-b.png" });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
    });
  });
});
