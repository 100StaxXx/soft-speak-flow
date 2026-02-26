import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const platformState = {
    isNative: false,
    platform: "web",
  };

  const registerSWOptions: { current: Record<string, unknown> | null } = { current: null };
  const applyUpdateMock = vi.fn();
  const addListenerMock = vi.fn();
  const getInfoMock = vi.fn();
  const fetchMock = vi.fn();
  const getRegistrationMock = vi.fn();
  const appStateListenerRef: { current: ((state: { isActive: boolean }) => void) | null } = { current: null };
  const localStorageState = { store: new Map<string, string>() };
  const nowRef = { value: new Date("2026-02-26T10:00:00.000Z").getTime() };

  return {
    platformState,
    registerSWOptions,
    applyUpdateMock,
    addListenerMock,
    getInfoMock,
    fetchMock,
    getRegistrationMock,
    appStateListenerRef,
    localStorageState,
    nowRef,
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.platformState.isNative,
    getPlatform: () => mocks.platformState.platform,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.addListenerMock,
    getInfo: mocks.getInfoMock,
  },
}));

vi.mock("@/utils/pwaRegister", () => ({
  registerSW: (options: Record<string, unknown>) => {
    mocks.registerSWOptions.current = options;
    return mocks.applyUpdateMock;
  },
}));

import { useUpdateAvailability } from "./useUpdateAvailability";

const installServiceWorkerMock = () => {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: mocks.getRegistrationMock,
    },
  });
};

const installLocalStorageMock = () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => mocks.localStorageState.store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mocks.localStorageState.store.set(key, value);
      },
      removeItem: (key: string) => {
        mocks.localStorageState.store.delete(key);
      },
      clear: () => {
        mocks.localStorageState.store.clear();
      },
      key: (index: number) => Array.from(mocks.localStorageState.store.keys())[index] ?? null,
      get length() {
        return mocks.localStorageState.store.size;
      },
    } as Storage,
  });
};

describe("useUpdateAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nowRef.value = new Date("2026-02-26T10:00:00.000Z").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => mocks.nowRef.value);
    installLocalStorageMock();
    localStorage.clear();

    mocks.platformState.isNative = false;
    mocks.platformState.platform = "web";
    mocks.registerSWOptions.current = null;
    mocks.appStateListenerRef.current = null;

    mocks.applyUpdateMock.mockResolvedValue(undefined);
    mocks.getRegistrationMock.mockResolvedValue(null);
    mocks.fetchMock.mockReset();
    vi.stubGlobal("fetch", mocks.fetchMock);

    installServiceWorkerMock();

    mocks.addListenerMock.mockImplementation(
      async (_eventName: string, callback: (state: { isActive: boolean }) => void) => {
        mocks.appStateListenerRef.current = callback;
        return { remove: vi.fn().mockResolvedValue(undefined) };
      },
    );
    mocks.getInfoMock.mockResolvedValue({
      name: "Cosmiq",
      id: "com.darrylgraham.revolution",
      version: "1.0.0",
      build: "1",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sets update state when PWA signals onNeedRefresh", async () => {
    const registration = {
      waiting: { scriptURL: "/sw-new.js" },
      active: { scriptURL: "/sw-old.js" },
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    mocks.getRegistrationMock.mockResolvedValue(registration);
    mocks.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("sw-new")) {
        return new Response("new-sw-body", { status: 200 });
      }
      return new Response("old-sw-body", { status: 200 });
    });

    const { result } = renderHook(() => useUpdateAvailability());

    const options = mocks.registerSWOptions.current as {
      onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void;
      onNeedRefresh?: () => void;
    } | null;

    expect(options).toBeTruthy();

    await act(async () => {
      options?.onRegisteredSW?.("/sw.js", registration);
      options?.onNeedRefresh?.();
    });

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    expect(result.current.channel).toBe("pwa");
    expect(result.current.latestVersion).toMatch(/^sw-/);
  });

  it("sets update state when App Store version is newer on iOS", async () => {
    mocks.platformState.isNative = true;
    mocks.platformState.platform = "ios";

    mocks.fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          resultCount: 1,
          results: [
            {
              bundleId: "com.darrylgraham.revolution",
              version: "1.1.0",
              trackViewUrl: "https://apps.apple.com/app/id1234567890",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useUpdateAvailability());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    expect(result.current.channel).toBe("ios_store");
    expect(result.current.currentVersion).toBe("1.0.0");
    expect(result.current.latestVersion).toBe("1.1.0");
  });

  it("keeps a dismissed iOS update hidden on subsequent checks", async () => {
    mocks.platformState.isNative = true;
    mocks.platformState.platform = "ios";

    mocks.fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          resultCount: 1,
          results: [
            {
              bundleId: "com.darrylgraham.revolution",
              version: "1.1.0",
              trackViewUrl: "https://apps.apple.com/app/id1234567890",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useUpdateAvailability());

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(true);
    });

    await act(async () => {
      result.current.dismiss("1.1.0");
    });

    expect(result.current.hasUpdate).toBe(false);

    mocks.nowRef.value += RESUME_COOLDOWN_FOR_TEST;

    await act(async () => {
      mocks.appStateListenerRef.current?.({ isActive: true });
    });

    await waitFor(() => {
      expect(result.current.hasUpdate).toBe(false);
    });
  });
});

const RESUME_COOLDOWN_FOR_TEST = 10_001;
