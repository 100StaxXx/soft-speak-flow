import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WallpaperManifestProvider,
  useResolvedWallpaper,
  useWallpaperManifest,
} from "@/contexts/WallpaperManifestContext";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  isNativePlatform: false,
  addListener: vi.fn(),
}));

const localStorageState = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
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

const CACHE_KEY = "wallpaper-manifest-cache-v2";

const makeQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity,
    },
  },
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

const TestConsumer = () => {
  const wallpaper = useResolvedWallpaper("guide");
  const manifest = useWallpaperManifest();

  return (
    <div>
      <div data-testid="current-date">{manifest.currentDateKey}</div>
      <div data-testid="wallpaper-source">{wallpaper?.source ?? "loading"}</div>
      <div data-testid="wallpaper-url">{wallpaper?.imageUrl ?? "none"}</div>
      <button
        type="button"
        onClick={() => {
          if (!wallpaper) return;
          manifest.reportWallpaperRenderError("guide", wallpaper.imageUrl);
        }}
      >
        fail
      </button>
    </div>
  );
};

const renderProvider = async () => {
  await act(async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <WallpaperManifestProvider enabled userTimezone="America/Los_Angeles">
          <TestConsumer />
        </WallpaperManifestProvider>
      </QueryClientProvider>,
    );

    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("WallpaperManifestProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:30:00.000Z"));
    installLocalStorageMock();
    localStorageState.store.clear();
    mocks.isNativePlatform = false;
    mocks.addListener.mockReset();
    mocks.from.mockImplementation(() => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorageState.store.clear();
  });

  it("hydrates the current effective day from cache without painting yesterday first", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 2,
      savedAt: "2026-04-08T10:20:00.000Z",
      manifestByDate: {
        "2026-04-07": {
          guide: {
            forDate: "2026-04-07",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/yesterday.png",
            mobileFocusX: 50,
            mobileFocusY: 30,
            desktopFocusX: 52,
            desktopFocusY: 34,
            updatedAt: "2026-04-07T10:00:00.000Z",
          },
        },
        "2026-04-08": {
          guide: {
            forDate: "2026-04-08",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/today.png",
            mobileFocusX: 51,
            mobileFocusY: 31,
            desktopFocusX: 53,
            desktopFocusY: 35,
            updatedAt: "2026-04-08T10:00:00.000Z",
          },
        },
        "2026-04-09": {
          guide: {
            forDate: "2026-04-09",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/tomorrow.png",
            mobileFocusX: 51,
            mobileFocusY: 31,
            desktopFocusX: 53,
            desktopFocusY: 35,
            updatedAt: "2026-04-09T10:00:00.000Z",
          },
        },
      },
    }));

    await renderProvider();

    expect(screen.getByTestId("current-date")).toHaveTextContent("2026-04-08");
    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("remote");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("https://example.com/today.png");
  });

  it("switches to the preloaded next-day wallpaper at the 2 AM boundary without showing the old date again", async () => {
    vi.setSystemTime(new Date("2026-04-08T08:50:00.000Z"));

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 2,
      savedAt: "2026-04-08T08:45:00.000Z",
      manifestByDate: {
        "2026-04-07": {
          guide: {
            forDate: "2026-04-07",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/day-7.png",
            mobileFocusX: 50,
            mobileFocusY: 30,
            desktopFocusX: 52,
            desktopFocusY: 34,
            updatedAt: "2026-04-07T10:00:00.000Z",
          },
        },
        "2026-04-08": {
          guide: {
            forDate: "2026-04-08",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/day-8.png",
            mobileFocusX: 50,
            mobileFocusY: 30,
            desktopFocusX: 52,
            desktopFocusY: 34,
            updatedAt: "2026-04-08T10:00:00.000Z",
          },
        },
      },
    }));

    await renderProvider();

    expect(screen.getByTestId("current-date")).toHaveTextContent("2026-04-07");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("https://example.com/day-7.png");

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 50);
      await Promise.resolve();
    });

    expect(screen.getByTestId("current-date")).toHaveTextContent("2026-04-08");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("https://example.com/day-8.png");
  });

  it("falls back to the seed wallpaper after a render failure for the active remote wallpaper", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 2,
      savedAt: "2026-04-08T10:20:00.000Z",
      manifestByDate: {
        "2026-04-08": {
          guide: {
            forDate: "2026-04-08",
            pageKey: "guide",
            assignmentSource: "auto",
            imageUrl: "https://example.com/today.png",
            mobileFocusX: 50,
            mobileFocusY: 30,
            desktopFocusX: 52,
            desktopFocusY: 34,
            updatedAt: "2026-04-08T10:00:00.000Z",
          },
        },
        "2026-04-09": {},
      },
    }));

    await renderProvider();

    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("remote");

    await act(async () => {
      screen.getByRole("button", { name: "fail" }).click();
    });

    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("seed");
    expect(screen.getByTestId("wallpaper-url")).not.toHaveTextContent("https://example.com/today.png");
  });
});
