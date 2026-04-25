import type { ReactNode } from "react";
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
  const wallpaperState = wallpaper?.source ?? (manifest.currentDateReady ? "none" : "loading");

  return (
    <div>
      <div data-testid="current-date">{manifest.currentDateKey}</div>
      <div data-testid="current-ready">{String(manifest.currentDateReady)}</div>
      <div data-testid="wallpaper-source">{wallpaperState}</div>
      <div data-testid="wallpaper-url">{wallpaper?.imageUrl ?? "none"}</div>
      <div data-testid="error-message">{manifest.error?.message ?? "none"}</div>
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

const AllPagesConsumer = () => {
  const manifest = useWallpaperManifest();
  const guide = useResolvedWallpaper("guide");
  const quests = useResolvedWallpaper("quests");
  const campaigns = useResolvedWallpaper("campaigns");
  const companion = useResolvedWallpaper("companion");
  const profile = useResolvedWallpaper("profile");
  const pepTalk = useResolvedWallpaper("pep_talk");
  const resolveState = (wallpaper: ReturnType<typeof useResolvedWallpaper>) => (
    wallpaper?.source ?? (manifest.currentDateReady ? "none" : "loading")
  );

  return (
    <div>
      <div data-testid="current-ready">{String(manifest.currentDateReady)}</div>
      <div data-testid="guide-source">{resolveState(guide)}</div>
      <div data-testid="quests-source">{resolveState(quests)}</div>
      <div data-testid="campaigns-source">{resolveState(campaigns)}</div>
      <div data-testid="companion-source">{resolveState(companion)}</div>
      <div data-testid="profile-source">{resolveState(profile)}</div>
      <div data-testid="pep-talk-source">{resolveState(pepTalk)}</div>
    </div>
  );
};

const renderProvider = async (children: ReactNode = <TestConsumer />, enabled = true) => {
  await act(async () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <WallpaperManifestProvider enabled={enabled} userTimezone="America/Los_Angeles">
          {children}
        </WallpaperManifestProvider>
      </QueryClientProvider>,
    );

    await Promise.resolve();
    await Promise.resolve();
  });
};

