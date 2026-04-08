import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: false,
  addListener: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatform,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addListener,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => ({
    data: null,
    isLoading: false,
    error: null,
    queryFn,
  }),
}));

import { fetchLiveWallpaperRecord, useWallpaperDateKey } from "@/hooks/useLiveWallpaper";

describe("useWallpaperDateKey", () => {
  beforeEach(() => {
    mocks.isNativePlatform = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes the date key when the tab becomes visible on web", () => {
    let currentDateKey = "2026-04-08";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    const { result } = renderHook(() => useWallpaperDateKey(true, () => currentDateKey));

    expect(result.current).toBe("2026-04-08");

    currentDateKey = "2026-04-09";

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe("2026-04-09");
  });
});

describe("fetchLiveWallpaperRecord", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no assignment exists for the page/date", async () => {
    mocks.from
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      });

    await expect(fetchLiveWallpaperRecord("quests", "2026-04-08")).resolves.toBeNull();
  });

  it("maps the asset focus metadata into object-position strings", async () => {
    mocks.from
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { wallpaper_asset_id: "asset-1" },
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                publish_state: "ready",
                image_url: "https://example.com/live-wallpaper.png",
                mobile_focus_x: 44,
                mobile_focus_y: 28,
                desktop_focus_x: 48,
                desktop_focus_y: 32,
              },
              error: null,
            }),
          }),
        }),
      });

    await expect(fetchLiveWallpaperRecord("campaigns", "2026-04-08")).resolves.toEqual({
      imageUrl: "https://example.com/live-wallpaper.png",
      mobileObjectPosition: "44% 28%",
      desktopObjectPosition: "48% 32%",
    });
  });

  it("returns null when the assigned wallpaper asset is not ready", async () => {
    mocks.from
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { wallpaper_asset_id: "asset-2" },
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                publish_state: "suppressed",
                image_url: "https://example.com/live-wallpaper.png",
                mobile_focus_x: 44,
                mobile_focus_y: 28,
                desktop_focus_x: 48,
                desktop_focus_y: 32,
              },
              error: null,
            }),
          }),
        }),
      });

    await expect(fetchLiveWallpaperRecord("profile", "2026-04-08")).resolves.toBeNull();
  });
});
