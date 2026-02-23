import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn();
  const invokeMock = vi.fn();

  return {
    fromMock,
    invokeMock,
    cachedRows: [] as Array<{ image_url: string; variant_index: number }>,
    cacheError: null as { message: string } | null,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    functions: {
      invoke: mocks.invokeMock,
    },
  },
}));

import { useAdversaryImage } from "./useAdversaryImage";

const createAdversaryImagesBuilder = () => {
  const builder: Record<string, unknown> = {};
  const returnBuilder = () => builder;

  builder.select = vi.fn(returnBuilder);
  builder.eq = vi.fn(returnBuilder);
  builder.order = vi.fn(async () => ({
    data: mocks.cachedRows,
    error: mocks.cacheError,
  }));

  return builder;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

describe("useAdversaryImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cachedRows = [];
    mocks.cacheError = null;
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "adversary_images") {
        return createAdversaryImagesBuilder();
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.invokeMock.mockResolvedValue({
      data: { imageUrl: "https://example.com/generated.png" },
      error: null,
    });
  });

  it("selects deterministic cached variant by encounter seed and does not top up when full", async () => {
    mocks.cachedRows = [
      { image_url: "https://example.com/v0.png", variant_index: 0 },
      { image_url: "https://example.com/v1.png", variant_index: 1 },
      { image_url: "https://example.com/v2.png", variant_index: 2 },
    ];

    const seed = "encounter-123";
    const expectedIndex = hashString(seed) % mocks.cachedRows.length;
    const expectedUrl = mocks.cachedRows[expectedIndex].image_url;

    const { result, rerender } = renderHook(
      (props: { seed: string }) =>
        useAdversaryImage({
          theme: "distraction",
          tier: "common",
          name: "Frantic Shade",
          selectionSeed: props.seed,
          targetVariants: 3,
        }),
      {
        initialProps: { seed },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe(expectedUrl);
    expect(mocks.invokeMock).not.toHaveBeenCalled();

    rerender({ seed });
    await waitFor(() => {
      expect(result.current.imageUrl).toBe(expectedUrl);
    });
  });

  it("returns fallback immediately on cache miss and starts background top-up", async () => {
    let resolveInvoke: ((value: unknown) => void) | null = null;
    mocks.invokeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useAdversaryImage({
        theme: "resist-theme-a",
        tier: "common",
        name: "Missing Variant",
        selectionSeed: "enc-a",
        targetVariants: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBeNull();
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);
    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-adversary-image", {
      body: {
        theme: "resist-theme-a",
        tier: "common",
        name: "Missing Variant",
        targetVariants: 3,
      },
    });

    resolveInvoke?.({
      data: { imageUrl: "https://example.com/later.png" },
      error: null,
    });

    await waitFor(() => {
      expect(result.current.imageUrl).toBe("https://example.com/later.png");
    });
  });

  it("dedupes background top-up requests per theme+tier in-session", async () => {
    mocks.cachedRows = [];

    const first = renderHook(() =>
      useAdversaryImage({
        theme: "resist-theme-b",
        tier: "uncommon",
        name: "First",
        selectionSeed: "enc-b-1",
        targetVariants: 3,
      }),
    );

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
    });
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() =>
      useAdversaryImage({
        theme: "resist-theme-b",
        tier: "uncommon",
        name: "Second",
        selectionSeed: "enc-b-2",
        targetVariants: 3,
      }),
    );

    await waitFor(() => {
      expect(second.result.current.isLoading).toBe(false);
    });
    expect(mocks.invokeMock).toHaveBeenCalledTimes(1);

    first.unmount();
    second.unmount();
  });
});