const settleProvider = async (cycles = 3) => {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
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

  it("uses a remote wallpaper after a successful manifest fetch", async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({
        in: async () => ({
          data: [
            {
              for_date: "2026-04-08",
              page_key: "guide",
              assignment_source: "auto",
              image_url: "https://example.com/today.png",
              mobile_focus_x: 51,
              mobile_focus_y: 31,
              desktop_focus_x: 53,
              desktop_focus_y: 35,
              updated_at: "2026-04-08T10:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    }));

    await renderProvider();
    await settleProvider();

    expect(screen.getByTestId("current-ready")).toHaveTextContent("true");
    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("remote");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("https://example.com/today.png");
    expect(screen.getByTestId("error-message")).toHaveTextContent("none");
  });

  it("returns no wallpaper for all six surfaces when the manifest resolves with zero rows", async () => {
    await renderProvider(<AllPagesConsumer />);
    await settleProvider();

    expect(screen.getByTestId("current-ready")).toHaveTextContent("true");
    expect(screen.getByTestId("guide-source")).toHaveTextContent("none");
    expect(screen.getByTestId("quests-source")).toHaveTextContent("none");
    expect(screen.getByTestId("campaigns-source")).toHaveTextContent("none");
    expect(screen.getByTestId("companion-source")).toHaveTextContent("none");
    expect(screen.getByTestId("profile-source")).toHaveTextContent("none");
    expect(screen.getByTestId("pep-talk-source")).toHaveTextContent("none");
  });

  it("returns no wallpaper and exposes the error when the manifest fetch fails", async () => {
    mocks.from.mockImplementation(() => ({
      select: () => ({
        in: async () => ({ data: null, error: new Error("manifest failed") }),
      }),
    }));

    await renderProvider();
    await settleProvider();

    expect(screen.getByTestId("current-ready")).toHaveTextContent("true");
    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("none");
    expect(screen.getByTestId("error-message")).toHaveTextContent("manifest failed");
  });

  it("hydrates the current effective day from cache without painting yesterday first", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 3,
      savedAt: "2026-04-08T10:20:00.000Z",
      resolvedDateKeys: ["2026-04-08", "2026-04-09"],
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

    await renderProvider(<TestConsumer />, false);

    expect(screen.getByTestId("current-date")).toHaveTextContent("2026-04-08");
    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("remote");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("https://example.com/today.png");
  });

  it("switches to the preloaded next-day wallpaper at the 2 AM boundary without showing the old date again", async () => {
    vi.setSystemTime(new Date("2026-04-08T08:50:00.000Z"));

    mocks.from.mockImplementation(() => ({
      select: () => ({
        in: async (_column: string, dateKeys: string[]) => ({
          data: dateKeys.flatMap((dateKey) => {
            if (dateKey === "2026-04-07") {
              return [{
                for_date: "2026-04-07",
                page_key: "guide",
                assignment_source: "auto",
                image_url: "https://example.com/day-7.png",
                mobile_focus_x: 50,
                mobile_focus_y: 30,
                desktop_focus_x: 52,
                desktop_focus_y: 34,
                updated_at: "2026-04-07T10:00:00.000Z",
              }];
            }

            if (dateKey === "2026-04-08") {
              return [{
                for_date: "2026-04-08",
                page_key: "guide",
                assignment_source: "auto",
                image_url: "https://example.com/day-8.png",
                mobile_focus_x: 50,
                mobile_focus_y: 30,
                desktop_focus_x: 52,
                desktop_focus_y: 34,
                updated_at: "2026-04-08T10:00:00.000Z",
              }];
            }

            return [];
          }),
          error: null,
        }),
      }),
    }));

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 3,
      savedAt: "2026-04-08T08:45:00.000Z",
      resolvedDateKeys: ["2026-04-07", "2026-04-08"],
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

  it("clears the wallpaper after a render failure for the active remote wallpaper", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: 3,
      savedAt: "2026-04-08T10:20:00.000Z",
      resolvedDateKeys: ["2026-04-08", "2026-04-09"],
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

    await renderProvider(<TestConsumer />, false);

    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("remote");

    await act(async () => {
      screen.getByRole("button", { name: "fail" }).click();
    });

    expect(screen.getByTestId("wallpaper-source")).toHaveTextContent("none");
    expect(screen.getByTestId("wallpaper-url")).toHaveTextContent("none");
  });

  it("keeps one native app-state listener across wallpaper refetch rerenders", async () => {
    mocks.isNativePlatform = true;
    const remove = vi.fn().mockResolvedValue(undefined);
    mocks.addListener.mockResolvedValue({ remove });
    mocks.from.mockImplementation(() => ({
      select: () => ({
        in: async () => ({
          data: [
            {
              for_date: "2026-04-08",
              page_key: "guide",
              assignment_source: "auto",
              image_url: "https://example.com/today.png",
              mobile_focus_x: 51,
              mobile_focus_y: 31,
              desktop_focus_x: 53,
              desktop_focus_y: 35,
              updated_at: "2026-04-08T10:00:00.000Z",
            },
          ],
          error: null,
        }),
      }),
    }));

    const queryClient = makeQueryClient();
    const tree = (
      <QueryClientProvider client={queryClient}>
        <WallpaperManifestProvider enabled userTimezone="America/Los_Angeles">
          <TestConsumer />
        </WallpaperManifestProvider>
      </QueryClientProvider>
    );

    let rendered: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(tree);
      await Promise.resolve();
      await Promise.resolve();
    });
    await settleProvider();

    expect(mocks.addListener).toHaveBeenCalledTimes(1);

    const appStateCallback = mocks.addListener.mock.calls[0]?.[1];
    await act(async () => {
      appStateCallback?.({ isActive: true });
      await Promise.resolve();
      await Promise.resolve();
    });
    await settleProvider();

    rendered!.rerender(tree);
    await settleProvider();

    expect(mocks.addListener).toHaveBeenCalledTimes(1);

    await act(async () => {
      rendered!.unmount();
      await Promise.resolve();
    });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
