import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCosmiqTitleCardLoadingSlides,
  COSMIQ_TITLE_CARD_LOADING_GALLERY_SEED_RETRY_MS,
  COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET,
  shouldRequestCosmiqTitleCardLoadingGallerySeed,
  useCosmiqTitleCardLoadingGallery,
} from "./useCosmiqTitleCardLoadingGallery";

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  tableError: null as Error | null,
  invokeMock: vi.fn(),
  operations: [] as Array<[string, ...unknown[]]>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      expect(table).toBe("companion_cosmiq_title_cards");
      const builder = {
        select(columns: string) {
          mocks.operations.push(["select", columns]);
          return builder;
        },
        eq(column: string, value: unknown) {
          mocks.operations.push(["eq", column, value]);
          return builder;
        },
        not(column: string, operator: string, value: unknown) {
          mocks.operations.push(["not", column, operator, value]);
          return builder;
        },
        order(column: string, options: unknown) {
          mocks.operations.push(["order", column, options]);
          return builder;
        },
        limit(value: number) {
          mocks.operations.push(["limit", value]);
          return Promise.resolve({
            data: mocks.tableError ? null : mocks.rows,
            error: mocks.tableError,
          });
        },
      };
      return builder;
    },
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

const readyRow = (index: number) => ({
  profile_key: `profile-${index}`,
  image_url: `https://cdn.example.com/card-${index}.png`,
  title: `Title ${index}`,
  rarity: "rare",
  status: "ready",
  generated_at: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  updated_at: null,
});

describe("useCosmiqTitleCardLoadingGallery", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.tableError = null;
    mocks.invokeMock.mockReset();
    mocks.invokeMock.mockResolvedValue({ data: { action: "generated" }, error: null });
    mocks.operations = [];
  });

  it("filters to ready image rows, dedupes, and caps at the target count", () => {
    const slides = buildCosmiqTitleCardLoadingSlides([
      readyRow(1),
      { ...readyRow(2), image_url: readyRow(1).image_url },
      { ...readyRow(3), profile_key: readyRow(1).profile_key },
      { ...readyRow(4), status: "generating" },
      { ...readyRow(5), image_url: null },
      ...Array.from({ length: 14 }, (_, index) => readyRow(index + 10)),
    ]);

    expect(slides).toHaveLength(COSMIQ_TITLE_CARD_LOADING_GALLERY_TARGET);
    expect(slides[0]).toEqual({
      profileKey: "profile-1",
      imageUrl: "https://cdn.example.com/card-1.png",
      title: "Title 1",
      rarity: "rare",
      generatedAt: "2026-04-02T00:00:00.000Z",
    });
    expect(new Set(slides.map((slide) => slide.imageUrl)).size).toBe(slides.length);
  });

  it("loads shared ready cards and kickstarts seeding when the library is sparse", async () => {
    mocks.rows = [readyRow(1), readyRow(2)];

    const { result } = renderHook(() => useCosmiqTitleCardLoadingGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.slides).toHaveLength(2);
    });
    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("seed-cosmiq-title-card-library", {
        body: { targetReadyCount: 10 },
      });
    });
    expect(mocks.operations).toContainEqual(["eq", "status", "ready"]);
    expect(mocks.operations).toContainEqual(["not", "image_url", "is", null]);
  });

  it("allows same-count seed retries after the seed retry cooldown", () => {
    const firstRequest = { readyCount: 2, requestedAt: 1_000 };

    expect(shouldRequestCosmiqTitleCardLoadingGallerySeed({
      readyCount: 2,
      isSeeding: false,
      lastSeedRequest: firstRequest,
      now: firstRequest.requestedAt + COSMIQ_TITLE_CARD_LOADING_GALLERY_SEED_RETRY_MS - 1,
    })).toBe(false);

    expect(shouldRequestCosmiqTitleCardLoadingGallerySeed({
      readyCount: 2,
      isSeeding: false,
      lastSeedRequest: firstRequest,
      now: firstRequest.requestedAt + COSMIQ_TITLE_CARD_LOADING_GALLERY_SEED_RETRY_MS,
    })).toBe(true);

    expect(shouldRequestCosmiqTitleCardLoadingGallerySeed({
      readyCount: 3,
      isSeeding: false,
      lastSeedRequest: firstRequest,
      now: firstRequest.requestedAt + 1,
    })).toBe(true);
  });

  it("does not invoke seeding when ten shared cards are already ready", async () => {
    mocks.rows = Array.from({ length: 10 }, (_, index) => readyRow(index + 1));

    const { result } = renderHook(() => useCosmiqTitleCardLoadingGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.slides).toHaveLength(10);
    });
    expect(mocks.invokeMock).not.toHaveBeenCalled();
  });

  it("surfaces query failures without inventing non-library fallback slides", async () => {
    mocks.tableError = new Error("library unavailable");

    const { result } = renderHook(() => useCosmiqTitleCardLoadingGallery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.slides).toEqual([]);
    expect(mocks.invokeMock).not.toHaveBeenCalled();
  });
});
